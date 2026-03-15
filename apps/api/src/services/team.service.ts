/**
 * services/team.service.ts — Gestão de equipa (M3)
 *
 * R: BUILD_PLAN.md §M3.2
 * R: briefing.md §2 — hierarquia de roles: owner > member > collaborator
 * R: STACK_LOCK.md §5 — IDOR: tenant_id verificado em todas as operações
 * R: LL-01 — soft delete anonimiza, nunca apaga
 */

import {
  cancelInvitation,
  deleteInvitation,
  type InvitationPublic,
  listInvitationsByTenant,
} from "../db/queries/invitations.js";
import { deleteAllUserSessions } from "../db/queries/sessions.js";
import {
  getUserByIdAndTenant,
  listClientsByTenant,
  listCollaboratorsByTenant,
  listMembersByTenant,
  softDeleteUser,
  type TeamUserRow,
  type UserPublic,
  updateUserModulePermissions,
  updateUserRole,
  updateUserStatus,
} from "../db/queries/users.js";

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface TeamServiceError extends Error {
  code: string;
  status: number;
}

function serviceError(message: string, code: string, status: number): TeamServiceError {
  return Object.assign(new Error(message), { code, status }) as TeamServiceError;
}

// ── Validação de hierarquia ───────────────────────────────────────────────────

/**
 * Verifica se o actor tem permissão para executar acções sobre o target.
 * Regras absolutas do briefing §2:
 * - Ninguém pode agir sobre si próprio (excepto auto-eliminação M4)
 * - Só owner fixo + owner temporário pode eliminar/modificar sócios
 * - Owner fixo + owner temporário + sócio pode gerir colaboradores
 */
export function validateHierarchy(
  actor: { id: string; role: string; is_owner: number; is_temp_owner: number },
  target: { id: string; role: string; is_owner: number },
  action:
    | "delete_collaborator"
    | "delete_member"
    | "deactivate"
    | "invite_member"
    | "invite_collaborator"
    | "permissions",
): void {
  // Protecção anti-self-action (excepto roles específicos em M4)
  if (actor.id === target.id) {
    throw serviceError("Não pode executar esta acção sobre si próprio.", "self_action", 403);
  }

  const isOwnerFixed = actor.is_owner === 1 && actor.is_temp_owner === 0;
  const isOwnerTemp = actor.is_temp_owner === 1;
  const isAnyOwner = isOwnerFixed || isOwnerTemp;
  const isMember = actor.role === "member" && !isAnyOwner;

  // Protecção: ninguém pode agir sobre o owner fixo (is_owner=1, is_temp_owner=0)
  if (target.is_owner === 1) {
    throw serviceError(
      "Não é possível executar esta acção sobre o owner da empresa.",
      "target_is_owner",
      403,
    );
  }

  switch (action) {
    case "delete_member":
    case "invite_member":
      if (!isAnyOwner) {
        throw serviceError("Apenas owners podem gerir sócios.", "requires_owner", 403);
      }
      break;
    case "delete_collaborator":
    case "deactivate":
    case "invite_collaborator":
    case "permissions":
      if (!isAnyOwner && !isMember) {
        throw serviceError("Acesso insuficiente.", "requires_owner_or_member", 403);
      }
      // Sócios não podem agir sobre outros sócios
      if (isMember && target.role === "member") {
        throw serviceError("Sócios não podem gerir outros sócios.", "requires_owner", 403);
      }
      break;
  }
}

// ── Operações sobre colaboradores ─────────────────────────────────────────────

export async function listCollaborators(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string },
): Promise<{ rows: TeamUserRow[]; nextCursor: string | null }> {
  return listCollaboratorsByTenant(db, tenantId, opts);
}

export async function listMembers(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string },
): Promise<{ rows: TeamUserRow[]; nextCursor: string | null }> {
  return listMembersByTenant(db, tenantId, opts);
}

export async function listClients(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string },
): Promise<{ rows: TeamUserRow[]; nextCursor: string | null }> {
  return listClientsByTenant(db, tenantId, opts);
}

export async function deactivateCollaborator(
  db: D1Database,
  actorId: string,
  targetId: string,
  tenantId: string,
): Promise<void> {
  const actor = await getUserByIdAndTenant(db, actorId, tenantId);
  const target = await getUserByIdAndTenant(db, targetId, tenantId);

  if (!actor) throw serviceError("Actor não encontrado.", "actor_not_found", 404);
  if (!target) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (target.status === "deleted")
    throw serviceError("Utilizador já eliminado.", "user_deleted", 409);
  if (target.status === "inactive")
    throw serviceError("Utilizador já inactivo.", "already_inactive", 409);

  validateHierarchy(actor, target, "deactivate");

  await updateUserStatus(db, targetId, tenantId, "inactive");
}

export async function reactivateCollaborator(
  db: D1Database,
  actorId: string,
  targetId: string,
  tenantId: string,
): Promise<void> {
  const actor = await getUserByIdAndTenant(db, actorId, tenantId);
  const target = await getUserByIdAndTenant(db, targetId, tenantId);

  if (!actor) throw serviceError("Actor não encontrado.", "actor_not_found", 404);
  if (!target) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (target.status === "deleted")
    throw serviceError("Utilizador já eliminado.", "user_deleted", 409);
  if (target.status === "active")
    throw serviceError("Utilizador já activo.", "already_active", 409);

  validateHierarchy(actor, target, "deactivate");

  await updateUserStatus(db, targetId, tenantId, "active");
}

