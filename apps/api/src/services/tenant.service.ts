/**
 * services/tenant.service.ts — Lógica de gestão de empresas
 *
 * R: BUILD_PLAN.md §M2.3
 * R: briefing.md §1.2 — criação atómica tenant + convite owner
 * R: R09 — sem floating promises
 */

import { getAppConfig } from "../db/queries/app-config.js";
import {
  type CreateTenantInput,
  createTenant,
  physicalDeleteTenant,
  type TenantRow,
  updateTenantOwner,
  updateTenantStatus,
} from "../db/queries/tenants.js";
import {
  createUser,
  revokeTempOwner as dbRevokeTempOwner,
  setTempOwner as dbSetTempOwner,
  expireStaleElevations,
  getTenantOwner,
  getUserByEmail,
  getUserByIdAndTenant,
} from "../db/queries/users.js";
import { initTenantModuleLimits } from "../lib/module-registry.js";
import { createOwnerInvitation, type InvitationResult } from "./invitation.service.js";

// Tempo por defeito para owner temporário: 24h em segundos (fallback)
const FALLBACK_TEMP_OWNER_SECONDS = 24 * 60 * 60;

async function getTempOwnerTTL(db: D1Database): Promise<number> {
  const val = await getAppConfig(db, "sys_temp_owner_ttl_seconds");
  return val ? parseInt(val, 10) : FALLBACK_TEMP_OWNER_SECONDS;
}

// ── Criar empresa + convite owner (atómico) ───────────────────────────────────

export interface CreateTenantWithOwnerInput extends CreateTenantInput {
  ownerEmail: string;
  ownerLanguage?: string;
  invitedBy: string; // userId do super_user
}

export interface CreateTenantResult {
  tenant: TenantRow;
  invitation: InvitationResult;
}

export async function createTenantWithOwnerInvite(
  db: D1Database,
  input: CreateTenantWithOwnerInput,
): Promise<CreateTenantResult> {
  // Pre-validação do email do owner (não criar empresa se email já estiver em uso)
  const existingUser = await getUserByEmail(db, input.ownerEmail);
  if (existingUser) {
    throw Object.assign(new Error("Email já registado na plataforma."), { code: "email_taken" });
  }

  // 1. Criar empresa
  const tenant = await createTenant(db, {
    name: input.name,
    email: input.email,
    address: input.address,
    phone: input.phone,
    website: input.website,
    admin_seat_limit: input.admin_seat_limit,
    member_seat_limit: input.member_seat_limit,
    client_seat_limit: input.client_seat_limit,
    storage_limit_bytes: input.storage_limit_bytes,
    daily_email_limit: input.daily_email_limit,
  });

  // 2. Inicializar limites de módulos para a nova empresa (M10)
  // Tolerante a falhas — não bloqueia a criação
  try {
    await initTenantModuleLimits(db, tenant.id);
  } catch {
    // Não bloquear
  }

  // 3. Criar convite de owner para a empresa recém-criada
  // Se falhar, a empresa fica criada mas sem convite — o super user pode reenviar
  const invitation = await createOwnerInvitation(db, {
    tenantId: tenant.id,
    email: input.ownerEmail,
    language: input.ownerLanguage ?? "pt",
    invitedBy: input.invitedBy,
  });

  return { tenant, invitation };
}

// ── Aceitar convite de owner (cria utilizador) ────────────────────────────────

export interface AcceptOwnerInviteInput {
  tenantId: string;
  email: string;
  passHash: string;
  displayName?: string;
  language?: string;
}

export async function createOwnerUser(db: D1Database, input: AcceptOwnerInviteInput) {
  return createUser(db, {
    email: input.email,
    pass_hash: input.passHash,
    tenant_id: input.tenantId,
    role: "tenant_admin",
    is_owner: 1,
    display_name: input.displayName,
    preferred_language: input.language ?? "pt",
  });
}

