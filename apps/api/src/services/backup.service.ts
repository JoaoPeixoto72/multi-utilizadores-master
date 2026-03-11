/**
 * services/backup.service.ts — Serviço de backups por empresa (M8)
 *
 * R: BUILD_PLAN.md §M8.2
 * R: briefing.md §3.6 — backups: db_only (dados D1) ou full (dados D1 + lista R2)
 *
 * Implementação síncrona (sem Queue — Queue está comentada no wrangler.toml).
 * Para empresas grandes, o cron processa automaticamente via scheduleAutoBackup().
 *
 * Formato do backup ZIP (JSON comprimido → R2):
 *   backups/{tenant_id}/{backup_id}.json
 *
 * Conteúdo do JSON:
 *   { version, backup_id, tenant_id, type, created_at, tables: { [table]: rows[] }, r2_keys: string[] }
 */

import {
  type BackupRow,
  deleteBackup,
  deleteOldBackups,
  getAutoConfig,
  getBackupById,
  getLastDoneBackupByTenant,
  insertBackup,
  listAllAutoConfigs,
  listBackupsByTenant,
  updateBackupDone,
  updateBackupFailed,
  updateBackupRunning,
  upsertAutoConfig,
} from "../db/queries/backups.js";
import { createNotification, NOTIFICATION_TYPES } from "./notification.service.js";

// Re-exportar tipos para routes
export type { BackupRow };

// ── Constantes ─────────────────────────────────────────────────────────────────

const BACKUP_TABLES = [
  "users",
  "sessions",
  "tenants",
  "invitations",
  "tenant_module_limits",
  "tenant_storage_usage",
  "tenant_daily_email_count",
  "notifications",
  "integrations",
  "backups",
  "backup_auto_config",
] as const;

const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

function generateId(): string {
  return crypto.randomUUID();
}

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface BackupManifest {
  version: "1.0";
  backup_id: string;
  tenant_id: string;
  type: "db_only" | "full";
  created_at: number;
  tables: Record<string, unknown[]>;
  r2_keys: string[];
}

export interface BackupAutoConfigPublic {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number;
  retention_days: number;
}

// ── Helpers internos ───────────────────────────────────────────────────────────

async function dumpTenantTables(
  db: D1Database,
  tenant_id: string,
): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {};

  for (const table of BACKUP_TABLES) {
    // app_config e password_resets não são por tenant
    let query: string;
    if (table === "sessions" || table === "notifications") {
      // Filtrar por utilizadores do tenant
      query = `SELECT * FROM ${table} WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)`;
    } else if (
      table === "tenant_module_limits" ||
      table === "tenant_storage_usage" ||
      table === "tenant_daily_email_count" ||
      table === "backup_auto_config"
    ) {
      query = `SELECT * FROM ${table} WHERE tenant_id = ?`;
    } else if (table === "invitations" || table === "backups") {
      query = `SELECT * FROM ${table} WHERE tenant_id = ?`;
    } else if (table === "users") {
      query = `SELECT * FROM ${table} WHERE tenant_id = ?`;
    } else if (table === "tenants") {
      query = `SELECT * FROM ${table} WHERE id = ?`;
    } else if (table === "integrations") {
      // integrações são globais (super) — não incluir em backup de tenant
      tables[table] = [];
      continue;
    } else {
      tables[table] = [];
      continue;
    }

    const result = await db.prepare(query).bind(tenant_id).all<unknown>();
    tables[table] = result.results;
  }

  return tables;
}

async function listTenantR2Keys(r2: R2Bucket, tenant_id: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const list = await r2.list({
      prefix: `tenants/${tenant_id}/`,
      cursor,
      limit: 1000,
    });
    for (const obj of list.objects) {
      keys.push(obj.key);
    }
    // Adicionar ficheiros de utilizadores do tenant não é trivial sem query;
    // listar apenas ficheiros do tenant (logos, etc.)
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  return keys;
}

// ── API pública ────────────────────────────────────────────────────────────────

export async function generateBackup(
  db: D1Database,
  r2: R2Bucket,
  tenant_id: string,
  type: "db_only" | "full",
  created_by: string,
): Promise<BackupRow> {
  const backup_id = generateId();

  await insertBackup(db, { id: backup_id, tenant_id, type, created_by });
  await updateBackupRunning(db, backup_id);

  try {
    const tables = await dumpTenantTables(db, tenant_id);
    const r2_keys = type === "full" ? await listTenantR2Keys(r2, tenant_id) : [];

    const manifest: BackupManifest = {
      version: "1.0",
      backup_id,
      tenant_id,
      type,
      created_at: Date.now(),
      tables,
      r2_keys,
    };

    const json = JSON.stringify(manifest);
    const bytes = new TextEncoder().encode(json);
    const r2_key = `backups/${tenant_id}/${backup_id}.json`;

    await r2.put(r2_key, bytes, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { backup_id, tenant_id, type },
    });

    const download_expires_at = Date.now() + DOWNLOAD_TTL_MS;

    await updateBackupDone(db, backup_id, {
      r2_key,
      size_bytes: bytes.byteLength,
      download_expires_at,
    });

    // Notificar o utilizador que criou
    await createNotification(db, {
      userId: created_by,
      tenantId: tenant_id,
      type: NOTIFICATION_TYPES.BACKUP_DONE,
      titleKey: "notification.backup_done.title",
      bodyKey: "notification.backup_done.body",
      params: { backup_id, type },
      link: "/backups",
    });

    const row = await getBackupById(db, backup_id);
    return row!;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateBackupFailed(db, backup_id, msg);
    throw err;
  }
}

