/**
 * routes/super/audit.ts — Rotas de audit log + break-glass (super user) (M9)
 *
 * R: BUILD_PLAN.md §M9.3, §M9.4
 *
 * Endpoints:
 *   GET /api/super/audit             — audit log global (cursor-based)
 *   GET /api/super/break-glass       — ficheiro de emergência (token 15 min)
 */

import { Hono } from "hono";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware } from "../../middleware/auth.js";
import { generateBreakGlass, listAudit } from "../../services/audit-log.service.js";

export const superAuditRouter = new Hono<{ Bindings: Env }>();

superAuditRouter.use("/audit", authMiddleware);
superAuditRouter.use("/audit/*", authMiddleware);
superAuditRouter.use("/break-glass", authMiddleware);
superAuditRouter.use("/break-glass/*", authMiddleware);

// ── GET /api/super/audit ──────────────────────────────────────────────────────
superAuditRouter.get("/audit", async (c) => {
  const log = createLogger("super/audit", getTraceId(c.req.raw));
  const user = c.get("user" as never) as { id: string; role: string };

  if (user.role !== "super_user") {
    return problemResponse(c, 403, "FORBIDDEN", "Apenas super user");
  }

  try {
    const cursor = c.req.query("cursor") ? Number(c.req.query("cursor")) : undefined;
    const event_type = c.req.query("event_type") || undefined;
    const tenant_id = c.req.query("tenant_id") || undefined;

    const { items, nextCursor } = await listAudit(c.env.DB, {
      cursor,
      event_type,
      tenant_id,
    });

    return c.json({ items, nextCursor });
  } catch (err) {
    log.error({ err }, "list audit failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao listar audit log");
  }
});

// ── GET /api/super/break-glass ────────────────────────────────────────────────
superAuditRouter.get("/break-glass", async (c) => {
  const log = createLogger("super/break-glass", getTraceId(c.req.raw));
  const user = c.get("user" as never) as { id: string; role: string };

  if (user.role !== "super_user") {
    return problemResponse(c, 403, "FORBIDDEN", "Apenas super user");
  }

  try {
    const appUrl = new URL(c.req.url).origin;
    const { content, filename, notified } = await generateBreakGlass(
      c.env.DB,
      user.id,
      appUrl,
      "cf-base-db",
    );

    log.info({ notified }, "break-glass downloaded");

    return new Response(content, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Notified-Super-User": notified ? "true" : "false",
      },
    });
  } catch (err) {
    log.error({ err }, "break-glass generation failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao gerar ficheiro break-glass");
  }
});