// ── Desactivar empresa ────────────────────────────────────────────────────────

export async function deactivateTenant(db: D1Database, tenantId: string): Promise<void> {
  await updateTenantStatus(db, tenantId, "inactive");
  // Nota: invalidação de sessões é responsabilidade do handler (via deleteAllUserSessions)
}

// ── Reactivar empresa ─────────────────────────────────────────────────────────

export async function activateTenant(db: D1Database, tenantId: string): Promise<void> {
  await updateTenantStatus(db, tenantId, "active");
}

// ── Transferência de ownership ────────────────────────────────────────────────

export async function transferOwnership(
  db: D1Database,
  tenantId: string,
  newOwnerUserId: string,
): Promise<void> {
  const currentOwner = await getTenantOwner(db, tenantId);
  if (!currentOwner) {
    throw Object.assign(new Error("Owner actual não encontrado."), { code: "owner_not_found" });
  }

  const newOwner = await getUserByIdAndTenant(db, newOwnerUserId, tenantId);
  if (!newOwner) {
    throw Object.assign(new Error("Utilizador não encontrado nesta empresa."), {
      code: "user_not_found",
    });
  }
  if (newOwner.role !== "member") {
    throw Object.assign(new Error("Só sócios podem ser promovidos a owner."), {
      code: "invalid_role",
    });
  }

  // Atómico via batch D1
  await updateTenantOwner(db, tenantId, newOwnerUserId, currentOwner.id);

  // Remover elevação temporária se existir
  if (newOwner.is_temp_owner) {
    await dbRevokeTempOwner(db, newOwnerUserId, tenantId);
  }
}

// ── Elevação temporária ───────────────────────────────────────────────────────

export async function elevateTempOwner(
  db: D1Database,
  tenantId: string,
  userId: string,
  durationSeconds?: number,
): Promise<void> {
  const user = await getUserByIdAndTenant(db, userId, tenantId);
  if (!user) {
    throw Object.assign(new Error("Utilizador não encontrado."), { code: "user_not_found" });
  }
  if (user.role !== "member") {
    throw Object.assign(new Error("Só sócios podem ser elevados temporariamente."), {
      code: "invalid_role",
    });
  }
  if (user.is_temp_owner) {
    throw Object.assign(new Error("Utilizador já é owner temporário."), {
      code: "already_elevated",
    });
  }

  const ttl = durationSeconds ?? (await getTempOwnerTTL(db));
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  await dbSetTempOwner(db, userId, tenantId, expiresAt);
}

export async function revokeElevation(
  db: D1Database,
  tenantId: string,
  userId: string,
): Promise<void> {
  await dbRevokeTempOwner(db, userId, tenantId);
}

// ── Hard delete (cron + super user com confirmação) ───────────────────────────

export async function hardDeleteTenant(db: D1Database, tenantId: string): Promise<void> {
  // Verifica existência (incluindo soft-deleted)
  const tenant = await db
    .prepare(`SELECT id FROM tenants WHERE id = ?1`)
    .bind(tenantId)
    .first<{ id: string }>();

  if (!tenant) {
    throw Object.assign(new Error("Empresa não encontrada."), { code: "not_found" });
  }

  // Apagar sessões de todos os utilizadores da empresa antes do delete físico
  const users = (
    await db
      .prepare(`SELECT id FROM users WHERE tenant_id = ?1`)
      .bind(tenantId)
      .all<{ id: string }>()
  ).results;

  if (users.length > 0) {
    // Apagar sessões (não há import aqui, fazemos inline)
    for (const u of users) {
      await db.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(u.id).run();
    }
  }

  // Apagamento físico completo (liberta UNIQUE constraints de email)
  await physicalDeleteTenant(db, tenantId);
}

// ── Cron: expirar elevações ───────────────────────────────────────────────────

export async function expireElevations(db: D1Database): Promise<void> {
  await expireStaleElevations(db);
}
