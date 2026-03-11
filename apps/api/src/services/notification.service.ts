/**
 * services/notification.service.ts — Serviço de notificações (M6)
 *
 * R: BUILD_PLAN.md §M6.2, §M6.3
 * R: briefing.md §3.4
 * R: migrations/0007_notifications.sql
 *
 * Tipos de notificação suportados:
 *   invite_accepted      — convite aceite (notifica admins)
 *   invite_expired       — convite expirado (notifica criador)
 *   elevation_granted    — elevação temporária concedida (notifica sócio)
 *   elevation_expired    — elevação expirada (notifica sócio)
 *   elevation_revoked    — elevação revogada (notifica sócio)
 *   delete_requested     — pedido de eliminação (notifica super_user)
 *   email_change_confirm — confirmação de alteração de email (notifica utilizador)
 */

import {
  countUnreadByUser,
  deleteExpiredNotifications,
  deleteNotificationById,
  deleteAllNotificationsByUser,
  getNotificationById,
  insertNotification,
  listNotificationsByUser,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "../db/queries/notifications.js";

// Re-exportar tipos para routes
export type { NotificationRow };

// ── Tipos de notificação ──────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = {
  INVITE_ACCEPTED: "invite_accepted",
  INVITE_SENT: "invite_sent",
  INVITE_CANCELLED: "invite_cancelled",
  USER_DEACTIVATED: "user_deactivated",
  USER_DELETED: "user_deleted",
  INVITE_EXPIRED: "invite_expired",
  ELEVATION_GRANTED: "elevation_granted",
  ELEVATION_EXPIRED: "elevation_expired",
  ELEVATION_REVOKED: "elevation_revoked",
  DELETE_REQUESTED: "delete_requested",
  EMAIL_CHANGE_CONFIRM: "email_change_confirm",
  TENANT_ACTIVATED: "tenant_activated",
  TENANT_DEACTIVATED: "tenant_deactivated",
  BACKUP_DONE: "backup_done",
  BACKUP_FAILED: "backup_failed",
  BREAK_GLASS_DOWNLOADED: "break_glass_downloaded",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ── Erros ─────────────────────────────────────────────────────────────────────

export interface NotificationServiceError {
  code: string;
  status: number;
  message: string;
}

function err(code: string, status: number, message: string): NotificationServiceError {
  return { code, status, message };
}

// ── Criar notificação individual ─────────────────────────────────────────────

export async function createNotification(
  db: D1Database,
  opts: {
    userId: string;
    tenantId?: string | null;
    type: NotificationType;
    titleKey: string;
    bodyKey: string;
    params?: Record<string, string | number> | null;
    link?: string | null;
    expiresAt?: string | null;
  },
): Promise<string> {
  return insertNotification(db, {
    user_id: opts.userId,
    tenant_id: opts.tenantId ?? null,
    type: opts.type,
    title_key: opts.titleKey,
    body_key: opts.bodyKey,
    params: opts.params ?? null,
    link: opts.link ?? null,
    expires_at: opts.expiresAt ?? null,
  });
}

// ── Notificar todos os admins de um tenant ────────────────────────────────────

export async function notifyAdmins(
  db: D1Database,
  tenantId: string,
  opts: {
    type: NotificationType;
    titleKey: string;
    bodyKey: string;
    params?: Record<string, string | number> | null;
    link?: string | null;
  },
): Promise<void> {
  // Buscar todos os utilizadores admin/owner ativos do tenant
  const admins = await db
    .prepare(
      `SELECT id FROM users
       WHERE tenant_id = ? AND status = 'active'
         AND (is_owner = 1 OR is_temp_owner = 1 OR role = 'tenant_admin' OR role = 'member')`,
    )
    .bind(tenantId)
    .all<{ id: string }>();

  const rows = admins.results ?? [];
  await Promise.all(
    rows.map((admin: { id: string }) =>
      createNotification(db, {
        userId: admin.id,
        tenantId,
        type: opts.type,
        titleKey: opts.titleKey,
        bodyKey: opts.bodyKey,
        params: opts.params ?? null,
        link: opts.link ?? null,
      }),
    ),
  );
}

// ── Notificar owner(s) de um tenant ──────────────────────────────────────────

export async function notifyOwners(
  db: D1Database,
  tenantId: string,
  opts: {
    type: NotificationType;
    titleKey: string;
    bodyKey: string;
    params?: Record<string, string | number> | null;
    link?: string | null;
  },
): Promise<void> {
  const owners = await db
    .prepare(
      `SELECT id FROM users
       WHERE tenant_id = ? AND status = 'active'
         AND (is_owner = 1 OR is_temp_owner = 1)`,
    )
    .bind(tenantId)
    .all<{ id: string }>();

  const rows = owners.results ?? [];
  await Promise.all(
    rows.map((owner: { id: string }) =>
      createNotification(db, {
        userId: owner.id,
        tenantId,
        type: opts.type,
        titleKey: opts.titleKey,
        bodyKey: opts.bodyKey,
        params: opts.params ?? null,
        link: opts.link ?? null,
      }),
    ),
  );
}

// ── Notificar super_users ─────────────────────────────────────────────────────

export async function notifySuperUsers(
  db: D1Database,
  opts: {
    type: NotificationType;
    titleKey: string;
    bodyKey: string;
    params?: Record<string, string | number> | null;
    link?: string | null;
  },
): Promise<void> {
  const supers = await db
    .prepare(`SELECT id FROM users WHERE role = 'super_user' AND status = 'active'`)
    .all<{ id: string }>();

  const rows = supers.results ?? [];
  await Promise.all(
    rows.map((su: { id: string }) =>
      createNotification(db, {
        userId: su.id,
        tenantId: null,
        type: opts.type,
        titleKey: opts.titleKey,
        bodyKey: opts.bodyKey,
        params: opts.params ?? null,
        link: opts.link ?? null,
      }),
    ),
  );
}

// ── Listar notificações do utilizador ────────────────────────────────────────

export async function listNotifications(
  db: D1Database,
  userId: string,
  opts: { cursor?: string; unreadOnly?: boolean },
): Promise<{ notifications: NotificationRow[]; nextCursor: string | null; unreadCount: number }> {
  const [{ rows, nextCursor }, unreadCount] = await Promise.all([
    listNotificationsByUser(db, userId, {
      cursor: opts.cursor,
      limit: 20,
      unreadOnly: opts.unreadOnly,
    }),
    countUnreadByUser(db, userId),
  ]);
  return { notifications: rows, nextCursor, unreadCount };
}

// ── Contagem de não lidas ─────────────────────────────────────────────────────

export async function getUnreadCount(db: D1Database, userId: string): Promise<number> {
  return countUnreadByUser(db, userId);
}

// ── Marcar como lida ──────────────────────────────────────────────────────────

export async function readNotification(
  db: D1Database,
  notifId: string,
  userId: string,
): Promise<void> {
  const notif = await getNotificationById(db, notifId);
  if (!notif) throw err("not_found", 404, "Notificação não encontrada.");
  if (notif.user_id !== userId) throw err("forbidden", 403, "Sem permissão.");
  await markNotificationRead(db, notifId, userId);
}

// ── Marcar todas como lidas ───────────────────────────────────────────────────

export async function readAllNotifications(db: D1Database, userId: string): Promise<number> {
  return markAllNotificationsRead(db, userId);
}

// ── Cleanup (cron) ────────────────────────────────────────────────────────────

export async function cleanupExpiredNotifications(db: D1Database): Promise<number> {
  return deleteExpiredNotifications(db);
}

// ── Eliminar notificação individual ──────────────────────────────────────────

export async function deleteNotification(
  db: D1Database,
  notifId: string,
  userId: string,
): Promise<void> {
  const notif = await getNotificationById(db, notifId);
  if (!notif) throw err("not_found", 404, "Notificação não encontrada.");
  if (notif.user_id !== userId) throw err("forbidden", 403, "Sem permissão.");
  await deleteNotificationById(db, notifId, userId);
}

// ── Eliminar todas as notificações do utilizador ──────────────────────────────

export async function deleteAllNotifications(db: D1Database, userId: string): Promise<number> {
  return deleteAllNotificationsByUser(db, userId);
}
