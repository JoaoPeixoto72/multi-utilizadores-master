/**
 * lib/encryption.ts — AES-256-GCM via Web Crypto API (Cloudflare Workers)
 *
 * R: BUILD_PLAN.md §M7.2
 * R: STACK_LOCK.md §18 — zero Node.js crypto; usar Web Crypto API
 *
 * Uso:
 *   const enc = await encrypt('minha-chave-secreta', env.ENCRYPTION_KEY);
 *   const dec = await decrypt(enc, env.ENCRYPTION_KEY);
 *
 * Formato de saída: base64url(iv[12] + ciphertext + authTag[16])
 *   - iv:       12 bytes aleatórios (GCM nonce)
 *   - payload:  AES-256-GCM encrypted + 16-byte auth tag
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function b64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function deriveKey(rawKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Importar como raw key material para PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(rawKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  // Derivar chave AES-256-GCM com salt fixo e 100k iterações
  // (salt público OK — a segurança vem do ENCRYPTION_KEY secreto)
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("cf-base-integrations-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  const key = await deriveKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  // Concatenar iv + ciphertext (que inclui auth tag no Web Crypto)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return b64urlEncode(combined.buffer);
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

export async function decrypt(cipherBase64: string, encryptionKey: string): Promise<string> {
  const key = await deriveKey(encryptionKey);
  const combined = b64urlDecode(cipherBase64);

  if (combined.length < 13) {
    throw new Error("encryption_invalid_payload");
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

  return new TextDecoder().decode(plaintext);
}