/**
 * Soft delete de utilizador:
 * 1. Valida hierarquia
 * 2. Invalida todas as sessões do utilizador
 * 3. Cancela convites pendentes do utilizador
 * 4. Anonimiza dados pessoais (nome, email, phone, website, avatar)
 */
export async function deleteTeamUser(
  db: D1Database,
  actorId: string,
  targetId: string,
  tenantId: string,
  targetRole: "collaborator" | "member" | "client",
): Promise<void> {
  const actor = await getUserByIdAndTenant(db, actorId, tenantId);
  const target = await getUserByIdAndTenant(db, targetId, tenantId);

  if (!actor) throw serviceError("Actor não encontrado.", "actor_not_found", 404);
  if (!target) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (target.status === "deleted")
    throw serviceError("Utilizador já eliminado.", "user_deleted", 409);

  const action = targetRole === "member" ? "delete_member" : "delete_collaborator";
  validateHierarchy(actor, target, action);

  // Invalidar sessões activas
  await deleteAllUserSessions(db, targetId);

  // Soft delete: anonimiza dados pessoais
  await softDeleteUser(db, targetId, tenantId);
}

// ── Permissões de módulos ─────────────────────────────────────────────────────

export async function updatePermissions(
  db: D1Database,
  actorId: string,
  targetId: string,
  tenantId: string,
  permissions: Record<string, unknown>,
): Promise<void> {
  const actor = await getUserByIdAndTenant(db, actorId, tenantId);
  const target = await getUserByIdAndTenant(db, targetId, tenantId);

  if (!actor) throw serviceError("Actor não encontrado.", "actor_not_found", 404);
  if (!target) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (target.role !== "collaborator" && target.role !== "client") {
    throw serviceError(
      "Permissões de módulo só se aplicam a colaboradores ou clientes.",
      "not_collaborator_or_client",
      400,
    );
  }
  if (target.status === "deleted") throw serviceError("Utilizador eliminado.", "user_deleted", 409);

  validateHierarchy(actor, target, "permissions");

  await updateUserModulePermissions(db, targetId, tenantId, permissions);
}

// ── Convites de equipa ────────────────────────────────────────────────────────

export async function listTeamInvitations(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string; status?: string },
): Promise<{ rows: InvitationPublic[]; nextCursor: string | null }> {
  return listInvitationsByTenant(db, tenantId, opts);
}

export async function cancelTeamInvitation(
  db: D1Database,
  actorId: string,
  invitationId: string,
  tenantId: string,
): Promise<void> {
  const actor = await getUserByIdAndTenant(db, actorId, tenantId);
  if (!actor) throw serviceError("Actor não encontrado.", "actor_not_found", 404);

  const isOwnerFixed = actor.is_owner === 1 && actor.is_temp_owner === 0;
  const isOwnerTemp = actor.is_temp_owner === 1;
  const isMember = actor.role === "member" && !isOwnerFixed && !isOwnerTemp;

  if (!isOwnerFixed && !isOwnerTemp && !isMember) {
    throw serviceError("Acesso insuficiente.", "requires_admin", 403);
  }

  await cancelInvitation(db, invitationId, tenantId);
}

export async function deleteTeamInvitation(
  db: D1Database,
  actorId: string,
  invitationId: string,
  tenantId: string,
): Promise<void> {
  const actor = await getUserByIdAndTenant(db, actorId, tenantId);
  if (!actor) throw serviceError("Actor não encontrado.", "actor_not_found", 404);

  const isOwnerFixed = actor.is_owner === 1 && actor.is_temp_owner === 0;
  const isOwnerTemp = actor.is_temp_owner === 1;
  const isMember = actor.role === "member" && !isOwnerFixed && !isOwnerTemp;

  if (!isOwnerFixed && !isOwnerTemp && !isMember) {
    throw serviceError("Acesso insuficiente.", "requires_admin", 403);
  }

  await deleteInvitation(db, invitationId, tenantId);
}

// ── Actualizar role de utilizador ─────────────────────────────────────────────

export async function changeUserRole(
  db: D1Database,
  actorId: string,
  targetId: string,
  tenantId: string,
  newRole: "tenant_admin" | "member" | "collaborator" | "client",
): Promise<UserPublic> {
  const actor = await getUserByIdAndTenant(db, actorId, tenantId);
  const target = await getUserByIdAndTenant(db, targetId, tenantId);

  if (!actor) throw serviceError("Actor não encontrado.", "actor_not_found", 404);
  if (!target) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (target.status === "deleted") throw serviceError("Utilizador eliminado.", "user_deleted", 409);

  const isOwnerFixed = actor.is_owner === 1 && actor.is_temp_owner === 0;
  const isOwnerTemp = actor.is_temp_owner === 1;
  if (!isOwnerFixed && !isOwnerTemp) {
    throw serviceError("Apenas owners podem alterar roles.", "requires_owner", 403);
  }
  if (target.is_owner === 1) {
    throw serviceError("Não é possível alterar o role do owner.", "target_is_owner", 403);
  }
  if (actor.id === target.id) {
    throw serviceError("Não pode alterar o seu próprio role.", "self_action", 403);
  }

  await updateUserRole(db, targetId, tenantId, newRole);

  const updated = await getUserByIdAndTenant(db, targetId, tenantId);
  if (!updated) throw serviceError("Erro ao actualizar utilizador.", "update_failed", 500);
  return updated;
}
