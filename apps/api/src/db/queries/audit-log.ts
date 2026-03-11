/**
 * db/queries/audit-log.ts — Queries audit_log + break_glass_log (M9)
 *
 * R: BUILD_PLAN.md §M9.1
 * R: migrations/0010_logs.sql
 * REGRA: NUNCA guardar dados pessoais — apenas IDs e contagens
 */

export interface AuditLogRow {
  id: number;
  event_type: string;
  actor_id: string;
  tenant_id: string | null;
  target_type: string | null;
  target_id: string | null;
  bytes_affected: number;
  count_affected: number;
  metadata: string;
  created_at: number;
}

export interface InsertAuditParams {
  event_type: string;
  actor_id: string;
  tenant_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  bytes_affected?: number;
  count_affected?: number;
  metadata?: Record<string, unknown>;
}

// ── INSERT audit_log ──────────────────────────────────────────────────────────

export async function insertAuditLog(db: D1Database, p: InsertAuditParams): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log
         (event_type, actor_id, tenant_id, target_type, target_id,
          bytes_affected, count_affected, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      p.event_type,
      p.actor_id,
      p.tenant_id ?? null,
      p.target_type ?? null,
      p.target_id ?? null,
      p.bytes_affected ?? 0,
      p.count_affected ?? 0,
      JSON.stringify(p.metadata ?? {}),
    )
    .run();
}

// ── LIST audit_log (cursor-based, super user) ─────────────────────────────────

export interface ListAuditOptions {
  cursor?: number;
  event_type?: string;
  tenant_id?: string;
  limit?: number;
}

export async function listAuditLogs(
  db: D1Database,
  opts: ListAuditOptions,
): Promise<{ items: AuditLogRow[]; nextCursor: number | null }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  // Retenção 365 dias
  const cutoff = Math.floor(Date.now() / 1000) - 365 * 86400;
  conditions.push("created_at >= ?");
  bindings.push(cutoff);

  if (opts.cursor) {
    conditions.push("id < ?");
    bindings.push(opts.cursor);
  }
  if (opts.event_type) {
    conditions.push("event_type = ?");
    bindings.push(opts.event_type);
  }
  if (opts.tenant_id) {
    conditions.push("tenant_id = ?");
    bindings.push(opts.tenant_id);
  }

  const where = conditions.join(" AND ");
  const rows = await db
    .prepare(`SELECT * FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT ?`)
    .bind(...bindings, limit + 1)
    .all<AuditLogRow>();

  const items = rows.results ?? [];
  const nextCursor = items.length > limit ? (items.pop()?.id ?? null) : null;

  return { items, nextCursor };
}

// ── DELETE audit_log > 365 dias (cron maintenance) ────────────────────────────

export async function deleteExpiredAuditLogs(db: D1Database): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - 365 * 86400;
  const result = await db.prepare("DELETE FROM audit_log WHERE created_at < ?").bind(cutoff).run();
  return result.meta.changes ?? 0;
}

// ── break_glass_log ───────────────────────────────────────────────────────────

export async function insertBreakGlassLog(db: D1Database, actor_id: string): Promise<void> {
  await db.prepare("INSERT INTO break_glass_log (actor_id) VALUES (?)").bind(actor_id).run();
}

export async function getLastBreakGlassDownload(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare("SELECT downloaded_at FROM break_glass_log ORDER BY downloaded_at DESC LIMIT 1")
    .first<{ downloaded_at: number }>();
  return row?.downloaded_at ?? null;
}
