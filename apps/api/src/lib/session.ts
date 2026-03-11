/**
 * lib/session.ts — Gestão de sessões (D1 + HMAC-SHA-256)
 *
 * R: STACK_LOCK.md §6 — sessões em D1, signed_token HMAC, uma_por_user
 * R: STACK_LOCK.md §6 — cookies httpOnly, secure, SameSite=Strict
 * R: STACK_LOCK.md §6 — proibido: JWT stateless, sessões em KV, localStorage
 */
import {
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  deleteAllUserSessions,
  getSessionByToken,
} from "../db/queries/sessions";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const COOKIE_NAME = "session";

// ── HMAC helpers ──────────────────────────────────────────────────────────────

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signToken(payload: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${hex}`;
}

async function verifySignedToken(signedToken: string, secret: string): Promise<string | null> {
  const lastDot = signedToken.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = signedToken.slice(0, lastDot);
  const sig = signedToken.slice(lastDot + 1);

  const key = await getKey(secret);
  const enc = new TextEncoder();
  const sigBytes = Uint8Array.from((sig.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));
  return valid ? payload : null;
}

// ── API pública ───────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * Cria nova sessão (invalida anteriores do mesmo user — uma_por_user)
 * Devolve o signed_token para colocar no cookie
 */
export async function createSession(
  db: D1Database,
  userId: string,
  sessionSecret: string,
): Promise<string> {
  // Invalidar todas as sessões anteriores (uma_por_user = true)
  await deleteAllUserSessions(db, userId);

  const sessionId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${sessionId}:${userId}:${expiresAt}`;
  const signedToken = await signToken(payload, sessionSecret);

  await dbCreateSession(db, sessionId, userId, signedToken, expiresAt);
  return signedToken;
}

/**
 * Valida sessão: HMAC + D1 lookup + expiração
 * Devolve userId se válida, null se inválida/expirada
 */
export async function getSession(
  db: D1Database,
  signedToken: string,
  sessionSecret: string,
): Promise<string | null> {
  // 1. Verificar HMAC
  const payload = await verifySignedToken(signedToken, sessionSecret);
  if (!payload) return null;

  // 2. Verificar expiração (do payload — defesa em profundidade)
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const expiresAt = parseInt(parts[2] ?? "0", 10);
  if (Math.floor(Date.now() / 1000) > expiresAt) return null;

  // 3. Verificar existência em D1
  const row = await getSessionByToken(db, signedToken);
  if (!row) return null;
  if (Math.floor(Date.now() / 1000) > row.expires_at) return null;

  return row.user_id;
}

/**
 * Apaga sessão (logout)
 */
export async function deleteSession(db: D1Database, signedToken: string): Promise<void> {
  await dbDeleteSession(db, signedToken);
}

/**
 * Cria o Set-Cookie header para a sessão
 */
export function buildSessionCookie(token: string, clear = false): string {
  if (clear) {
    return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
  }
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`;
}

/**
 * Extrai o token do cookie de sessão
 * NOTA: SvelteKit faz URL-encode ao guardar cookies (cookies.set()),
 * convertendo ":" em "%3A". É necessário fazer decodeURIComponent antes
 * de validar o HMAC, caso contrário o token não coincide com o que está em D1.
 */
export function extractSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const raw = match?.[1] ?? null;
  if (!raw) return null;
  // Fazer decode para normalizar %3A → ":" (SvelteKit faz encode ao guardar cookies)
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // fallback: usar o valor tal como está
  }
}
