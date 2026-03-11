/**
 * db/queries/notifications.ts — Queries D1 para notificações
 *
 * R: BUILD_PLAN.md §M6.1, §M6.2
 * R: migrations/0007_notifications.sql
 */

// ID generation via Web Crypto (compatible com Cloudflare Workers)

export interface NotificationRow {
  id: string;
  user_id: string;
  tenant_id: string | null;
  type: string;
  title_key: string;
  body_key: string;
  params: string | null; // JSON string
  link: string | null;
  is_read: number; // 0 | 1
  created_at: string;
  read_at: string | null;
  expires_at: string | null;
}

export interface CreateNotificationInput {
  user_id: string;
  tenant_id?: string | null;
  type: string;
  title_key: string;
  body_key: string;
  params?: Record<string, string | number> | null;
  link?: string | null;
  expires_at?: string | null;
}

// ── INSERT ────────────────────────────────────────────────────────────────────

export async function insertNotification(
  db: D1Database,
  input: CreateNotificationInput,
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO notifications
         (id, user_id, tenant_id, type, title_key, body_key, params, link, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.user_id,
      input.tenant_id ?? null,
      input.type,
      input.title_key,
      input.body_key,
      input.params ? JSON.stringify(input.params) : null,
      input.link ?? null,
      input.expires_at ?? null,
    )
    .run();
  return id;
}

// ── SELECT ────────────────────────────────────────────────────────────────────

export async function listNotificationsByUser(
  db: D1Database,
  userId: string,
  opts: { cursor?: string; limit?: number; unreadOnly?: boolean },
): Promise<{ rows: NotificationRow[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  const parts: string[] = ["WHERE n.user_id = ?"];
  const binds: (string | number)[] = [userId];

  // Filtro opcional: apenas não lidas
  if (opts.unreadOnly) {
    parts.push("AND n.is_read = 0");
  }

  // Cursor-based pagination (created_at < cursor)
  if (opts.cursor) {
    parts.push("AND n.created_at < ?");
    binds.push(opts.cursor);
  }

  // Excluir expiradas
  parts.push("AND (n.expires_at IS NULL OR n.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))");

  const where = parts.join(" ");
  binds.push(limit + 1);

  const rows = await db
    .prepare(`SELECT * FROM notifications n ${where} ORDER BY n.created_at DESC LIMIT ?`)
    .bind(...binds)
    .all<NotificationRow>();

  const data = rows.results ?? [];
  let nextCursor: string | null = null;
  if (data.length > limit) {
    data.pop();
    nextCursor = data[data.length - 1]?.created_at ?? null;
  }

  return { rows: data, nextCursor };
}

export async function countUnreadByUser(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM notifications
       WHERE user_id = ? AND is_read = 0
         AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    )
    .bind(userId)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function getNotificationById(
  db: D1Database,
  id: string,
): Promise<NotificationRow | null> {
  return db.prepare("SELECT * FROM notifications WHERE id = ?").bind(id).first<NotificationRow>();
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function markNotificationRead(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE notifications
       SET is_read = 1, read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND user_id = ? AND is_read = 0`,
    )
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function markAllNotificationsRead(db: D1Database, userId: string): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE notifications
       SET is_read = 1, read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE user_id = ? AND is_read = 0`,
    )
    .bind(userId)
    .run();
  return result.meta.changes ?? 0;
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteNotificationById(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteAllNotificationsByUser(
  db: D1Database,
  userId: string,
): Promise<number> {
  const result = await db
    .prepare("DELETE FROM notifications WHERE user_id = ?")
    .bind(userId)
    .run();
  return result.meta.changes ?? 0;
}

// ── CLEANUP (cron) ────────────────────────────────────────────────────────────

export async function deleteExpiredNotifications(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM notifications
       WHERE expires_at IS NOT NULL AND expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .run();
  return result.meta.changes ?? 0;
}
