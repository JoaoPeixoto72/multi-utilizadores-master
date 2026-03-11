/**
 * services/user.service.ts — Operações do utilizador autenticado (M4)
 *
 * R: BUILD_PLAN.md §M4.1
 * R: briefing.md §2 — hierarquia: colaborador pode auto-eliminar-se;
 *                      sócio só se não for owner temporário
 * R: STACK_LOCK.md §5 — IDOR: user_id verificado antes de mutações
 */

import { deleteAllUserSessions } from "../db/queries/sessions.js";
import { getUserById, softDeleteUser } from "../db/queries/users.js";
import { getRegisteredModules } from "../lib/module-registry.js";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface UserServiceError extends Error {
  code: string;
  status: number;
}

function serviceError(message: string, code: string, status: number): UserServiceError {
  return Object.assign(new Error(message), { code, status }) as UserServiceError;
}

// ── Módulos ───────────────────────────────────────────────────────────────────

/**
 * Retorna os módulos disponíveis para o utilizador autenticado.
 * - super_user: acesso a todos os módulos (vazio por enquanto — M10)
 * - tenant_admin / member (owner): acesso a todos os módulos do tenant
 * - collaborator: apenas módulos com permissão explícita
 *
 * Por ora os módulos são um stub — a lista real virá em M10.
 */
export interface ModuleEntry {
  id: string;
  name_key: string; // chave i18n
  has_access: boolean;
}

export function getUserModules(
  user: { role: string; is_owner: number; is_temp_owner: number },
  modulePermissions: Record<string, unknown>,
): ModuleEntry[] {
  // super_user: não tem módulos de empresa (painel próprio)
  if (user.role === "super_user") return [];

  // M10: usa registry real
  const allModules = getRegisteredModules();

  const isAdmin = user.role === "tenant_admin" || user.is_owner === 1 || user.is_temp_owner === 1;

  return allModules.map((mod) => ({
    id: mod.id,
    name_key: mod.name_key,
    has_access: isAdmin || Boolean(modulePermissions[mod.id]),
  }));
}

// ── Auto-eliminação ───────────────────────────────────────────────────────────

/**
 * Soft delete do próprio utilizador.
 *
 * Regras do briefing §2:
 * - Colaborador: sempre permitido
 * - Sócio (member): permitido se NOT is_temp_owner
 * - Owner fixo (is_owner=1, is_temp_owner=0): proibido — só via transferência (super user)
 * - super_user: proibido via esta rota
 *
 * Processo:
 * 1. Valida regras de permissão
 * 2. Invalida todas as sessões activas
 * 3. Soft delete (anonimiza dados pessoais)
 */
export async function selfDeleteUser(db: D1Database, userId: string): Promise<void> {
  const user = await getUserById(db, userId);

  if (!user) {
    throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  }
  if (user.status === "deleted") {
    throw serviceError("Utilizador já eliminado.", "user_deleted", 409);
  }

  // super_user: nunca permitido
  if (user.role === "super_user") {
    throw serviceError(
      "Super utilizadores não podem eliminar a própria conta por esta via.",
      "super_user_self_delete",
      403,
    );
  }

  // Owner fixo (is_owner=1, is_temp_owner=0): não pode eliminar-se
  if (user.is_owner === 1 && user.is_temp_owner === 0) {
    throw serviceError(
      "O owner fixo não pode eliminar a própria conta. Peça ao super user para transferir o ownership primeiro.",
      "owner_self_delete",
      403,
    );
  }

  // Sócio elevado como owner temporário: não pode eliminar-se enquanto estiver elevado
  if (user.is_temp_owner === 1) {
    throw serviceError(
      "Não é possível eliminar a conta enquanto está elevado como owner temporário.",
      "temp_owner_self_delete",
      403,
    );
  }

  // tenant_admin sem ownership: permitido
  // member sem elevação: permitido
  // collaborator: sempre permitido

  // Verificar tenant_id (necessário para soft delete com tenant check)
  if (!user.tenant_id) {
    throw serviceError("Utilizador sem empresa associada.", "no_tenant", 400);
  }

  // Invalidar sessões activas
  await deleteAllUserSessions(db, userId);

  // Soft delete + anonimização
  await softDeleteUser(db, userId, user.tenant_id);
}

// ── Perfil (leitura/escrita) ──────────────────────────────────────────────────

export interface UserProfilePublic {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  website: string | null;
  avatar_key: string | null;
  preferred_language: string;
  role: string;
  is_owner: number;
  is_temp_owner: number;
  tenant_id: string | null;
  status: string;
}

/**
 * Obtém o perfil público do utilizador autenticado.
 */
export async function getUserProfile(db: D1Database, userId: string): Promise<UserProfilePublic> {
  const user = await getUserById(db, userId);

  if (!user) {
    throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  }
  if (user.status === "deleted") {
    throw serviceError("Conta eliminada.", "user_deleted", 410);
  }

  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    phone: user.phone,
    website: user.website,
    avatar_key: user.avatar_key,
    preferred_language: user.preferred_language,
    role: user.role,
    is_owner: user.is_owner,
    is_temp_owner: user.is_temp_owner,
    tenant_id: user.tenant_id,
    status: user.status,
  };
}

// ── Módulos do utilizador (helper para a rota) ────────────────────────────────

/**
 * Obtém o perfil + módulos disponíveis do utilizador autenticado.
 * Usado pelo endpoint GET /api/user/modules.
 */
export async function getUserModulesWithProfile(
  db: D1Database,
  userId: string,
): Promise<{ modules: ModuleEntry[]; profile: UserProfilePublic }> {
  const profile = await getUserProfile(db, userId);

  // module_permissions: obtido do campo users.module_permissions (M3 migration)
  // Para M4 retorna estrutura vazia (módulos reais em M10)
  const modulePermissions: Record<string, unknown> = {};

  const modules = getUserModules(
    {
      role: profile.role,
      is_owner: profile.is_owner,
      is_temp_owner: profile.is_temp_owner,
    },
    modulePermissions,
  );

  return { modules, profile };
}
