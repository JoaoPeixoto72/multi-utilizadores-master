/**
 * routes/user/notifications.ts — Rotas de notificações para utilizadores autenticados (M6)
 *
 * R: BUILD_PLAN.md §M6.2
 * R: STACK_LOCK.md §5 — auth obrigatório; IDOR pelo userId da sessão
 *
 * Endpoints:
 *   GET    /api/user/notifications           — lista paginada (cursor-based)
 *   GET    /api/user/notifications/unread-count — badge count
 *   PATCH  /api/user/notifications/:id/read  — marcar uma como lida
 *   POST   /api/user/notifications/read-all  — marcar todas como lidas
 */

import { Hono } from "hono";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  deleteAllNotifications,
  deleteNotification,
  getUnreadCount,
  listNotifications,
  type NotificationServiceError,
  readAllNotifications,
  readNotification,
} from "../../services/notification.service.js";

export const notificationsRouter = new Hono<{ Bindings: Env }>();

// Todos os endpoints requerem sessão
notificationsRouter.use("/*", authMiddleware);

// ── GET /api/user/notifications ───────────────────────────────────────────────
notificationsRouter.get("/", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("notifications/list", getTraceId(c.req.raw));
  const cursor = c.req.query("cursor") ?? undefined;
  const unreadOnly = c.req.query("unread") === "1";

  try {
    const result = await listNotifications(c.env.DB, sessionUser.id, { cursor, unreadOnly });
    return c.json(result);
  } catch (err) {
    const e = err as NotificationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "notifications_list_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── GET /api/user/notifications/unread-count ─────────────────────────────────
notificationsRouter.get("/unread-count", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("notifications/unread", getTraceId(c.req.raw));

  try {
    const count = await getUnreadCount(c.env.DB, sessionUser.id);
    return c.json({ count });
  } catch (err) {
    log.error({ user_id: sessionUser.id, err: String(err) }, "unread_count_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── PATCH /api/user/notifications/:id/read ───────────────────────────────────
notificationsRouter.patch("/:id/read", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("notifications/read", getTraceId(c.req.raw));
  const notifId = c.req.param("id");

  try {
    await readNotification(c.env.DB, notifId, sessionUser.id);
    log.info({ user_id: sessionUser.id, notif_id: notifId }, "notification_read");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as NotificationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error(
      { user_id: sessionUser.id, notif_id: notifId, err: String(err) },
      "notification_read_error",
    );
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/user/notifications/read-all ────────────────────────────────────
notificationsRouter.post("/read-all", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("notifications/read-all", getTraceId(c.req.raw));

  try {
    const changed = await readAllNotifications(c.env.DB, sessionUser.id);
    log.info({ user_id: sessionUser.id, changed }, "all_notifications_read");
    return c.json({ ok: true, changed });
  } catch (err) {
    log.error({ user_id: sessionUser.id, err: String(err) }, "read_all_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── DELETE /api/user/notifications/:id ───────────────────────────────────────
notificationsRouter.delete("/:id", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("notifications/delete", getTraceId(c.req.raw));
  const notifId = c.req.param("id");

  try {
    await deleteNotification(c.env.DB, notifId, sessionUser.id);
    log.info({ user_id: sessionUser.id, notif_id: notifId }, "notification_deleted");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as NotificationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error(
      { user_id: sessionUser.id, notif_id: notifId, err: String(err) },
      "notification_delete_error",
    );
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── DELETE /api/user/notifications ───────────────────────────────────────────
notificationsRouter.delete("/", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("notifications/delete-all", getTraceId(c.req.raw));

  try {
    const deleted = await deleteAllNotifications(c.env.DB, sessionUser.id);
    log.info({ user_id: sessionUser.id, deleted }, "all_notifications_deleted");
    return c.json({ ok: true, deleted });
  } catch (err) {
    log.error({ user_id: sessionUser.id, err: String(err) }, "delete_all_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});
