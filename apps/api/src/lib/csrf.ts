/**
 * lib/csrf.ts — CSRF token HMAC-SHA-256
 *
 * R: STACK_LOCK.md §6 — HMAC-SHA-256, CSRF_SECRET min 64 hex chars
 * R: STACK_LOCK.md §6 — aplicado em todas as mutações POST/PUT/PATCH/DELETE
 */

const CSRF_HEADER = "x-csrf-token";

// ── HMAC helpers ──────────────────────────────────────────────────────────────

async function getCsrfKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Gera um CSRF token (payload: timestamp + random, assinado com HMAC-SHA-256)
 */
export async function generateCsrfToken(csrfSecret: string): Promise<string> {
  const payload = `${Date.now()}.${crypto.randomUUID()}`;
  const key = await getCsrfKey(csrfSecret);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${hex}`;
}

/**
 * Verifica CSRF token (HMAC-SHA-256)
 * Retorna true se válido, false se inválido/expirado
 */
export async function verifyCsrfToken(
  token: string,
  csrfSecret: string,
  maxAgeMs = 3_600_000, // 1 hora
): Promise<boolean> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  // Verificar HMAC
  const key = await getCsrfKey(csrfSecret);
  const enc = new TextEncoder();

  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = new Uint8Array((sig.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  } catch {
    return false;
  }

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes.buffer, enc.encode(payload));
  if (!valid) return false;

  // Verificar expiração (timestamp é o primeiro segmento)
  const ts = parseInt(payload.split(".")[0] ?? "0", 10);
  if (Date.now() - ts >= maxAgeMs) return false;

  return true;
}

export { CSRF_HEADER };
