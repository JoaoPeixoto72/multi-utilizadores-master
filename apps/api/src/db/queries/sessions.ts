/**
 * db/queries/sessions.ts — Queries de sessões
 *
 * R: STACK_LOCK.md §6 — sessões em D1, signed_token, uma_por_user
 * R: STACK_LOCK.md §7 — prepared statements, zero SQL inline fora daqui
 */

export interface SessionRow {
  id: string;
  user_id: string;
  signed_token: string;
  expires_at: number;
  created_at: number;
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getSessionByToken(
  db: D1Database,
  signedToken: string,
): Promise<SessionRow | null> {
  const result = await db
    .prepare(
      "SELECT id, user_id, signed_token, expires_at, created_at FROM sessions WHERE signed_token = ?1",
    )
    .bind(signedToken)
    .first<SessionRow>();
  return result ?? null;
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export async function createSession(
  db: D1Database,
  sessionId: string,
  userId: string,
  signedToken: string,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare("INSERT INTO sessions (id, user_id, signed_token, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(sessionId, userId, signedToken, expiresAt)
    .run();
}

export async function deleteSession(db: D1Database, signedToken: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE signed_token = ?1").bind(signedToken).run();
}

export async function deleteAllUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId).run();
}

export async function deleteExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE expires_at < unixepoch()").run();
}
