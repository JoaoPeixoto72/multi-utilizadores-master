/**
 * db/queries/password-resets.ts — Queries de reset de password
 *
 * R: STACK_LOCK.md §6 — tokens expiram 1 hora, uso único
 * R: STACK_LOCK.md §7 — prepared statements, zero SQL inline
 */

export interface PasswordResetRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getPasswordResetByHash(
  db: D1Database,
  tokenHash: string,
): Promise<PasswordResetRow | null> {
  const result = await db
    .prepare(
      `SELECT id, user_id, token_hash, expires_at, used_at, created_at
       FROM password_resets
       WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > unixepoch()`,
    )
    .bind(tokenHash)
    .first<PasswordResetRow>();
  return result ?? null;
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export async function createPasswordReset(
  db: D1Database,
  userId: string,
  tokenHash: string,
  expiresAt: number,
): Promise<void> {
  // Invalidar resets anteriores não usados do mesmo user
  await db
    .prepare("DELETE FROM password_resets WHERE user_id = ?1 AND used_at IS NULL")
    .bind(userId)
    .run();

  await db
    .prepare("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?1, ?2, ?3)")
    .bind(userId, tokenHash, expiresAt)
    .run();
}

export async function markPasswordResetUsed(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE password_resets SET used_at = unixepoch() WHERE id = ?1").bind(id).run();
}

export async function deleteExpiredPasswordResets(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM password_resets WHERE expires_at < unixepoch()").run();
}
