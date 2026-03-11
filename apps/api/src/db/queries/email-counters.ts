/**
 * db/queries/email-counters.ts — Contador de emails diários por empresa
 *
 * R: STACK_LOCK.md §7 — prepared statements, IDOR por tenant_id
 * R: BUILD_PLAN.md §M2.2
 */

// ── Leitura ────────────────────────────────────────────────────────────────────

export async function getDailyEmailCount(
  db: D1Database,
  tenantId: string,
  date: string, // 'YYYY-MM-DD'
): Promise<number> {
  const result = await db
    .prepare("SELECT count FROM tenant_daily_email_count WHERE tenant_id = ?1 AND date = ?2")
    .bind(tenantId, date)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

// ── Escrita ────────────────────────────────────────────────────────────────────

export async function incrementDailyEmailCount(
  db: D1Database,
  tenantId: string,
  date: string,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO tenant_daily_email_count (tenant_id, date, count, updated_at)
       VALUES (?1, ?2, 1, unixepoch())
       ON CONFLICT(tenant_id, date) DO UPDATE
         SET count = count + 1, updated_at = unixepoch()
       RETURNING count`,
    )
    .bind(tenantId, date)
    .first<{ count: number }>();
  return result?.count ?? 1;
}

export async function resetDailyEmailCount(
  db: D1Database,
  tenantId: string,
  date: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tenant_daily_email_count (tenant_id, date, count, updated_at)
       VALUES (?1, ?2, 0, unixepoch())
       ON CONFLICT(tenant_id, date) DO UPDATE
         SET count = 0, updated_at = unixepoch()`,
    )
    .bind(tenantId, date)
    .run();
}
