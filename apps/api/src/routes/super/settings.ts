/**
 * routes/super/settings.ts — Rotas de configuração global (Super User)
 *
 * R: BUILD_PLAN.md
 *
 * Endpoints:
 *   GET   /api/super/settings/config — ler variáveis do app_config
 *   PATCH /api/super/settings/config — actualizar variáveis do app_config
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getAllAppConfig, setManyAppConfig } from "../../db/queries/app-config.js";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { requireSuperUser } from "../../middleware/auth.js";
import { logAuditEvent } from "../../services/audit-log.service.js";

export const superSettingsRouter = new Hono<{ Bindings: Env }>();

// Only require super user for PATCH (writing), not GET (reading)
// The branding colors need to be visible to all users
superSettingsRouter.patch("/settings/config", requireSuperUser);

// Schema de validação flexível para configurações
const updateConfigSchema = z.record(z.string(), z.string());

// ── GET /api/super/settings/config ─────────────────────────────────────────────
superSettingsRouter.get("/settings/config", async (c) => {
  const log = createLogger("super/settings", getTraceId(c.req.raw));

  try {
    const config = await getAllAppConfig(c.env.DB);
    return c.json({ config });
  } catch (err) {
    log.error({ err }, "list app_config failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao listar configurações");
  }
});

// ── PATCH /api/super/settings/config ───────────────────────────────────────────
superSettingsRouter.patch(
  "/settings/config",
  requireSuperUser,
  zValidator("json", updateConfigSchema),
  async (c) => {
    const log = createLogger("super/settings", getTraceId(c.req.raw));
    const user = c.get("user" as never) as { id: string };

    const entries = c.req.valid("json");

    // Prevent empty updates
    if (Object.keys(entries).length === 0) {
      return c.json({ ok: true });
    }

    try {
      await setManyAppConfig(c.env.DB, entries);

      // Audit log
      const keysUpdated = Object.keys(entries);
      await logAuditEvent(c.env.DB, {
        event_type: "app_config.updated",
        actor_id: user.id,
        target_type: "app_config",
        target_id: "global",
        metadata: { keys: keysUpdated },
        count_affected: keysUpdated.length,
      });

      log.info({ actor_id: user.id, keys: keysUpdated }, "app_config_updated");

      return c.json({ ok: true, keys_updated: keysUpdated.length });
    } catch (err) {
      log.error({ err }, "update app_config failed");
      return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao atualizar configurações");
    }
  },
);