export async function getBackupDownloadUrl(_r2: R2Bucket, backup: BackupRow): Promise<string> {
  if (!backup.r2_key) throw new Error("Backup sem r2_key");
  if (!backup.download_expires_at || Date.now() >= backup.download_expires_at) {
    throw new Error("Link de download expirado");
  }
  // R2 presigned URL (signed R2 não está disponível no Workers sem R2 API token)
  // Devolvemos a chave — o cliente fará download via endpoint API (streaming proxy)
  return backup.r2_key;
}

export async function streamBackupFromR2(
  r2: R2Bucket,
  r2_key: string,
): Promise<ReadableStream | null> {
  const obj = await r2.get(r2_key);
  if (!obj) return null;
  return obj.body;
}

export async function removeBackup(
  db: D1Database,
  r2: R2Bucket,
  backup_id: string,
  tenant_id: string,
): Promise<void> {
  const backup = await getBackupById(db, backup_id);
  if (!backup || backup.tenant_id !== tenant_id) {
    throw new Error("Backup não encontrado");
  }
  if (backup.r2_key) {
    await r2.delete(backup.r2_key);
  }
  await deleteBackup(db, backup_id);
}

// Exposta para M9 — verificar se existe backup recente (< 60 min)
export async function hasRecentBackup(
  db: D1Database,
  tenant_id: string,
  max_age_ms = 60 * 60 * 1000,
): Promise<boolean> {
  const last = await getLastDoneBackupByTenant(db, tenant_id);
  if (!last || !last.completed_at) return false;
  return Date.now() - last.completed_at < max_age_ms;
}

export async function listBackups(
  db: D1Database,
  tenant_id: string,
  cursor?: number,
  limit = 20,
): Promise<{ items: BackupRow[]; nextCursor: number | null }> {
  const rows = await listBackupsByTenant(db, tenant_id, cursor, limit);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;
  return { items, nextCursor };
}

export async function importBackup(
  db: D1Database,
  r2: R2Bucket,
  r2_key: string,
  target_tenant_id: string,
  requested_by: string,
): Promise<{ tables_restored: string[]; rows_total: number }> {
  const obj = await r2.get(r2_key);
  if (!obj) throw new Error("Ficheiro de backup não encontrado em R2");

  const text = await obj.text();
  const manifest = JSON.parse(text) as BackupManifest;

  if (manifest.version !== "1.0") throw new Error("Versão de backup não suportada");

  const tables_restored: string[] = [];
  let rows_total = 0;

  // Restaurar apenas dados de utilizadores e convites (não sessões, não backups)
  const RESTORE_TABLES = ["users", "invitations", "tenant_module_limits"] as const;

  for (const table of RESTORE_TABLES) {
    const rows = manifest.tables[table] as Record<string, unknown>[] | undefined;
    if (!rows || rows.length === 0) continue;

    for (const row of rows) {
      // Remapear tenant_id para target
      const data = { ...row, tenant_id: target_tenant_id };
      const cols = Object.keys(data);
      const placeholders = cols.map(() => "?").join(", ");
      const values = Object.values(data);

      await db
        .prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`)
        .bind(...values)
        .run();

      rows_total++;
    }

    tables_restored.push(table);
  }

  // Criar entrada de backup do import para rastreio
  const backup_id = generateId();
  await insertBackup(db, {
    id: backup_id,
    tenant_id: target_tenant_id,
    type: manifest.type,
    created_by: requested_by,
  });
  await updateBackupDone(db, backup_id, {
    r2_key,
    size_bytes: text.length,
    download_expires_at: Date.now() + DOWNLOAD_TTL_MS,
  });

  return { tables_restored, rows_total };
}

export async function getAutoBackupConfig(
  db: D1Database,
  tenant_id: string,
): Promise<BackupAutoConfigPublic> {
  const row = await getAutoConfig(db, tenant_id);
  return {
    enabled: !!row?.enabled,
    frequency: row?.frequency ?? "weekly",
    day_of_week: row?.day_of_week ?? 0,
    retention_days: row?.retention_days ?? 30,
  };
}

export async function setAutoBackupConfig(
  db: D1Database,
  tenant_id: string,
  config: Partial<BackupAutoConfigPublic>,
): Promise<BackupAutoConfigPublic> {
  await upsertAutoConfig(db, tenant_id, {
    enabled: config.enabled ? 1 : 0,
    frequency: config.frequency,
    day_of_week: config.day_of_week,
    retention_days: config.retention_days,
  });
  return getAutoBackupConfig(db, tenant_id);
}

// Cron — chamado pelo Worker scheduled handler (0 0 * * *)
export async function scheduleAutoBackup(
  db: D1Database,
  r2: R2Bucket,
): Promise<{ processed: number; errors: number }> {
  const configs = await listAllAutoConfigs(db);
  const now = new Date();
  let processed = 0;
  let errors = 0;

  for (const cfg of configs) {
    if (!cfg.enabled) continue;

    // Verificar se hoje é o dia certo
    const dayOk =
      cfg.frequency === "daily" ||
      (cfg.frequency === "weekly" && now.getUTCDay() === cfg.day_of_week) ||
      (cfg.frequency === "monthly" && now.getUTCDate() === 1);

    if (!dayOk) continue;

    try {
      await generateBackup(db, r2, cfg.tenant_id, "db_only", "system_cron");

      // Limpar backups antigos
      const cutoff = Date.now() - cfg.retention_days * 24 * 60 * 60 * 1000;
      const { deleted } = await deleteOldBackups(db, cfg.tenant_id, cutoff);
      // Limpar também do R2
      for (const key of deleted) {
        if (key.startsWith("backups/")) {
          await r2.delete(key).catch(() => undefined);
        }
      }

      processed++;
    } catch {
      errors++;
    }
  }

  return { processed, errors };
}

// Listar todos os backups (super user) — re-exportado para routes
export { listAllBackups } from "../db/queries/backups.js";
