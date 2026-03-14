/**
 * routes/super/tenants.ts — Gestão de empresas pelo Super User
 *
 * R: BUILD_PLAN.md §M2.4
 * R: STACK_LOCK.md §5 — 4 camadas: routes → handlers (validação+IDOR) → services → queries
 * R: R07 — paginação cursor-based
 * R: GS09 — pass_hash nunca em respostas
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getAllAppConfig, setManyAppConfig } from "../../db/queries/app-config.js";
import { deleteAllUserSessions } from "../../db/queries/sessions.js";
import { getStorageUsage } from "../../db/queries/storage.js";
import {
  countTenantsByStatus,
  getTenantById,
  listTenants,
  softDeleteTenant,
  updateTenantLimits,
} from "../../db/queries/tenants.js";
import {
  countUsersByTenant,
  getTenantOwner,
  listClientsByTenant,
  listCollaboratorsByTenant,
  listMembersByTenant,
} from "../../db/queries/users.js";
import { inviteOwnerTemplate } from "../../lib/integrations/email/templates/index.js";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware, requireSuperUser } from "../../middleware/auth.js";
import { logAuditEvent } from "../../services/audit-log.service.js";
import { sendEmail } from "../../services/integration.service.js";
import { NOTIFICATION_TYPES, notifyOwners } from "../../services/notification.service.js";
import {
  activateTenant,
  createTenantWithOwnerInvite,
  deactivateTenant,
  elevateTempOwner,
  hardDeleteTenant,
  revokeElevation,
  transferOwnership,
} from "../../services/tenant.service.js";

type Bindings = Env;

const superTenantsRouter = new Hono<{ Bindings: Bindings }>();

// Aplicar guard super_user em todas as rotas
superTenantsRouter.use("*", authMiddleware);
superTenantsRouter.use("*", requireSuperUser);

// ── Schemas de validação ───────────────────────────────────────────────────────

const CreateTenantSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  address: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  website: z.string().url().optional(),
  admin_seat_limit: z.number().int().min(1).max(50).optional(),
  member_seat_limit: z.number().int().min(0).max(200).optional(),
  client_seat_limit: z.number().int().min(0).max(500).optional(),
  storage_limit_bytes: z.number().int().min(1048576).optional(), // min 1 MB
  daily_email_limit: z.number().int().min(1).max(10000).optional(),
  owner_email: z.string().email(),
  owner_language: z.enum(["pt", "en"]).optional(),
});

const UpdateLimitsSchema = z.object({
  admin_seat_limit: z.number().int().min(1).max(50).optional(),
  member_seat_limit: z.number().int().min(0).max(200).optional(),
  client_seat_limit: z.number().int().min(0).max(500).optional(),
  storage_limit_bytes: z.number().int().min(1048576).optional(),
  daily_email_limit: z.number().int().min(1).max(10000).optional(),
});

const TransferOwnershipSchema = z.object({
  new_owner_user_id: z.string().min(1),
});

const ElevateSchema = z.object({
  user_id: z.string().min(1),
  duration_seconds: z
    .number()
    .int()
    .min(3600)
    .max(7 * 24 * 3600)
    .optional(),
});

const SettingsSchema = z.record(z.string(), z.string());

// ── GET /api/super/tenants ─────────────────────────────────────────────────────
superTenantsRouter.get("/tenants", async (c) => {
  const log = createLogger("super.tenants.list", getTraceId(c.req.raw));
  const { limit = "20", cursor, status } = c.req.query();

  // Auto-recover: activar tenants pendentes que já têm owner registado
  await c.env.DB.prepare(
    `UPDATE tenants SET status = 'active', updated_at = unixepoch()
     WHERE status = 'pending'
       AND deleted_at IS NULL
       AND id IN (
         SELECT tenant_id FROM users
         WHERE is_owner = 1 AND status != 'deleted'
       )`,
  )
    .run()
    .catch(() => {});

  const { rows, nextCursor } = await listTenants(c.env.DB, {
    limit: Math.min(Number(limit) || 20, 100),
    cursor: cursor || undefined,
    status: status || undefined,
  });

  const counts = await countTenantsByStatus(c.env.DB);
  log.info({ count: rows.length }, "tenants_listed");

  return c.json({ data: rows, next_cursor: nextCursor, meta: counts });
});

// ── POST /api/super/tenants ────────────────────────────────────────────────────
superTenantsRouter.post("/tenants", zValidator("json", CreateTenantSchema), async (c) => {
  const log = createLogger("super.tenants.create", getTraceId(c.req.raw));
  const body = c.req.valid("json");
  const actor = c.get("user");

  let result;
  try {
    result = await createTenantWithOwnerInvite(c.env.DB, {
      name: body.name,
      email: body.email,
      address: body.address,
      phone: body.phone,
      website: body.website,
      admin_seat_limit: body.admin_seat_limit,
      member_seat_limit: body.member_seat_limit,
      client_seat_limit: body.client_seat_limit,
      storage_limit_bytes: body.storage_limit_bytes,
      daily_email_limit: body.daily_email_limit,
      ownerEmail: body.owner_email,
      ownerLanguage: body.owner_language,
      invitedBy: actor.id,
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === "email_taken") {
      return problemResponse(
        c,
        409,
        "Email do owner já está registado na plataforma.",
        "email_taken",
      );
    }
    if (e.code === "invite_pending") {
      return problemResponse(
        c,
        409,
        "Já existe um convite pendente para este owner.",
        "invite_pending",
      );
    }
    // UNIQUE constraint violation on tenants.email
    if (e.message?.includes("UNIQUE") || e.message?.includes("unique")) {
      return problemResponse(
        c,
        409,
        "Email da empresa já existe na plataforma.",
        "tenant_email_taken",
      );
    }
    log.error({ err: String(e) }, "tenant_create_error");
    return problemResponse(c, 500, "Erro interno ao criar empresa.", "internal_error");
  }

  log.info({ tenant_id: result.tenant.id }, "tenant_created");
  await logAuditEvent(c.env.DB, {
    event_type: "tenant.created",
    actor_id: actor.id,
    target_type: "tenant",
    target_id: result.tenant.id,
    tenant_id: result.tenant.id,
    metadata: { name: body.name, owner_email: body.owner_email },
  });

  // M7: enviar email de convite ao owner (melhor esforço — não bloqueia a criação)
  try {
    const origin = new URL(c.req.url).origin;
    const rawToken = result.invitation.rawToken;
    const acceptUrl = `${origin}/invite/${rawToken}`;
    const emailTpl = inviteOwnerTemplate({
      inviteeEmail: body.owner_email,
      tenantName: body.name,
      acceptUrl,
      expiresIn: "24 horas",
    });
    await sendEmail(c.env.DB, c.env.ENCRYPTION_KEY, {
      to: body.owner_email,
      subject: emailTpl.subject,
      html: emailTpl.html,
      text: emailTpl.text,
    });
  } catch {
    // Sem integração de email activa ou falha — empresa criada mas email não enviado
    log.warn({ owner_email: body.owner_email }, "invite_email_not_sent");
  }

  return c.json({ tenant: result.tenant, invitation_id: result.invitation.invitation.id }, 201);
});

// ── GET /api/super/tenants/:id ─────────────────────────────────────────────────
superTenantsRouter.get("/tenants/:id", async (c) => {
  const tenantId = c.req.param("id");
  let tenant = await getTenantById(c.env.DB, tenantId);

  if (!tenant) return problemResponse(c, 404, "Not Found", "Empresa não encontrada");

  const [owner, seats, storageUsed] = await Promise.all([
    getTenantOwner(c.env.DB, tenantId),
    countUsersByTenant(c.env.DB, tenantId),
    getStorageUsage(c.env.DB, tenantId),
  ]);

  // Auto-recover: se tenant está 'pending' mas já tem owner activo, activar
  if (tenant.status === "pending" && owner) {
    await activateTenant(c.env.DB, tenantId).catch(() => {});
    tenant = { ...tenant, status: "active" };
  }

  return c.json({ tenant, owner, seats, storage_used: storageUsed });
});

// ── GET /api/super/tenants/:id/users ──────────────────────────────────────────
// Devolve: owner fixo, owner temporário (se existir), sócios, contagem de colaboradores e clientes
superTenantsRouter.get("/tenants/:id/users", async (c) => {
  const tenantId = c.req.param("id");
  const tenant = await getTenantById(c.env.DB, tenantId);
  if (!tenant) return problemResponse(c, 404, "Not Found", "Empresa não encontrada");

  const [ownerRow, membersResult, collabResult, clientResult, seatCounts] = await Promise.all([
    getTenantOwner(c.env.DB, tenantId),
    listMembersByTenant(c.env.DB, tenantId, { limit: 50 }),
    listCollaboratorsByTenant(c.env.DB, tenantId, { limit: 50 }),
    listClientsByTenant(c.env.DB, tenantId, { limit: 50 }),
    countUsersByTenant(c.env.DB, tenantId),
  ]);

  // Separar owner temp do owner fixo nos membros
  const tempOwners = membersResult.rows.filter((u) => u.is_temp_owner === 1);
  const regularMembers = membersResult.rows.filter((u) => u.is_temp_owner === 0);

  return c.json({
    owner: ownerRow,
    tempOwners,
    members: regularMembers,
    collaborators: collabResult.rows,
    collaboratorCount: seatCounts.collaborators,
    clients: clientResult.rows,
    clientCount: seatCounts.clients,
  });
});

// ── PATCH /api/super/tenants/:id/limits ───────────────────────────────────────
superTenantsRouter.patch(
  "/tenants/:id/limits",
  zValidator("json", UpdateLimitsSchema),
  async (c) => {
    const log = createLogger("super.tenants.limits", getTraceId(c.req.raw));
    const tenantId = c.req.param("id");
    const body = c.req.valid("json");

    const tenant = await getTenantById(c.env.DB, tenantId);
    if (!tenant) return problemResponse(c, 404, "Not Found", "Empresa não encontrada");

    await updateTenantLimits(c.env.DB, tenantId, body);
    log.info({ tenant_id: tenantId }, "limits_updated");

    return c.json({ ok: true });
  },
);

// ── POST /api/super/tenants/:id/activate ──────────────────────────────────────
superTenantsRouter.post("/tenants/:id/activate", async (c) => {
  const tenantId = c.req.param("id");
  const tenant = await getTenantById(c.env.DB, tenantId);
  if (!tenant) return problemResponse(c, 404, "Not Found", "Empresa não encontrada");

  // Impedir activação manual de empresas pendentes (só devem ser activadas via email)
  if (tenant.status === "pending") {
    return problemResponse(
      c,
      400,
      "Bad Request",
      "Não é possível activar manualmente uma empresa pendente. Aguarde a confirmação do owner.",
    );
  }

  await activateTenant(c.env.DB, tenantId);
  // M6.3 — Notificar owner que empresa foi ativada
  await notifyOwners(c.env.DB, tenantId, {
    type: NOTIFICATION_TYPES.TENANT_ACTIVATED,
    titleKey: "notif_tenant_activated_title",
    bodyKey: "notif_tenant_activated_body",
    params: { name: tenant.name },
    link: "/dashboard",
  }).catch(() => {});

  const actor = c.get("user");
  await logAuditEvent(c.env.DB, {
    event_type: "tenant.activated",
    actor_id: actor.id,
    target_type: "tenant",
    target_id: tenantId,
    tenant_id: tenantId,
    metadata: { name: tenant.name },
  });

  return c.json({ ok: true });
});

// ── POST /api/super/tenants/:id/deactivate ────────────────────────────────────
superTenantsRouter.post("/tenants/:id/deactivate", async (c) => {
  const log = createLogger("super.tenants.deactivate", getTraceId(c.req.raw));
  const tenantId = c.req.param("id");
  const tenant = await getTenantById(c.env.DB, tenantId);
  if (!tenant) return problemResponse(c, 404, "Not Found", "Empresa não encontrada");

  // Impedir desactivação manual de empresas pendentes (só devem ser activadas via email)
  if (tenant.status === "pending") {
    return problemResponse(
      c,
      400,
      "Bad Request",
      "Não é possível desactivar uma empresa pendente. Aguarde a confirmação do owner.",
    );
  }

  // Invalidar sessões de todos os utilizadores da empresa
  const users = (
    await c.env.DB.prepare("SELECT id FROM users WHERE tenant_id = ?1 AND status != 'deleted'")
      .bind(tenantId)
      .all<{ id: string }>()
  ).results;

  await Promise.all(
    (users ?? []).map((u: { id: string }) => deleteAllUserSessions(c.env.DB, u.id)),
  );
  await deactivateTenant(c.env.DB, tenantId);

  log.info({ tenant_id: tenantId, sessions_cleared: users.length }, "tenant_deactivated");

  const actor = c.get("user");
  await logAuditEvent(c.env.DB, {
    event_type: "tenant.deactivated",
    actor_id: actor.id,
    target_type: "tenant",
    target_id: tenantId,
    tenant_id: tenantId,
    metadata: { name: tenant.name },
  });

  return c.json({ ok: true });
});

// ── POST /api/super/tenants/:id/soft-delete ──────────────────────────────────
superTenantsRouter.post("/tenants/:id/soft-delete", async (c) => {
  const log = createLogger("super.tenants.soft_delete", getTraceId(c.req.raw));
  const tenantId = c.req.param("id");

  const tenant = await getTenantById(c.env.DB, tenantId);
  if (!tenant) return problemResponse(c, 404, "Not Found", "Empresa não encontrada");

  // Invalidar sessões
  const users = (
    await c.env.DB.prepare("SELECT id FROM users WHERE tenant_id = ?1 AND status != 'deleted'")
      .bind(tenantId)
      .all<{ id: string }>()
  ).results;
  await Promise.all(
    (users ?? []).map((u: { id: string }) => deleteAllUserSessions(c.env.DB, u.id)),
  );

  await softDeleteTenant(c.env.DB, tenantId);
  log.info({ tenant_id: tenantId }, "tenant_soft_deleted");

  const actor = c.get("user");
  await logAuditEvent(c.env.DB, {
    event_type: "tenant.soft_deleted",
    actor_id: actor.id,
    target_type: "tenant",
    target_id: tenantId,
    tenant_id: tenantId,
    metadata: { name: tenant.name },
  });

  return c.json({ ok: true });
});

// ── DELETE /api/super/tenants/:id ─────────────────────────────────────────────
superTenantsRouter.delete("/tenants/:id", async (c) => {
  const log = createLogger("super.tenants.delete", getTraceId(c.req.raw));
  const tenantId = c.req.param("id");

  const tenant = await getTenantById(c.env.DB, tenantId);

  await hardDeleteTenant(c.env.DB, tenantId);
  log.info({ tenant_id: tenantId }, "tenant_hard_deleted");

  const actor = c.get("user");
  await logAuditEvent(c.env.DB, {
    event_type: "tenant.hard_deleted",
    actor_id: actor.id,
    target_type: "tenant",
    target_id: tenantId,
    tenant_id: tenantId,
    metadata: { name: tenant?.name ?? "Desconhecida" },
  });

  return c.json({ ok: true });
});

// ── POST /api/super/tenants/:id/transfer-ownership ────────────────────────────
superTenantsRouter.post(
  "/tenants/:id/transfer-ownership",
  zValidator("json", TransferOwnershipSchema),
  async (c) => {
    const log = createLogger("super.tenants.transfer", getTraceId(c.req.raw));
    const tenantId = c.req.param("id");
    const { new_owner_user_id } = c.req.valid("json");

    await transferOwnership(c.env.DB, tenantId, new_owner_user_id);
    log.info({ tenant_id: tenantId, new_owner: new_owner_user_id }, "ownership_transferred");
    return c.json({ ok: true });
  },
);

// ── POST /api/super/tenants/:id/elevate ───────────────────────────────────────
superTenantsRouter.post("/tenants/:id/elevate", zValidator("json", ElevateSchema), async (c) => {
  const log = createLogger("super.tenants.elevate", getTraceId(c.req.raw));
  const tenantId = c.req.param("id");
  const { user_id, duration_seconds } = c.req.valid("json");

  await elevateTempOwner(c.env.DB, tenantId, user_id, duration_seconds);
  // M6.3 — Notificar o utilizador elevado
  await notifyOwners(c.env.DB, tenantId, {
    type: NOTIFICATION_TYPES.ELEVATION_GRANTED,
    titleKey: "notif_elevation_granted_title",
    bodyKey: "notif_elevation_granted_body",
    params: { duration_h: Math.round((duration_seconds ?? 86400) / 3600) },
    link: "/dashboard",
  }).catch(() => {});
  log.info({ tenant_id: tenantId, user_id }, "temp_owner_elevated");
  return c.json({ ok: true });
});

// ── DELETE /api/super/tenants/:id/elevate ─────────────────────────────────────
superTenantsRouter.delete("/tenants/:id/elevate", async (c) => {
  const log = createLogger("super.tenants.elevate.revoke", getTraceId(c.req.raw));
  const tenantId = c.req.param("id");
  const { user_id } = c.req.query();
  if (!user_id) return problemResponse(c, 422, "Validation Error", "user_id é obrigatório");

  await revokeElevation(c.env.DB, tenantId, user_id);
  // M6.3 — Notificar utilizador que elevação foi revogada
  await notifyOwners(c.env.DB, tenantId, {
    type: NOTIFICATION_TYPES.ELEVATION_REVOKED,
    titleKey: "notif_elevation_revoked_title",
    bodyKey: "notif_elevation_revoked_body",
    link: "/dashboard",
  }).catch(() => {});
  log.info({ tenant_id: tenantId, user_id }, "elevation_revoked");
  return c.json({ ok: true });
});

// ── GET /api/super/settings ────────────────────────────────────────────────────
superTenantsRouter.get("/settings", async (c) => {
  const config = await getAllAppConfig(c.env.DB);
  return c.json({ data: config });
});

// ── PATCH /api/super/settings ─────────────────────────────────────────────────
superTenantsRouter.patch("/settings", zValidator("json", SettingsSchema), async (c) => {
  const log = createLogger("super.settings.update", getTraceId(c.req.raw));
  const body = c.req.valid("json");
  await setManyAppConfig(c.env.DB, body);
  log.info({ keys: Object.keys(body) }, "settings_updated");
  return c.json({ ok: true });
});

export { superTenantsRouter };
