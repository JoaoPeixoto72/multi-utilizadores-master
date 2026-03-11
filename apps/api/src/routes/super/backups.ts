/**
 * routes/super/backups.ts — Rotas de backups (super user) (M8)
 *
 * R: BUILD_PLAN.md §M8.3
 *
 * Endpoints:
 *   GET  /api/super/backups         — listar todos os backups
 *   POST /api/super/backups/import  — importar backup ZIP para empresa
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { requireSuperUser } from "../../middleware/auth.js";
import { importBackup, listAllBackups } from "../../services/backup.service.js";

export const superBackupsRouter = new Hono<{ Bindings: Env }>();

superBackupsRouter.use("/backups", requireSuperUser);
superBackupsRouter.use("/backups/*", requireSuperUser);

// ── GET /api/super/backups ─────────────────────────────────────────────────────
superBackupsRouter.get("/backups", async (c) => {
  const log = createLogger("super/backups", getTraceId(c.req.raw));

  try {
    const cursor = c.req.query("cursor") ? Number(c.req.query("cursor")) : undefined;
    const rows = await listAllBackups(c.env.DB, cursor);
    const limit = 20;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;
    return c.json({ items, nextCursor });
  } catch (err) {
    log.error({ err }, "super list backups failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao listar backups");
  }
});

// ── POST /api/super/backups/import ─────────────────────────────────────────────
const importSchema = z.object({
  r2_key: z.string().min(1),
  target_tenant_id: z.string().min(1),
});

superBackupsRouter.post("/backups/import", zValidator("json", importSchema), async (c) => {
  const log = createLogger("super/backups", getTraceId(c.req.raw));
  const user = c.get("user" as never) as { id: string };

  const { r2_key, target_tenant_id } = c.req.valid("json");

  try {
    const result = await importBackup(c.env.DB, c.env.R2_BUCKET, r2_key, target_tenant_id, user.id);
    return c.json(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao importar backup";
    log.error({ err }, "import backup failed");
    return problemResponse(c, 500, "IMPORT_FAILED", msg);
  }
});
