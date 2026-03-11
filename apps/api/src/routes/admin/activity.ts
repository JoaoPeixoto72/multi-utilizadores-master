/**
 * routes/admin/activity.ts — Rotas de histórico de actividade (admin) (M9)
 *
 * R: BUILD_PLAN.md §M9.4
 * R: briefing.md §3.9 — cleanHistory exige backup < 60 min
 *
 * Endpoints:
 *   GET    /api/admin/activity        — lista actividades (cursor, filtros)
 *   DELETE /api/admin/activity        — limpar histórico (exige backup < 60 min)
 *   GET    /api/admin/activity/export — exportar CSV
 */

import { Hono } from "hono";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware } from "../../middleware/auth.js";
import { cleanHistory, exportHistory, listActivity } from "../../services/activity-log.service.js";

export const adminActivityRouter = new Hono<{ Bindings: Env }>();

adminActivityRouter.use("/activity", authMiddleware);
adminActivityRouter.use("/activity/*", authMiddleware);

// ── GET /api/admin/activity ────────────────────────────────────────────────────
adminActivityRouter.get("/activity", async (c) => {
  const log = createLogger("admin/activity", getTraceId(c.req.raw));
  const user = c.get("user" as never) as {
    id: string;
    tenant_id: string;
    role: string;
    is_owner: number;
  };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");

  // Apenas owner fixo, owner temporário ou tenant_admin podem ver
  if (user.role !== "tenant_admin" && !user.is_owner) {
    return problemResponse(c, 403, "FORBIDDEN", "Acesso restrito a admins");
  }

  try {
    const cursor = c.req.query("cursor") ? Number(c.req.query("cursor")) : undefined;
    const actor_id = c.req.query("actor_id") || undefined;
    const action = c.req.query("action") || undefined;

    const { items, nextCursor } = await listActivity(c.env.DB, {
      tenant_id: user.tenant_id,
      cursor,
      actor_id,
      action,
    });

    return c.json({ items, nextCursor });
  } catch (err) {
    log.error({ err }, "list activity failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao listar actividade");
  }
});

// ── DELETE /api/admin/activity ─────────────────────────────────────────────────
adminActivityRouter.delete("/activity", async (c) => {
  const log = createLogger("admin/activity-delete", getTraceId(c.req.raw));
  const user = c.get("user" as never) as {
    id: string;
    tenant_id: string;
    role: string;
    is_owner: number;
    is_owner_temp: number;
  };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");

  // Apenas owner fixo ou owner temporário podem limpar
  if (!user.is_owner && !user.is_owner_temp) {
    return problemResponse(c, 403, "FORBIDDEN", "Apenas owner pode limpar o histórico");
  }

  try {
    const { deleted } = await cleanHistory(c.env.DB, user.tenant_id);
    return c.json({ success: true, deleted });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_RECENT_BACKUP") {
      return problemResponse(
        c,
        409,
        "BACKUP_REQUIRED",
        "É necessário um backup concluído nos últimos 60 minutos antes de limpar o histórico.",
      );
    }
    log.error({ err }, "clean activity failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao limpar histórico");
  }
});

// ── GET /api/admin/activity/export ────────────────────────────────────────────
adminActivityRouter.get("/activity/export", async (c) => {
  const log = createLogger("admin/activity-export", getTraceId(c.req.raw));
  const user = c.get("user" as never) as {
    id: string;
    tenant_id: string;
    role: string;
    is_owner: number;
  };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");
  if (user.role !== "tenant_admin" && !user.is_owner) {
    return problemResponse(c, 403, "FORBIDDEN", "Acesso restrito a admins");
  }

  try {
    const csv = await exportHistory(c.env.DB, user.tenant_id);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activity-${user.tenant_id.slice(0, 8)}-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    log.error({ err }, "export activity failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao exportar histórico");
  }
});
