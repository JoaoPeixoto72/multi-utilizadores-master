/**
 * lib/token.ts — Tokens de uso único (password reset, convites, etc.)
 *
 * R: STACK_LOCK.md §6 — password_reset: 1 hora, uso único
 * Estratégia: gerar token random → guardar hash SHA-256 em DB → enviar raw por email
 */

/**
 * Gera token URL-safe e devolve o par (raw, hash)
 * raw  → enviado por email (nunca armazenado)
 * hash → armazenado em DB (nunca exposto)
 */
export async function generateOneTimeToken(): Promise<{
  raw: string;
  hash: string;
}> {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  const raw = Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { raw, hash };
}

/**
 * Hash SHA-256 de um token raw (para lookup em DB)
 */
export async function hashToken(raw: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Expiração: agora + N segundos em Unix timestamp */
export function expiresIn(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

export const EXPIRY = {
  PASSWORD_RESET: 60 * 60, // 1 hora
  INVITE: 60 * 60 * 24, // 24 horas
  EMAIL_CHANGE: 60 * 60 * 24, // 24 horas
  BREAK_GLASS: 60 * 15, // 15 minutos
  OWNER_TEMPORARIO: 60 * 60 * 24, // 24 horas (configurável)
} as const;
