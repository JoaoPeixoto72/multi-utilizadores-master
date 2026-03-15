/**
 * routes/admin/team.ts — Gestão de equipa (M3)
 *
 * R: BUILD_PLAN.md §M3.1
 * R: STACK_LOCK.md §5 — IDOR: tenant_id em cada operação
 * R: GS09 — pass_hash nunca em respostas
 *
 * Endpoints:
 *   GET    /api/admin/team/collaborators
 *   POST   /api/admin/team/collaborators/:id/deactivate
 *   POST   /api/admin/team/collaborators/:id/reactivate
 *   DELETE /api/admin/team/collaborators/:id
 *   DELETE /api/admin/team/members/:id
 *   GET    /api/admin/team/invitations
 *   POST   /api/admin/team/invitations
 *   POST   /api/admin/team/invitations/:id/resend
 *   DELETE /api/admin/team/invitations/:id
 *   GET    /api/admin/team/permissions
 *   PATCH  /api/admin/team/permissions/:userId
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getInvitationById } from "../../db/queries/invitations.js";
import { getTenantById } from "../../db/queries/tenants.js";
import { getPermissionsMatrix, getUserByIdAndTenant } from "../../db/queries/users.js";
import { inviteMemberTemplate } from "../../lib/integrations/email/templates/index.js";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware, requireAdmin } from "../../middleware/auth.js";
import { logAction } from "../../services/activity-log.service.js";
import { sendEmail } from "../../services/integration.service.js";
import { createMemberInvitation, resendInvitation } from "../../services/invitation.service.js";
import { NOTIFICATION_TYPES, notifyAdmins } from "../../services/notification.service.js";
import {
  cancelTeamInvitation,
  deactivateCollaborator,
  deleteTeamInvitation,
  deleteTeamUser,
  listClients,
  listCollaborators,
  listMembers,
  listTeamInvitations,
  reactivateCollaborator,
  updatePermissions,
} from "../../services/team.service.js";

export const adminTeamRouter = new Hono<{ Bindings: Env }>();

// ── Auth guard (todos os endpoints requerem admin) ────────────────────────────
adminTeamRouter.use("/*", authMiddleware, requireAdmin);

// ── GET /api/admin/team/stats — contagens actuais + limites de lugar ──────────
adminTeamRouter.get("/stats", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team/stats", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;

  if (!tenantId) {
    return problemResponse(c, 403, "Forbidden", "No tenant associated");
  }

  try {
    const [tenant, membersResult, collabResult, clientsResult] = await Promise.all([
      getTenantById(c.env.DB, tenantId),
      listMembers(c.env.DB, tenantId, { limit: 1000 }),
      listCollaborators(c.env.DB, tenantId, { limit: 1000 }),
      listClients(c.env.DB, tenantId, { limit: 1000 }),
    ]);

    const memberCount = membersResult.rows.length;
    const collabCount = collabResult.rows.length;
    const clientCount = clientsResult.rows.length;
    const totalCount = memberCount + collabCount + clientCount;

    // admin_seat_limit = sócios (role=member) — definido no Super como "Lugares de sócios"
    // member_seat_limit = colaboradores (role=collaborator) — definido no Super como "Lugares de colaboradores"
    // client_seat_limit = clientes (role=client)
    const memberLimit = tenant?.admin_seat_limit ?? 3;
    const collabLimit = tenant?.member_seat_limit ?? 0;
    const clientLimit = tenant?.client_seat_limit ?? 0;

    return c.json({
      members: {
        count: memberCount,
        limit: memberLimit,
      },
      collaborators: {
        count: collabCount,
        limit: collabLimit,
      },
      clients: {
        count: clientCount,
        limit: clientLimit,
      },
      total: {
        count: totalCount,
        limit: memberLimit + collabLimit + clientLimit,
      },
    });
  } catch (err) {
    log.error({ err }, "team_stats_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to get team stats");
  }
});
adminTeamRouter.get("/members", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;

  if (!tenantId) {
    return problemResponse(c, 403, "Forbidden", "No tenant associated");
  }

  const limit = Number(c.req.query("limit") ?? 20);
  const cursor = c.req.query("cursor");

  try {
    const result = await listMembers(c.env.DB, tenantId, { limit, cursor });
    return c.json(result);
  } catch (err) {
    log.error({ err }, "list_members_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to list members");
  }
});

// ── GET /api/admin/team/collaborators ─────────────────────────────────────────
adminTeamRouter.get("/collaborators", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;

  if (!tenantId) {
    return problemResponse(c, 403, "Forbidden", "No tenant associated");
  }

  const limit = Number(c.req.query("limit") ?? 20);
  const cursor = c.req.query("cursor");

  try {
    const result = await listCollaborators(c.env.DB, tenantId, { limit, cursor });
    return c.json(result);
  } catch (err) {
    log.error({ err }, "list_collaborators_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to list collaborators");
  }
});

// ── GET /api/admin/team/clients ──────────────────────────────────────────────
adminTeamRouter.get("/clients", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;

  if (!tenantId) {
    return problemResponse(c, 403, "Forbidden", "No tenant associated");
  }

  const limit = Number(c.req.query("limit") ?? 20);
  const cursor = c.req.query("cursor");

  try {
    const result = await listClients(c.env.DB, tenantId, { limit, cursor });
    return c.json(result);
  } catch (err) {
    log.error({ err }, "list_clients_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to list clients");
  }
});

// ── POST /api/admin/team/collaborators/:id/deactivate ────────────────────────
adminTeamRouter.post("/collaborators/:id/deactivate", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const targetId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const target = await getUserByIdAndTenant(c.env.DB, targetId, tenantId);
    await deactivateCollaborator(c.env.DB, user.id, targetId, tenantId);
    if (target) {
      await notifyAdmins(c.env.DB, tenantId, {
        type: NOTIFICATION_TYPES.USER_DEACTIVATED,
        titleKey: "notif_title_user_deactivated",
        bodyKey: "notif_body_user_deactivated",
        params: { email: target.email },
        link: "/team",
      }).catch(() => {});

      await logAction(c.env.DB, {
        tenant_id: tenantId,
        actor_id: user.id,
        actor_name: user.email,
        action: "user.deactivate",
        target_type: "user",
        target_id: targetId,
        target_name: target.email,
        was_temp_owner: user.is_temp_owner === 1,
      });
    }
    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      log.warn({ code: e.code, targetId }, "deactivate_collaborator_rejected");
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "deactivate_collaborator_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to deactivate collaborator");
  }
});

// ── POST /api/admin/team/collaborators/:id/reactivate ────────────────────────
adminTeamRouter.post("/collaborators/:id/reactivate", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const targetId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const target = await getUserByIdAndTenant(c.env.DB, targetId, tenantId);
    await reactivateCollaborator(c.env.DB, user.id, targetId, tenantId);

    if (target) {
      await logAction(c.env.DB, {
        tenant_id: tenantId,
        actor_id: user.id,
        actor_name: user.email,
        action: "user.reactivate",
        target_type: "user",
        target_id: targetId,
        target_name: target.email,
        was_temp_owner: user.is_temp_owner === 1,
      });
    }

    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      log.warn({ code: e.code, targetId }, "reactivate_collaborator_rejected");
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "reactivate_collaborator_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to reactivate collaborator");
  }
});

// ── DELETE /api/admin/team/collaborators/:id ──────────────────────────────────
adminTeamRouter.delete("/collaborators/:id", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const targetId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const target = await getUserByIdAndTenant(c.env.DB, targetId, tenantId);
    await deleteTeamUser(c.env.DB, user.id, targetId, tenantId, "collaborator");
    if (target && target.status !== "deleted") {
      await notifyAdmins(c.env.DB, tenantId, {
        type: NOTIFICATION_TYPES.USER_DELETED,
        titleKey: "notif_title_user_deleted",
        bodyKey: "notif_body_user_deleted",
        params: { email: target.email },
        link: "/team",
      }).catch(() => {});

      await logAction(c.env.DB, {
        tenant_id: tenantId,
        actor_id: user.id,
        actor_name: user.email,
        action: "user.delete",
        target_type: "user",
        target_id: targetId,
        target_name: target.email,
        was_temp_owner: user.is_temp_owner === 1,
      });
    }
    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      log.warn({ code: e.code, targetId }, "delete_collaborator_rejected");
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "delete_collaborator_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to delete collaborator");
  }
});

// ── DELETE /api/admin/team/members/:id ────────────────────────────────────────
adminTeamRouter.delete("/members/:id", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const targetId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const target = await getUserByIdAndTenant(c.env.DB, targetId, tenantId);
    await deleteTeamUser(c.env.DB, user.id, targetId, tenantId, "member");
    if (target && target.status !== "deleted") {
      await notifyAdmins(c.env.DB, tenantId, {
        type: NOTIFICATION_TYPES.USER_DELETED,
        titleKey: "notif_title_user_deleted",
        bodyKey: "notif_body_user_deleted",
        params: { email: target.email },
        link: "/team",
      }).catch(() => {});

      await logAction(c.env.DB, {
        tenant_id: tenantId,
        actor_id: user.id,
        actor_name: user.email,
        action: "user.delete",
        target_type: "user",
        target_id: targetId,
        target_name: target.email,
        was_temp_owner: user.is_temp_owner === 1,
      });
    }
    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      log.warn({ code: e.code, targetId }, "delete_member_rejected");
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "delete_member_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to delete member");
  }
});

// ── DELETE /api/admin/team/clients/:id ───────────────────────────────────────
adminTeamRouter.delete("/clients/:id", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const targetId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const target = await getUserByIdAndTenant(c.env.DB, targetId, tenantId);
    await deleteTeamUser(c.env.DB, user.id, targetId, tenantId, "client");
    if (target && target.status !== "deleted") {
      await notifyAdmins(c.env.DB, tenantId, {
        type: NOTIFICATION_TYPES.USER_DELETED,
        titleKey: "notif_title_user_deleted",
        bodyKey: "notif_body_user_deleted",
        params: { email: target.email },
        link: "/team",
      }).catch(() => {});

      await logAction(c.env.DB, {
        tenant_id: tenantId,
        actor_id: user.id,
        actor_name: user.email,
        action: "user.delete",
        target_type: "user",
        target_id: targetId,
        target_name: target.email,
        was_temp_owner: user.is_temp_owner === 1,
      });
    }
    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      log.warn({ code: e.code, targetId }, "delete_client_rejected");
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "delete_client_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to delete client");
  }
});

// ── GET /api/admin/team/invitations ───────────────────────────────────────────
adminTeamRouter.get("/invitations", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  const limit = Number(c.req.query("limit") ?? 20);
  const cursor = c.req.query("cursor");
  const status = c.req.query("status");

  try {
    const result = await listTeamInvitations(c.env.DB, tenantId, { limit, cursor, status });
    return c.json(result);
  } catch (err) {
    log.error({ err }, "list_invitations_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to list invitations");
  }
});

// ── POST /api/admin/team/invitations ─────────────────────────────────────────
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["member", "collaborator", "client"]),
  language: z.string().optional(),
  module_permissions: z.record(z.string(), z.unknown()).optional(),
});

adminTeamRouter.post("/invitations", zValidator("json", inviteSchema), async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  const body = c.req.valid("json");

  // Validar autorização: sócios só podem convidar colaboradores
  const isOwnerFixed = user.is_owner === 1 && user.is_temp_owner === 0;
  const isOwnerTemp = user.is_temp_owner === 1;
  const isAnyOwner = isOwnerFixed || isOwnerTemp;

  if (body.role === "member" && !isAnyOwner) {
    return problemResponse(c, 403, "Forbidden", "Apenas owners podem convidar sócios");
  }

  try {
    const result = await createMemberInvitation(c.env.DB, {
      tenantId,
      email: body.email,
      role: body.role,
      modulePermissions: body.module_permissions,
      language: body.language,
      invitedBy: user.id,
    });

    log.info({ role: body.role }, "invitation_created");

    // M7: enviar email de convite (melhor esforço — não falha se email não configurado)
    const origin = new URL(c.req.url).origin;
    const acceptUrl = `${origin}/invite/${result.rawToken}`;
    const roleLabel = body.role === "member" ? "member" : "collaborator";
    const emailTpl = inviteMemberTemplate({
      inviteeEmail: body.email,
      tenantName: tenantId, // será substituído por nome real via query se necessário
      role: roleLabel as "member" | "collaborator",
      inviterName: user.email,
      acceptUrl,
      expiresIn: "24 horas",
    });
    await sendEmail(
      c.env.DB,
      c.env.ENCRYPTION_KEY,
      {
        to: body.email,
        subject: emailTpl.subject,
        html: emailTpl.html,
        text: emailTpl.text,
      },
      tenantId,
    ).catch(() => {});

    await notifyAdmins(c.env.DB, tenantId, {
      type: NOTIFICATION_TYPES.INVITE_SENT,
      titleKey: "notif_title_invite_sent",
      bodyKey: "notif_body_invite_sent",
      params: { email: body.email, role: body.role },
      link: "/team",
    }).catch(() => {});

    await logAction(c.env.DB, {
      tenant_id: tenantId,
      actor_id: user.id,
      actor_name: user.email,
      action: "user.invite",
      target_type: "invitation",
      target_id: result.invitation.id,
      target_name: body.email,
      was_temp_owner: user.is_temp_owner === 1,
    });

    // Retorna o convite e o token raw (disponível em dev para testes manuais)
    return c.json({ invitation: result.invitation, token: result.rawToken }, 201);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "email_taken") {
      return problemResponse(c, 409, "Conflict", "Email já registado na plataforma");
    }
    if (e.code === "invite_pending") {
      return problemResponse(c, 409, "Conflict", "Já existe um convite pendente para este email");
    }
    log.error({ err }, "create_invitation_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to create invitation");
  }
});

// ── POST /api/admin/team/invitations/:id/resend ───────────────────────────────
adminTeamRouter.post("/invitations/:id/resend", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const invitationId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const result = await resendInvitation(c.env.DB, invitationId, tenantId);
    log.info({ invitationId }, "invitation_resent");

    await logAction(c.env.DB, {
      tenant_id: tenantId,
      actor_id: user.id,
      actor_name: user.email,
      action: "user.invite.resend",
      target_type: "invitation",
      target_id: result.invitation.id,
      target_name: result.invitation.email,
      was_temp_owner: user.is_temp_owner === 1,
    });
    return c.json({ invitation: result.invitation, token: result.rawToken });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "not_found") {
      return problemResponse(c, 404, "Not Found", "Convite não encontrado");
    }
    log.error({ err }, "resend_invitation_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to resend invitation");
  }
});

// ── DELETE /api/admin/team/invitations/:id ────────────────────────────────────
adminTeamRouter.delete("/invitations/:id", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const invitationId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const invite = await getInvitationById(c.env.DB, invitationId, tenantId);
    await cancelTeamInvitation(c.env.DB, user.id, invitationId, tenantId);
    if (invite && invite.status !== "cancelled") {
      await notifyAdmins(c.env.DB, tenantId, {
        type: NOTIFICATION_TYPES.INVITE_CANCELLED,
        titleKey: "notif_title_invite_cancelled",
        bodyKey: "notif_body_invite_cancelled",
        params: { email: invite.email },
        link: "/team",
      }).catch(() => {});

      await logAction(c.env.DB, {
        tenant_id: tenantId,
        actor_id: user.id,
        actor_name: user.email,
        action: "user.invite.cancel",
        target_type: "invitation",
        target_id: invitationId,
        target_name: invite.email,
        was_temp_owner: user.is_temp_owner === 1,
      });
    }
    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "cancel_invitation_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to cancel invitation");
  }
});

// ── DELETE /api/admin/team/invitations/:id/force ──────────────────────────────
adminTeamRouter.delete("/invitations/:id/force", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const invitationId = c.req.param("id");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    await deleteTeamInvitation(c.env.DB, user.id, invitationId, tenantId);
    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "delete_invitation_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to delete invitation");
  }
});

// ── GET /api/admin/team/permissions ──────────────────────────────────────────
adminTeamRouter.get("/permissions", async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  try {
    const matrix = await getPermissionsMatrix(c.env.DB, tenantId);
    // Parse o JSON de permissões
    const parsed = matrix.map((row) => ({
      user_id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      module_permissions: (() => {
        try {
          return JSON.parse(row.module_permissions);
        } catch {
          return {};
        }
      })(),
    }));
    return c.json({ rows: parsed });
  } catch (err) {
    log.error({ err }, "get_permissions_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to get permissions");
  }
});

// ── PATCH /api/admin/team/permissions/:userId ─────────────────────────────────
const permissionsSchema = z.object({
  module_permissions: z.record(z.string(), z.unknown()),
});

adminTeamRouter.patch("/permissions/:userId", zValidator("json", permissionsSchema), async (c) => {
  const user = c.get("user");
  const log = createLogger("admin/team", getTraceId(c.req.raw));
  const tenantId = user.tenant_id;
  const targetId = c.req.param("userId");

  if (!tenantId) return problemResponse(c, 403, "Forbidden", "No tenant associated");

  const { module_permissions } = c.req.valid("json");

  try {
    await updatePermissions(c.env.DB, user.id, targetId, tenantId, module_permissions);
    return c.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code) {
      log.warn({ code: e.code, targetId }, "update_permissions_rejected");
      return problemResponse(c, e.status ?? 400, "Bad Request", e.message ?? "Error");
    }
    log.error({ err }, "update_permissions_error");
    return problemResponse(c, 500, "Internal Server Error", "Failed to update permissions");
  }
});
