/**
 * services/audit-log.service.ts — Serviço de audit log global (M9)
 *
 * R: BUILD_PLAN.md §M9.2
 * R: migrations/0010_logs.sql
 * REGRA ABSOLUTA: NUNCA guardar dados pessoais (nomes, emails, passwords).
 *                 Apenas IDs, event_type, contagens e bytes.
 */

import {
  type AuditLogRow,
  deleteExpiredAuditLogs,
  getLastBreakGlassDownload,
  type InsertAuditParams,
  insertAuditLog,
  insertBreakGlassLog,
  listAuditLogs,
} from "../db/queries/audit-log.js";
import { createNotification, NOTIFICATION_TYPES } from "./notification.service.js";

export type { AuditLogRow };

// ── logAuditEvent ─────────────────────────────────────────────────────────────

export async function logAuditEvent(db: D1Database, params: InsertAuditParams): Promise<void> {
  try {
    await insertAuditLog(db, params);
  } catch {
    // Nunca bloquear a operação principal
  }
}

// ── listAudit ─────────────────────────────────────────────────────────────────

export async function listAudit(
  db: D1Database,
  opts: {
    cursor?: number;
    event_type?: string;
    tenant_id?: string;
    limit?: number;
  },
): Promise<{ items: AuditLogRow[]; nextCursor: number | null }> {
  return listAuditLogs(db, opts);
}

// ── cleanExpiredAuditLogs (chamado pelo cron em M13) ──────────────────────────

export async function cleanExpiredAuditLogs(db: D1Database): Promise<{ deleted: number }> {
  const deleted = await deleteExpiredAuditLogs(db);
  return { deleted };
}

// ── generateBreakGlass ────────────────────────────────────────────────────────
// Gera ficheiro de emergência com token válido 15 min.
// Regista no break_glass_log e notifica super user se > 30 dias sem download.

export async function generateBreakGlass(
  db: D1Database,
  actorId: string,
  appUrl: string,
  dbName: string,
): Promise<{ content: string; filename: string; notified: boolean }> {
  // Token de emergência: base64 de bytes aleatórios, válido 15 min
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...rawBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const content = JSON.stringify(
    {
      app_url: appUrl,
      db_name: dbName,
      emergency_token: token,
      expires_at: expiresAt,
      generated_at: new Date().toISOString(),
      generated_by: actorId,
      warning:
        "This file contains sensitive emergency credentials. Store securely and delete after use.",
    },
    null,
    2,
  );

  const filename = `break-glass-${new Date().toISOString().slice(0, 10)}.json`;

  // Registar download
  await insertBreakGlassLog(db, actorId);

  // Verificar se notificar (> 30 dias sem download)
  let notified = false;
  const lastDownload = await getLastBreakGlassDownload(db);
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

  if (!lastDownload || lastDownload < thirtyDaysAgo) {
    // Notificar o próprio super user
    try {
      await createNotification(db, {
        userId: actorId,
        tenantId: null,
        type: NOTIFICATION_TYPES.BREAK_GLASS_DOWNLOADED,
        titleKey: "notification.break_glass.title",
        bodyKey: "notification.break_glass.body",
        params: { date: new Date().toISOString() },
      });
      notified = true;
    } catch {
      // Não bloquear
    }
  }

  return { content, filename, notified };
}
