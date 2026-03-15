/**
 * routes/admin/backups.ts — Rotas de backups (admin) (M8)
 *
 * R: BUILD_PLAN.md §M8.3
 * R: briefing.md §3.8 — apenas owner fixo e owner temporário podem criar/configurar
 *
 * Endpoints:
 *   GET    /api/admin/backups              — listar backups da empresa
 *   POST   /api/admin/backups              — criar backup manual
 *   GET    /api/admin/backups/:id/download — stream do ficheiro de backup
 *   DELETE /api/admin/backups/:id          — eliminar backup
 *   GET    /api/admin/backups/config       — ler configuração auto
 *   PATCH  /api/admin/backups/config       — actualizar configuração auto (só owner)
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getBackupById } from "../../db/queries/backups.js";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware } from "../../middleware/auth.js";
import { logAction } from "../../services/activity-log.service.js";
import {
  generateBackup,
  getAutoBackupConfig,
  listBackups,
  removeBackup,
  setAutoBackupConfig,
  streamBackupFromR2,
} from "../../services/backup.service.js";

export const adminBackupsRouter = new Hono<{ Bindings: Env }>();

adminBackupsRouter.use("/backups", authMiddleware);
adminBackupsRouter.use("/backups/*", authMiddleware);

// ── GET /api/admin/backups ─────────────────────────────────────────────────────
adminBackupsRouter.get("/backups", async (c) => {
  const log = createLogger("admin/backups", getTraceId(c.req.raw));
  const user = c.get("user" as never) as { id: string; tenant_id: string; role: string };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");

  try {
    const cursor = c.req.query("cursor") ? Number(c.req.query("cursor")) : undefined;
    const { items, nextCursor } = await listBackups(c.env.DB, user.tenant_id, cursor);
    return c.json({ items, nextCursor });
  } catch (err) {
    log.error({ err }, "list backups failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao listar backups");
  }
});

// ── POST /api/admin/backups ────────────────────────────────────────────────────
const createBackupSchema = z.object({
  type: z.enum(["db_only", "full"]).default("db_only"),
});

adminBackupsRouter.post("/backups", zValidator("json", createBackupSchema), async (c) => {
  const log = createLogger("admin/backups", getTraceId(c.req.raw));
  const user = c.get("user" as never) as {
    id: string;
    tenant_id: string;
    role: string;
    is_owner: number;
    is_temp_owner: number;
    email: string; // Adicionado email para logAction
  };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");

  const isOwner = user.is_owner === 1 || user.is_temp_owner === 1 || user.role === "tenant_admin";
  if (!isOwner) return problemResponse(c, 403, "FORBIDDEN", "Apenas owner pode criar backups");

  const { type } = c.req.valid("json");

  try {
    const backup = await generateBackup(c.env.DB, c.env.R2_BUCKET, user.tenant_id, type, user.id);

    await logAction(c.env.DB, {
      tenant_id: user.tenant_id,
      actor_id: user.id,
      actor_name: user.email ?? "Unknown",
      action: "backup.create",
      target_type: "backup",
      target_id: backup.id,
      was_temp_owner: user.is_temp_owner === 1,
    });

    return c.json(backup, 201);
  } catch (err) {
    log.error({ err }, "create backup failed");
    return problemResponse(c, 500, "BACKUP_FAILED", "Erro ao criar backup");
  }
});

// ── GET /api/admin/backups/config ──────────────────────────────────────────────
adminBackupsRouter.get("/backups/config", async (c) => {
  const log = createLogger("admin/backups", getTraceId(c.req.raw));
  const user = c.get("user" as never) as { tenant_id: string };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");

  try {
    const config = await getAutoBackupConfig(c.env.DB, user.tenant_id);
    return c.json(config);
  } catch (err) {
    log.error({ err }, "get backup config failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao ler configuração");
  }
});

// ── PATCH /api/admin/backups/config ───────────────────────────────────────────
const updateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  retention_days: z.number().int().min(1).max(365).optional(),
});

adminBackupsRouter.patch("/backups/config", zValidator("json", updateConfigSchema), async (c) => {
  const log = createLogger("admin/backups", getTraceId(c.req.raw));
  const user = c.get("user" as never) as {
    id: string;
    tenant_id: string;
    is_owner: number;
    is_temp_owner: number;
  };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");
  if (!user.is_owner && !user.is_temp_owner)
    return problemResponse(c, 403, "FORBIDDEN", "Apenas owner pode configurar backups automáticos");

  const data = c.req.valid("json");

  try {
    const config = await setAutoBackupConfig(c.env.DB, user.tenant_id, data);
    return c.json(config);
  } catch (err) {
    log.error({ err }, "update backup config failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao actualizar configuração");
  }
});

// ── GET /api/admin/backups/:id/download ───────────────────────────────────────
adminBackupsRouter.get("/backups/:id/download", async (c) => {
  const log = createLogger("admin/backups", getTraceId(c.req.raw));
  const user = c.get("user" as never) as {
    tenant_id: string;
    is_owner: number;
    is_temp_owner: number;
  };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");

  const isOwner = user.is_owner === 1 || user.is_temp_owner === 1;
  if (!isOwner)
    return problemResponse(c, 403, "FORBIDDEN", "Apenas owner pode descarregar backups");

  const backup_id = c.req.param("id");

  try {
    const backup = await getBackupById(c.env.DB, backup_id);
    if (!backup || backup.tenant_id !== user.tenant_id)
      return problemResponse(c, 404, "NOT_FOUND", "Backup não encontrado");

    if (backup.status !== "done" || !backup.r2_key)
      return problemResponse(c, 409, "NOT_READY", "Backup ainda não está disponível");

    if (backup.download_expires_at && Date.now() >= backup.download_expires_at)
      return problemResponse(c, 410, "EXPIRED", "Link de download expirado");

    const stream = await streamBackupFromR2(c.env.R2_BUCKET, backup.r2_key);
    if (!stream) return problemResponse(c, 404, "NOT_FOUND", "Ficheiro não encontrado em R2");

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${backup_id}.json"`,
      },
    });
  } catch (err) {
    log.error({ err }, "download backup failed");
    return problemResponse(c, 500, "INTERNAL_ERROR", "Erro ao descarregar backup");
  }
});

// ── DELETE /api/admin/backups/:id ─────────────────────────────────────────────
adminBackupsRouter.delete("/backups/:id", async (c) => {
  const log = createLogger("admin/backups", getTraceId(c.req.raw));
  const user = c.get("user" as never) as {
    tenant_id: string;
    is_owner: number;
    is_temp_owner: number;
    id: string; // Adicionado id e email para logAction
    email: string;
  };

  if (!user.tenant_id) return problemResponse(c, 403, "FORBIDDEN", "Sem empresa");

  const isOwner = user.is_owner === 1 || user.is_temp_owner === 1;
  if (!isOwner) return problemResponse(c, 403, "FORBIDDEN", "Apenas owner pode eliminar backups");

  const backup_id = c.req.param("id");

  try {
    await removeBackup(c.env.DB, c.env.R2_BUCKET, backup_id, user.tenant_id);

    await logAction(c.env.DB, {
      tenant_id: user.tenant_id,
      actor_id: user.id,
      actor_name: user.email ?? "Unknown",
      action: "backup.delete",
      target_type: "backup",
      target_id: backup_id,
      was_temp_owner: user.is_temp_owner === 1,
    });

    return c.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao eliminar backup";
    log.error({ err }, "delete backup failed");
    if (msg === "Backup não encontrado") return problemResponse(c, 404, "NOT_FOUND", msg);
    return problemResponse(c, 500, "INTERNAL_ERROR", msg);
  }
});
