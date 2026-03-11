/**
 * types/roles.ts — Hierarquia de papéis (briefing.md §2)
 *
 * Hierarquia:
 *   super_user > owner_fixo > owner_temporario > partner > collaborator
 *
 * R: briefing.md §2 — Role Hierarchy
 */

export type UserRole =
  | "super_user"
  | "owner_fixo"
  | "owner_temporario"
  | "partner"
  | "collaborator";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_user: 100,
  owner_fixo: 80,
  owner_temporario: 70,
  partner: 50,
  collaborator: 10,
};

/**
 * Verifica se um papel tem permissão mínima para um nível
 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Papéis considerados "admin" de uma empresa
 */
export const ADMIN_ROLES: UserRole[] = ["owner_fixo", "owner_temporario", "partner"];

/**
 * Papéis que podem gerir membros
 */
export const MANAGE_ROLES: UserRole[] = ["owner_fixo", "owner_temporario"];
