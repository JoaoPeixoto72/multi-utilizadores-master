/**
 * db/queries/storage.ts — Quota de armazenamento por empresa
 *
 * R: STACK_LOCK.md §7 — prepared statements, IDOR por tenant_id
 * R: BUILD_PLAN.md §M2.2
 */

// ── Leitura ────────────────────────────────────────────────────────────────────

export async function getStorageUsage(db: D1Database, tenantId: string): Promise<number> {
  const result = await db
    .prepare("SELECT bytes_used FROM tenant_storage_usage WHERE tenant_id = ?1")
    .bind(tenantId)
    .first<{ bytes_used: number }>();
  return result?.bytes_used ?? 0;
}

// ── Escrita ────────────────────────────────────────────────────────────────────

export async function incrementStorage(
  db: D1Database,
  tenantId: string,
  bytes: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tenant_storage_usage (tenant_id, bytes_used, updated_at)
       VALUES (?1, ?2, unixepoch())
       ON CONFLICT(tenant_id) DO UPDATE
         SET bytes_used = bytes_used + ?2, updated_at = unixepoch()`,
    )
    .bind(tenantId, bytes)
    .run();
}

export async function decrementStorage(
  db: D1Database,
  tenantId: string,
  bytes: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tenant_storage_usage (tenant_id, bytes_used, updated_at)
       VALUES (?1, 0, unixepoch())
       ON CONFLICT(tenant_id) DO UPDATE
         SET bytes_used = MAX(0, bytes_used - ?2), updated_at = unixepoch()`,
    )
    .bind(tenantId, bytes)
    .run();
}

export async function resetStorage(db: D1Database, tenantId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tenant_storage_usage (tenant_id, bytes_used, updated_at)
       VALUES (?1, 0, unixepoch())
       ON CONFLICT(tenant_id) DO UPDATE
         SET bytes_used = 0, updated_at = unixepoch()`,
    )
    .bind(tenantId)
    .run();
}
