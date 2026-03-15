/**
 * routes/admin/company.ts — Rotas de empresa (M5)
 *
 * R: BUILD_PLAN.md §M5.3
 * R: briefing.md §3.5 — logótipo: apenas owner fixo e owner temporário
 * R: briefing.md §3.9 — quota de armazenamento
 * R: STACK_LOCK.md §5 — IDOR: tenant_id verificado pela sessão
 *
 * Endpoints:
 *   GET    /api/admin/company        — ler dados da empresa
 *   PATCH  /api/admin/company        — editar (owner fixo + owner temporário)
 *   POST   /api/admin/company/logo   — upload logótipo (owner fixo + owner temporário)
 *   DELETE /api/admin/company/logo   — remover logótipo (owner fixo + owner temporário)
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware } from "../../middleware/auth.js";
import { logAction } from "../../services/activity-log.service.js";
import {
  deleteCompanyLogo,
  getCompanyProfile,
  type ProfileServiceError,
  patchCompanyProfile,
  uploadCompanyLogo,
} from "../../services/profile.service.js";

export const companyRouter = new Hono<{ Bindings: Env }>();

// Todos os endpoints requerem sessão válida
companyRouter.use("/*", authMiddleware);

// Guard: apenas utilizadores com tenant_id (não super_user)
function requireTenant(tenantId: string | null, c: Parameters<typeof problemResponse>[0]) {
  if (!tenantId) {
    return problemResponse(c, 403, "Sem empresa associada.", "no_tenant");
  }
  return null;
}

// Guard: apenas owner fixo ou owner temporário
function requireOwner(
  isOwner: number,
  isTempOwner: number,
  c: Parameters<typeof problemResponse>[0],
) {
  if (!isOwner && !isTempOwner) {
    return problemResponse(c, 403, "Apenas o owner pode realizar esta acção.", "not_owner");
  }
  return null;
}

// ── GET /api/admin/company ────────────────────────────────────────────────────
companyRouter.get("/", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("admin/company", getTraceId(c.req.raw));

  const noTenant = requireTenant(sessionUser.tenant_id, c);
  if (noTenant) return noTenant;
  const tenantId = sessionUser.tenant_id as string; // narrowed by requireTenant guard

  try {
    const company = await getCompanyProfile(c.env.DB, tenantId);
    return c.json(company);
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ tenant_id: tenantId, err: String(err) }, "company_get_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── PATCH /api/admin/company ──────────────────────────────────────────────────
const patchCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  website: z.string().url().max(255).nullable().optional(),
});

companyRouter.patch("/", zValidator("json", patchCompanySchema), async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("admin/company-patch", getTraceId(c.req.raw));
  const input = c.req.valid("json");

  const noTenant = requireTenant(sessionUser.tenant_id, c);
  if (noTenant) return noTenant;
  const tenantId = sessionUser.tenant_id as string; // narrowed by requireTenant guard

  const notOwner = requireOwner(sessionUser.is_owner, sessionUser.is_temp_owner, c);
  if (notOwner) return notOwner;

  try {
    await patchCompanyProfile(c.env.DB, tenantId, input);
    log.info({ tenant_id: tenantId }, "company_updated");

    await logAction(c.env.DB, {
      tenant_id: tenantId,
      actor_id: sessionUser.id,
      actor_name: sessionUser.email,
      action: "company.update",
      target_type: "company",
      target_id: tenantId,
      was_temp_owner: sessionUser.is_temp_owner === 1,
    });

    return c.json({ ok: true });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ tenant_id: tenantId, err: String(err) }, "company_patch_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/admin/company/logo ──────────────────────────────────────────────
companyRouter.post("/logo", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("admin/company-logo-upload", getTraceId(c.req.raw));

  const noTenant = requireTenant(sessionUser.tenant_id, c);
  if (noTenant) return noTenant;
  const tenantId = sessionUser.tenant_id as string; // narrowed by requireTenant guard

  const notOwner = requireOwner(sessionUser.is_owner, sessionUser.is_temp_owner, c);
  if (notOwner) return notOwner;

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return problemResponse(c, 400, "Campo 'file' obrigatório.", "missing_file");
    }

    const buffer = await file.arrayBuffer();
    const key = await uploadCompanyLogo(c.env.DB, c.env.R2_BUCKET, tenantId, buffer);

    log.info({ tenant_id: tenantId, key }, "logo_uploaded");

    await logAction(c.env.DB, {
      tenant_id: tenantId,
      actor_id: sessionUser.id,
      actor_name: sessionUser.email,
      action: "company.logo.upload",
      target_type: "company",
      target_id: tenantId,
      was_temp_owner: sessionUser.is_temp_owner === 1,
    });

    return c.json({ ok: true, logo_key: key });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ tenant_id: tenantId, err: String(err) }, "logo_upload_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── DELETE /api/admin/company/logo ────────────────────────────────────────────
companyRouter.delete("/logo", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("admin/company-logo-delete", getTraceId(c.req.raw));

  const noTenant = requireTenant(sessionUser.tenant_id, c);
  if (noTenant) return noTenant;
  const tenantId = sessionUser.tenant_id as string; // narrowed by requireTenant guard

  const notOwner = requireOwner(sessionUser.is_owner, sessionUser.is_temp_owner, c);
  if (notOwner) return notOwner;

  try {
    await deleteCompanyLogo(c.env.DB, c.env.R2_BUCKET, tenantId);
    log.info({ tenant_id: tenantId }, "logo_deleted");

    await logAction(c.env.DB, {
      tenant_id: tenantId,
      actor_id: sessionUser.id,
      actor_name: sessionUser.email,
      action: "company.update",
      target_type: "company",
      target_id: tenantId,
      was_temp_owner: sessionUser.is_temp_owner === 1,
    });

    return c.json({ ok: true });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ tenant_id: tenantId, err: String(err) }, "logo_delete_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});
