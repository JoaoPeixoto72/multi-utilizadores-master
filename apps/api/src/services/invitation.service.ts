/**
 * services/invitation.service.ts — Lógica de convites
 *
 * R: BUILD_PLAN.md §M2.3
 * R: briefing.md §2 — hierarquia de roles e convites
 * R: R09 — sem floating promises
 */

import { getAppConfig } from "../db/queries/app-config.js";
import {
  cancelInvitation,
  createInvitation,
  getInvitationByTokenHash,
  getPendingInvitationByEmail,
  type InvitationPublic,
} from "../db/queries/invitations.js";
import { getUserByEmail } from "../db/queries/users.js";
import { generateOneTimeToken, hashToken } from "../lib/token.js";

// Validade do convite padrão (usada como fallback): 24 horas em segundos
const FALLBACK_INVITATION_TTL_SECONDS = 24 * 60 * 60;

async function getInviteTTL(db: D1Database): Promise<number> {
  const val = await getAppConfig(db, "sys_invite_ttl_seconds");
  return val ? parseInt(val, 10) : FALLBACK_INVITATION_TTL_SECONDS;
}

export interface InviteOwnerInput {
  tenantId: string;
  email: string;
  language?: string;
  invitedBy: string; // userId do super_user
}

export interface InviteCollaboratorInput {
  tenantId: string;
  email: string;
  role: "member" | "collaborator" | "client";
  modulePermissions?: Record<string, unknown>;
  language?: string;
  invitedBy: string;
}

export interface InvitationResult {
  invitation: InvitationPublic;
  rawToken: string; // enviado por email — nunca gravar
}

// ── Validações comuns ─────────────────────────────────────────────────────────

async function assertEmailNotInUse(db: D1Database, email: string): Promise<void> {
  const existing = await getUserByEmail(db, email);
  if (existing) {
    throw Object.assign(new Error("Email já registado na plataforma."), { code: "email_taken" });
  }
}

async function assertNoPendingInvite(
  db: D1Database,
  email: string,
  tenantId: string,
): Promise<void> {
  const pending = await getPendingInvitationByEmail(db, email, tenantId);
  if (pending) {
    throw Object.assign(new Error("Já existe um convite pendente para este email."), {
      code: "invite_pending",
    });
  }
}

// ── Convite de owner (super user → nova empresa) ──────────────────────────────

export async function createOwnerInvitation(
  db: D1Database,
  input: InviteOwnerInput,
): Promise<InvitationResult> {
  await assertEmailNotInUse(db, input.email);
  await assertNoPendingInvite(db, input.email, input.tenantId);

  const { raw, hash } = await generateAndHashToken();
  const ttl = await getInviteTTL(db);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const invitation = await createInvitation(db, {
    tenant_id: input.tenantId,
    email: input.email,
    role: "tenant_admin",
    is_owner: 1,
    invited_by: input.invitedBy,
    token_hash: hash,
    module_permissions: "{}",
    language: input.language ?? "pt",
    expires_at: expiresAt,
  });

  return { invitation, rawToken: raw };
}

// ── Convite de sócio/colaborador ──────────────────────────────────────────────

export async function createMemberInvitation(
  db: D1Database,
  input: InviteCollaboratorInput,
): Promise<InvitationResult> {
  await assertEmailNotInUse(db, input.email);
  await assertNoPendingInvite(db, input.email, input.tenantId);

  const { raw, hash } = await generateAndHashToken();
  const ttl = await getInviteTTL(db);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const invitation = await createInvitation(db, {
    tenant_id: input.tenantId,
    email: input.email,
    role: input.role,
    is_owner: 0,
    invited_by: input.invitedBy,
    token_hash: hash,
    module_permissions: JSON.stringify(input.modulePermissions ?? {}),
    language: input.language ?? "pt",
    expires_at: expiresAt,
  });

  return { invitation, rawToken: raw };
}

// ── Reenviar convite (cancela o anterior, cria novo) ─────────────────────────

export async function resendInvitation(
  db: D1Database,
  invitationId: string,
  tenantId: string,
): Promise<InvitationResult> {
  // Cancela o convite actual
  await cancelInvitation(db, invitationId, tenantId);

  // Busca dados do convite cancelado para replicar
  // (já não é pendente, mas ainda existe no DB)
  const old = await db
    .prepare(
      `SELECT tenant_id, email, role, is_owner, invited_by,
              module_permissions, language
       FROM invitations WHERE id = ?1 AND tenant_id = ?2`,
    )
    .bind(invitationId, tenantId)
    .first<{
      tenant_id: string;
      email: string;
      role: "tenant_admin" | "member" | "collaborator" | "client";
      is_owner: number;
      invited_by: string;
      module_permissions: string;
      language: string;
    }>();

  if (!old) throw Object.assign(new Error("Convite não encontrado."), { code: "not_found" });

  const { raw, hash } = await generateAndHashToken();
  const ttl = await getInviteTTL(db);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const invitation = await createInvitation(db, {
    tenant_id: old.tenant_id,
    email: old.email,
    role: old.role,
    is_owner: old.is_owner as 0 | 1,
    invited_by: old.invited_by,
    token_hash: hash,
    module_permissions: old.module_permissions,
    language: old.language,
    expires_at: expiresAt,
  });

  return { invitation, rawToken: raw };
}

// ── Validar token de convite ──────────────────────────────────────────────────

export async function validateInvitationToken(
  db: D1Database,
  rawToken: string,
): Promise<InvitationPublic> {
  const hash = await hashToken(rawToken);
  const invitation = await getInvitationByTokenHash(db, hash);

  if (!invitation) {
    throw Object.assign(new Error("Convite não encontrado."), { code: "not_found" });
  }
  if (invitation.status !== "pending") {
    throw Object.assign(new Error(`Convite ${invitation.status}.`), { code: "invite_invalid" });
  }
  if (invitation.expires_at < Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error("Convite expirado."), { code: "invite_expired" });
  }

  return invitation;
}

// ── Utilitário interno ────────────────────────────────────────────────────────

async function generateAndHashToken(): Promise<{ raw: string; hash: string }> {
  return generateOneTimeToken();
}
