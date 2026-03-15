// apps/api/src/db/queries/backups.ts
// M8 — Queries de backups e configuração de backup automático

// @ts-expect-error
import { aliasedTable, and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";

export interface BackupRow {
  id: string;
  tenant_id: string;
  type: "db_only" | "full";
  status: "pending" | "running" | "done" | "failed";
  size_bytes: number | null;
  r2_key: string | null;
  download_expires_at: number | null;
  error_msg: string | null;
  created_by: string;
  created_at: number;
  completed_at: number | null;
}

export interface BackupAutoConfigRow {
  tenant_id: string;
  enabled: number;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number;
  retention_days: number;
  created_at: number;
  updated_at: number;
}

// ── Backups ──────────────────────────────────────────────────────────────────

export async function insertBackup(
  db: D1Database,
  data: { id: string; tenant_id: string; type: string; created_by: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO backups (id, tenant_id, type, status, created_by)
       VALUES (?, ?, ?, 'pending', ?)`,
    )
    .bind(data.id, data.tenant_id, data.type, data.created_by)
    .run();
}

export async function updateBackupRunning(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE backups SET status = 'running' WHERE id = ?`).bind(id).run();
}

export async function updateBackupDone(
  db: D1Database,
  id: string,
  data: { r2_key: string; size_bytes: number; download_expires_at: number },
): Promise<void> {
  await db
    .prepare(
      `UPDATE backups
       SET status = 'done', r2_key = ?, size_bytes = ?,
           download_expires_at = ?, completed_at = (unixepoch('now') * 1000)
       WHERE id = ?`,
    )
    .bind(data.r2_key, data.size_bytes, data.download_expires_at, id)
    .run();
}

export async function updateBackupFailed(
  db: D1Database,
  id: string,
  error_msg: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE backups
       SET status = 'failed', error_msg = ?, completed_at = (unixepoch('now') * 1000)
       WHERE id = ?`,
    )
    .bind(error_msg, id)
    .run();
}

export async function getBackupById(db: D1Database, id: string): Promise<BackupRow | null> {
  return db.prepare(`SELECT * FROM backups WHERE id = ?`).bind(id).first<BackupRow>();
}

export async function listBackupsByTenant(
  db: D1Database,
  tenant_id: string,
  cursor?: number,
  limit = 20,
): Promise<BackupRow[]> {
  const cutoff = cursor ?? Date.now() + 1000;
  const rows = await db
    .prepare(
      `SELECT * FROM backups
       WHERE tenant_id = ? AND created_at < ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(tenant_id, cutoff, limit + 1)
    .all<BackupRow>();
  return rows.results;
}

export async function listAllBackups(
  db: D1Database,
  cursor?: number,
  limit = 20,
): Promise<BackupRow[]> {
  const cutoff = cursor ?? Date.now() + 1000;
  const rows = await db
    .prepare(
      `SELECT * FROM backups
       WHERE created_at < ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(cutoff, limit + 1)
    .all<BackupRow>();
  return rows.results;
}

export async function deleteBackup(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM backups WHERE id = ?`).bind(id).run();
}

export async function getLastDoneBackupByTenant(
  db: D1Database,
  tenant_id: string,
): Promise<BackupRow | null> {
  return db
    .prepare(
      `SELECT * FROM backups
       WHERE tenant_id = ? AND status = 'done'
       ORDER BY completed_at DESC
       LIMIT 1`,
    )
    .bind(tenant_id)
    .first<BackupRow>();
}

export async function deleteOldBackups(
  db: D1Database,
  tenant_id: string,
  cutoff_ms: number,
): Promise<{ deleted: string[] }> {
  const rows = await db
    .prepare(
      `SELECT id, r2_key FROM backups
       WHERE tenant_id = ? AND status = 'done' AND completed_at < ?`,
    )
    .bind(tenant_id, cutoff_ms)
    .all<{ id: string; r2_key: string | null }>();

  const ids = rows.results.map((r: { id: string; r2_key: string | null }) => r.id);
  if (ids.length > 0) {
    // Delete individually (D1 não suporta IN com array bind nativo)
    for (const id of ids) {
      await db.prepare(`DELETE FROM backups WHERE id = ?`).bind(id).run();
    }
  }
  return {
    deleted: rows.results.map((r: { id: string; r2_key: string | null }) => r.r2_key ?? r.id),
  };
}

// ── Auto Config ──────────────────────────────────────────────────────────────

export async function getAutoConfig(
  db: D1Database,
  tenant_id: string,
): Promise<BackupAutoConfigRow | null> {
  return db
    .prepare(`SELECT * FROM backup_auto_config WHERE tenant_id = ?`)
    .bind(tenant_id)
    .first<BackupAutoConfigRow>();
}

export async function upsertAutoConfig(
  db: D1Database,
  tenant_id: string,
  data: Partial<Omit<BackupAutoConfigRow, "tenant_id" | "created_at" | "updated_at">>,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO backup_auto_config (tenant_id, enabled, frequency, day_of_week, retention_days)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         enabled        = excluded.enabled,
         frequency      = excluded.frequency,
         day_of_week    = excluded.day_of_week,
         retention_days = excluded.retention_days,
         updated_at     = (unixepoch('now') * 1000)`,
    )
    .bind(
      tenant_id,
      data.enabled ?? 0,
      data.frequency ?? "weekly",
      data.day_of_week ?? 0,
      data.retention_days ?? 30,
    )
    .run();
}

export async function listAllAutoConfigs(db: D1Database): Promise<BackupAutoConfigRow[]> {
  const rows = await db
    .prepare(`SELECT * FROM backup_auto_config WHERE enabled = 1`)
    .all<BackupAutoConfigRow>();
  return rows.results;
}
