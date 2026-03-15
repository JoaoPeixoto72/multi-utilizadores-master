/**
 * routes/invitations/accept.ts — Aceitação de convites
 *
 * R: BUILD_PLAN.md §M2.5
 * R: briefing.md §2 — roles e convites
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { acceptInvitation } from "../../db/queries/invitations.js";
import { createUser } from "../../db/queries/users.js";
import { hashPassword, validatePasswordPolicy } from "../../lib/auth.js";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse, validationErrorResponse } from "../../lib/problem.js";
import { logAction } from "../../services/activity-log.service.js";
import { validateInvitationToken } from "../../services/invitation.service.js";
import { NOTIFICATION_TYPES, notifyAdmins } from "../../services/notification.service.js";
import { activateTenant } from "../../services/tenant.service.js";

type Bindings = Env;
const invitationsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /api/invitations/:token — validar token ────────────────────────────────
invitationsRouter.get("/:token", async (c) => {
  const rawToken = c.req.param("token");

  const invitation = await validateInvitationToken(c.env.DB, rawToken).catch(() => null);
  if (!invitation) {
    return problemResponse(c, 404, "Not Found", "Convite inválido ou expirado");
  }

  // Devolver dados mínimos para o formulário (sem token_hash)
  return c.json({
    email: invitation.email,
    role: invitation.role,
    is_owner: invitation.is_owner,
    language: invitation.language,
    expires_at: invitation.expires_at,
  });
});

// ── POST /api/invitations/:token/accept — aceitar convite ─────────────────────
const AcceptSchema = z.object({
  password: z.string().min(12),
  display_name: z.string().min(1).max(100).optional(),
});

invitationsRouter.post("/:token/accept", zValidator("json", AcceptSchema), async (c) => {
  const log = createLogger("invitations.accept", getTraceId(c.req.raw));
  const rawToken = c.req.param("token");
  const body = c.req.valid("json");

  // Validar token
  const invitation = await validateInvitationToken(c.env.DB, rawToken).catch(() => null);
  if (!invitation) {
    return problemResponse(c, 404, "Not Found", "Convite inválido ou expirado");
  }

  // Validar política de password
  const policy = validatePasswordPolicy(body.password);
  if (!policy.valid) {
    const messages: string[] = [];
    if (!policy.minLength) messages.push("Mínimo 12 caracteres");
    if (!policy.uppercase) messages.push("Pelo menos uma maiúscula");
    if (!policy.lowercase) messages.push("Pelo menos uma minúscula");
    if (!policy.special) messages.push("Pelo menos um carácter especial");
    return validationErrorResponse(
      c,
      messages.map((msg) => ({ field: "password", message: msg })),
    );
  }

  // Criar utilizador
  const passHash = await hashPassword(body.password);
  const user = await createUser(c.env.DB, {
    email: invitation.email,
    pass_hash: passHash,
    tenant_id: invitation.tenant_id,
    role: invitation.role as "tenant_admin" | "member" | "collaborator",
    is_owner: invitation.is_owner as 0 | 1,
    display_name: body.display_name,
    preferred_language: invitation.language,
  });

  // Marcar convite como aceite
  await acceptInvitation(c.env.DB, invitation.id);

  // ── Activar empresa quando o owner aceita o convite ──────────────────────────
  // O tenant é criado com status='pending'. Assim que o owner (is_owner=1)
  // cria a sua conta, a empresa fica automaticamente 'active'.
  if (invitation.is_owner === 1 && invitation.tenant_id) {
    await activateTenant(c.env.DB, invitation.tenant_id).catch((err) => {
      log.warn({ err, tenant_id: invitation.tenant_id }, "activate_tenant_failed");
    });
  }

  // M6.3 — Notificar admins que um novo utilizador aceitou o convite
  if (invitation.tenant_id) {
    await notifyAdmins(c.env.DB, invitation.tenant_id, {
      type: NOTIFICATION_TYPES.INVITE_ACCEPTED,
      titleKey: "notif_title_invite_accepted",
      bodyKey: "notif_body_invite_accepted",
      params: { email: invitation.email, role: invitation.role },
      link: "/team",
    }).catch(() => {
      /* não falhar por causa da notificação */
    });

    await logAction(c.env.DB, {
      tenant_id: invitation.tenant_id,
      actor_id: user.id,
      actor_name: invitation.email,
      action: "user.invite.accept",
      target_type: "user",
      target_id: user.id,
      target_name: body.display_name ?? invitation.email,
      was_temp_owner: invitation.is_owner === 1 ? true : false,
    });
  }

  log.info({ user_id: user.id, tenant_id: invitation.tenant_id }, "invitation_accepted");
  return c.json({ ok: true, user_id: user.id }, 201);
});

export { invitationsRouter };
