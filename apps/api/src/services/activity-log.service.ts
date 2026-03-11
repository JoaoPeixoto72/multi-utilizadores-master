/**
 * services/activity-log.service.ts — Serviço de histórico de actividade (M9)
 *
 * R: BUILD_PLAN.md §M9.2
 * R: briefing.md §3.9 — cleanHistory exige backup < 60 min
 * R: migrations/0010_logs.sql
 */

import {
  type ActivityLogRow,
  deleteActivityLogByTenant,
  exportActivityLogByTenant,
  type InsertActivityParams,
  insertActivityLog,
  listActivityLogs,
} from "../db/queries/activity-log.js";
import { getLastDoneBackupByTenant } from "../db/queries/backups.js";

export type { ActivityLogRow };

// ── logAction ─────────────────────────────────────────────────────────────────

export async function logAction(db: D1Database, params: InsertActivityParams): Promise<void> {
  try {
    await insertActivityLog(db, params);
  } catch {
    // Nunca deixar falha de log bloquear a operação principal
  }
}

// ── listActivity ──────────────────────────────────────────────────────────────

export async function listActivity(
  db: D1Database,
  opts: {
    tenant_id: string;
    cursor?: number;
    actor_id?: string;
    action?: string;
    limit?: number;
  },
): Promise<{ items: ActivityLogRow[]; nextCursor: number | null }> {
  return listActivityLogs(db, opts);
}

// ── cleanHistory ──────────────────────────────────────────────────────────────
// Limpa histórico de actividade de uma empresa.
// Pré-condição: deve existir um backup concluído nos últimos 60 minutos.

export async function cleanHistory(
  db: D1Database,
  tenant_id: string,
): Promise<{ deleted: number }> {
  const lastBackup = await getLastDoneBackupByTenant(db, tenant_id);

  if (!lastBackup || !lastBackup.completed_at) {
    throw new Error("NO_RECENT_BACKUP");
  }

  const sixtyMinAgo = Math.floor(Date.now() / 1000) - 3600;
  if (lastBackup.completed_at < sixtyMinAgo) {
    throw new Error("NO_RECENT_BACKUP");
  }

  const deleted = await deleteActivityLogByTenant(db, tenant_id);
  return { deleted };
}

// ── exportHistory ─────────────────────────────────────────────────────────────
// Exporta histórico em formato CSV (retorna string CSV).

export async function exportHistory(db: D1Database, tenant_id: string): Promise<string> {
  const rows = await exportActivityLogByTenant(db, tenant_id);

  const header =
    "id,actor_id,actor_name,action,target_type,target_id,target_name,was_temp_owner,created_at\n";

  const lines = rows
    .map((r) =>
      [
        r.id,
        r.actor_id,
        `"${r.actor_name.replace(/"/g, '""')}"`,
        r.action,
        r.target_type ?? "",
        r.target_id ?? "",
        `"${(r.target_name ?? "").replace(/"/g, '""')}"`,
        r.was_temp_owner,
        r.created_at,
      ].join(","),
    )
    .join("\n");

  return header + lines;
}
