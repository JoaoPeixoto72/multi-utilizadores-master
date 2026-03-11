/**
 * db/queries/activity-log.ts — Queries activity_log (M9)
 *
 * R: BUILD_PLAN.md §M9.1
 * R: migrations/0010_logs.sql
 */

export interface ActivityLogRow {
  id: number;
  tenant_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: string;
  was_temp_owner: number;
  created_at: number;
}

export interface InsertActivityParams {
  tenant_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  target_name?: string | null;
  metadata?: Record<string, unknown>;
  was_temp_owner?: boolean;
}

// ── INSERT ────────────────────────────────────────────────────────────────────

export async function insertActivityLog(db: D1Database, p: InsertActivityParams): Promise<void> {
  await db
    .prepare(
      `INSERT INTO activity_log
         (tenant_id, actor_id, actor_name, action,
          target_type, target_id, target_name, metadata, was_temp_owner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      p.tenant_id,
      p.actor_id,
      p.actor_name,
      p.action,
      p.target_type ?? null,
      p.target_id ?? null,
      p.target_name ?? null,
      JSON.stringify(p.metadata ?? {}),
      p.was_temp_owner ? 1 : 0,
    )
    .run();
}

// ── LIST (cursor-based) ───────────────────────────────────────────────────────

export interface ListActivityOptions {
  tenant_id: string;
  cursor?: number;
  actor_id?: string;
  action?: string;
  limit?: number;
}

export async function listActivityLogs(
  db: D1Database,
  opts: ListActivityOptions,
): Promise<{ items: ActivityLogRow[]; nextCursor: number | null }> {
  const limit = Math.min(opts.limit ?? 30, 100);
  const conditions: string[] = ["tenant_id = ?"];
  const bindings: (string | number)[] = [opts.tenant_id];

  if (opts.cursor) {
    conditions.push("id < ?");
    bindings.push(opts.cursor);
  }
  if (opts.actor_id) {
    conditions.push("actor_id = ?");
    bindings.push(opts.actor_id);
  }
  if (opts.action) {
    conditions.push("action = ?");
    bindings.push(opts.action);
  }

  const where = conditions.join(" AND ");
  const rows = await db
    .prepare(`SELECT * FROM activity_log WHERE ${where} ORDER BY id DESC LIMIT ?`)
    .bind(...bindings, limit + 1)
    .all<ActivityLogRow>();

  const items = rows.results ?? [];
  const nextCursor = items.length > limit ? (items.pop()?.id ?? null) : null;

  return { items, nextCursor };
}

// ── DELETE (limpar histórico de empresa) ──────────────────────────────────────

export async function deleteActivityLogByTenant(
  db: D1Database,
  tenant_id: string,
): Promise<number> {
  const result = await db
    .prepare("DELETE FROM activity_log WHERE tenant_id = ?")
    .bind(tenant_id)
    .run();
  return result.meta.changes ?? 0;
}

// ── EXPORT (para CSV) ─────────────────────────────────────────────────────────

export async function exportActivityLogByTenant(
  db: D1Database,
  tenant_id: string,
): Promise<ActivityLogRow[]> {
  const result = await db
    .prepare("SELECT * FROM activity_log WHERE tenant_id = ? ORDER BY created_at ASC")
    .bind(tenant_id)
    .all<ActivityLogRow>();
  return result.results ?? [];
}
