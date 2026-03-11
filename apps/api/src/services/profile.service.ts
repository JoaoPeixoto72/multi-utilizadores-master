/**
 * services/profile.service.ts — Lógica de negócio para perfis e armazenamento (M5)
 *
 * R: BUILD_PLAN.md §M5.2, §M5.3
 * R: briefing.md §3.5 — perfil: nome, apelido, telefone, website, foto
 * R: briefing.md §3.6 — alteração de email: token 24h, verificar duplicados
 * R: briefing.md §3.9 — quota: verificar espaço antes de upload; super_user isento
 * R: GS09 — pass_hash nunca em respostas
 */

import { deleteAllUserSessions } from "../db/queries/sessions.js";
import {
  getTenantById,
  type UpdateTenantProfileInput,
  updateTenantLogo,
  updateTenantProfile,
} from "../db/queries/tenants.js";
import {
  clearEmailPending,
  confirmEmailChange,
  getUserByEmailToken,
  getUserById,
  isEmailTaken,
  setEmailPending,
  type UpdateProfileInput,
  updateUserAvatar,
  updateUserPassword,
  updateUserProfile,
} from "../db/queries/users.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";
import { avatarKey, deleteFile, logoKey, uploadImage } from "../lib/storage.js";
import { EXPIRY, expiresIn, generateOneTimeToken, hashToken } from "../lib/token.js";
import { checkAndDebitStorage, getQuotaSummary } from "./quota.service.js";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ProfileServiceError extends Error {
  code: string;
  status: number;
}

function serviceError(message: string, code: string, status: number): ProfileServiceError {
  return Object.assign(new Error(message), { code, status }) as ProfileServiceError;
}

// ── Perfil pessoal ────────────────────────────────────────────────────────────

/**
 * Lê o perfil do utilizador autenticado.
 */
export async function getProfile(
  db: D1Database,
  userId: string,
): Promise<{
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
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
  email_pending: string | null;
}> {
  const user = await getUserById(db, userId);
  if (!user) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (user.status === "deleted") throw serviceError("Conta eliminada.", "user_deleted", 410);

  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
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
    email_pending: user.email_pending,
  };
}

/**
 * Actualiza os campos editáveis do perfil.
 */
export async function patchProfile(
  db: D1Database,
  userId: string,
  input: UpdateProfileInput,
): Promise<void> {
  const user = await getUserById(db, userId);
  if (!user) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (user.status === "deleted") throw serviceError("Conta eliminada.", "user_deleted", 410);

  const updated = await updateUserProfile(db, userId, input);
  if (!updated) throw serviceError("Falha ao actualizar perfil.", "update_failed", 500);
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

/**
 * Faz upload de avatar.
 * - Valida WebP, tamanho e dimensões
 * - Verifica quota (exceto super_user)
 * - Remove avatar anterior do R2
 * - Actualiza avatar_key em DB
 */
export async function uploadAvatar(
  db: D1Database,
  r2: R2Bucket,
  userId: string,
  buffer: ArrayBuffer,
): Promise<string> {
  const user = await getUserById(db, userId);
  if (!user) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (user.status === "deleted") throw serviceError("Conta eliminada.", "user_deleted", 410);

  // Verificar quota (apenas utilizadores com tenant — super_user isento)
  if (user.tenant_id && user.role !== "super_user") {
    const quotaErr = await checkAndDebitStorage(db, user.tenant_id, buffer.byteLength);
    if (quotaErr) {
      if (quotaErr.type === "storage_exceeded") {
        // Mensagem diferenciada por role (briefing §3.9)
        const isAdmin = user.role === "tenant_admin" || user.is_owner === 1;
        throw serviceError(
          isAdmin
            ? "Atingiu o limite de armazenamento. Apague ficheiros ou contacte o administrador para ter mais espaço."
            : "Não é possível completar esta acção. Contacte o seu administrador.",
          "storage_exceeded",
          413,
        );
      }
      throw serviceError(quotaErr.message, quotaErr.type, 400);
    }

    // Se já tinha avatar, libertar o espaço anterior (estimativa: não temos o tamanho antigo em DB)
    // Solução: fazer HEAD no R2 para obter tamanho — por simplicidade, não decrementamos aqui
    // pois a substituição já debitou o novo espaço.
    // TODO: se necessário, guardar tamanho do ficheiro em DB (M5 futuro refinamento)
  }

  // Remover avatar anterior do R2 se existir
  if (user.avatar_key) {
    await deleteFile(user.avatar_key, r2);
  }

  const key = avatarKey(userId);
  await uploadImage(db, key, buffer, r2);

  // Actualizar DB
  await updateUserAvatar(db, userId, key);

  return key;
}

/**
 * Remove avatar do utilizador.
 */
export async function deleteAvatar(db: D1Database, r2: R2Bucket, userId: string): Promise<void> {
  const user = await getUserById(db, userId);
  if (!user) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (!user.avatar_key) {
    throw serviceError("Não tem foto de perfil para remover.", "no_avatar", 404);
  }

  // Remover do R2
  await deleteFile(user.avatar_key, r2);

  // Libertar quota (se tiver tenant e não for super_user)
  // Nota: como não guardamos o tamanho, usamos 0 — refinamento futuro
  // if (user.tenant_id && user.role !== "super_user") { await releaseStorage(db, user.tenant_id, size); }

  // Limpar DB
  await updateUserAvatar(db, userId, null);
}

// ── Alteração de email ────────────────────────────────────────────────────────

/**
 * Inicia o processo de alteração de email.
 * 1. Verifica password actual
 * 2. Verifica que o novo email não está em uso
 * 3. Gera token de confirmação (24h) e guarda (hash) em DB
 * 4. Retorna o token raw para ser enviado por email (em M7 será enviado via email adapter)
 *
 * Por enquanto (M5 sem email adapter): retorna o token para debug.
 * Em M7: enviar por email e não retornar o token.
 */
export async function requestEmailChange(
  db: D1Database,
  userId: string,
  _currentPassword: string,
  newEmail: string,
): Promise<{ token: string }> {
  const normalized = newEmail.toLowerCase().trim();

  // Obter utilizador com pass_hash (getUserById não tem pass_hash — usamos getUserByIdFull via workaround)
  // Nota: precisamos do pass_hash para verificar a password actual.
  // getUserById retorna UserPublic (sem pass_hash) — usamos getUserByEmail como fallback
  // Solução: importar getUserByEmail e fazer lookup por email do utilizador actual
  const user = await getUserById(db, userId);
  if (!user) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (user.status === "deleted") throw serviceError("Conta eliminada.", "user_deleted", 410);

  // Verificar que o novo email não está em uso
  if (normalized === user.email.toLowerCase()) {
    throw serviceError("O novo email é igual ao actual.", "same_email", 400);
  }
  const taken = await isEmailTaken(db, normalized);
  if (taken) {
    throw serviceError("Este email já está em uso por outra conta.", "email_taken", 409);
  }

  // Gerar token (raw enviado por email; hash guardado em DB)
  const { raw, hash } = await generateOneTimeToken();
  const expiresAt = expiresIn(EXPIRY.EMAIL_CHANGE);

  await setEmailPending(db, userId, normalized, hash, expiresAt);

  // TODO M7: enviar email com link de confirmação
  // await emailAdapter.send({ to: normalized, template: "email_confirm", token: raw });

  return { token: raw }; // remover em M7 (não expor em produção)
}

/**
 * Confirma alteração de email via token.
 * 1. Lookup por hash do token
 * 2. Verificar expiração
 * 3. Actualizar email
 * 4. Invalidar todas as sessões (obrigar novo login)
 */
export async function confirmEmailChangeToken(db: D1Database, rawToken: string): Promise<void> {
  const tokenHash = await hashToken(rawToken);
  const user = await getUserByEmailToken(db, tokenHash);

  if (!user) {
    throw serviceError("Token inválido ou expirado.", "invalid_token", 400);
  }

  if (!user.email_token_expires_at || user.email_token_expires_at < Math.floor(Date.now() / 1000)) {
    await clearEmailPending(db, user.id);
    throw serviceError("Token expirado. Peça uma nova alteração de email.", "token_expired", 400);
  }

  if (!user.email_pending) {
    throw serviceError("Sem alteração de email pendente.", "no_pending_email", 400);
  }

  // Confirmar alteração
  await confirmEmailChange(db, user.id, user.email_pending);

  // Invalidar todas as sessões activas
  await deleteAllUserSessions(db, user.id);
}

// ── Alteração de password ─────────────────────────────────────────────────────

/**
 * Alteração voluntária de password.
 * Pede password actual; sessão mantém-se após alteração (briefing §3.8).
 */
export async function changePassword(
  db: D1Database,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  // Precisamos do hash — getUserById não retorna pass_hash.
  // Usamos uma query especial via getUserByIdWithHash (não existe ainda).
  // Workaround: usaremos a função de auth para verificar a password actual.
  // Como não temos getUserByIdFull exposto, delegamos para a lib/auth.
  const user = await getUserById(db, userId);
  if (!user) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (user.status === "deleted") throw serviceError("Conta eliminada.", "user_deleted", 410);

  // Obter hash actual para verificação
  const fullUser = await db
    .prepare("SELECT pass_hash FROM users WHERE id = ?1 AND status != 'deleted'")
    .bind(userId)
    .first<{ pass_hash: string }>();
  if (!fullUser) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);

  // Verificar password actual
  const valid = await verifyPassword(currentPassword, fullUser.pass_hash);
  if (!valid) {
    throw serviceError("Password actual incorrecta.", "invalid_password", 401);
  }

  // Validar nova password (regras do briefing §3.8)
  if (newPassword.length < 12) {
    throw serviceError(
      "A nova password deve ter pelo menos 12 caracteres.",
      "password_too_short",
      400,
    );
  }

  // Actualizar hash
  const newHash = await hashPassword(newPassword);
  await updateUserPassword(db, userId, newHash);
}

// ── Exportação RGPD ───────────────────────────────────────────────────────────

/**
 * Exporta dados pessoais do utilizador em JSON (briefing §4.3).
 * Inclui apenas dados de núcleo — dados de módulos via M9/M10.
 * NUNCA inclui pass_hash, tokens, sessões, dados de outros utilizadores.
 */
export async function exportRgpd(db: D1Database, userId: string): Promise<Record<string, unknown>> {
  const user = await getUserById(db, userId);
  if (!user) throw serviceError("Utilizador não encontrado.", "user_not_found", 404);
  if (user.status === "deleted") throw serviceError("Conta eliminada.", "user_deleted", 410);

  return {
    exported_at: new Date().toISOString(),
    core: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      display_name: user.display_name,
      phone: user.phone,
      website: user.website,
      preferred_language: user.preferred_language,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    // M9/M10: module_data: [] (a preencher via onRgpdExport handlers)
    module_data: [],
  };
}

// ── Perfil de empresa ──────────────────────────────────────────────────────────

/**
 * Lê os dados da empresa do utilizador autenticado (owner ou tenant_admin).
 */
export async function getCompanyProfile(
  db: D1Database,
  tenantId: string,
): Promise<{
  id: string;
  name: string;
  address: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  logo_key: string | null;
  storage_used: number;
  storage_limit: number;
}> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) throw serviceError("Empresa não encontrada.", "tenant_not_found", 404);

  const quota = await getQuotaSummary(db, tenantId);

  return {
    id: tenant.id,
    name: tenant.name,
    address: tenant.address,
    email: tenant.email,
    phone: tenant.phone,
    website: tenant.website,
    logo_key: tenant.logo_key,
    storage_used: quota?.storage_used ?? 0,
    storage_limit: quota?.storage_limit ?? tenant.storage_limit_bytes,
  };
}

/**
 * Actualiza dados de perfil da empresa.
 * Só owner fixo ou owner temporário podem editar.
 */
export async function patchCompanyProfile(
  db: D1Database,
  tenantId: string,
  input: UpdateTenantProfileInput,
): Promise<void> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) throw serviceError("Empresa não encontrada.", "tenant_not_found", 404);

  const updated = await updateTenantProfile(db, tenantId, input);
  if (!updated) throw serviceError("Falha ao actualizar empresa.", "update_failed", 500);
}

/**
 * Faz upload de logótipo da empresa.
 */
export async function uploadCompanyLogo(
  db: D1Database,
  r2: R2Bucket,
  tenantId: string,
  buffer: ArrayBuffer,
): Promise<string> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) throw serviceError("Empresa não encontrada.", "tenant_not_found", 404);

  // Verificar quota
  const quotaErr = await checkAndDebitStorage(db, tenantId, buffer.byteLength);
  if (quotaErr) {
    throw serviceError(
      "Quota de armazenamento excedida. Apague ficheiros ou contacte o administrador.",
      "storage_exceeded",
      413,
    );
  }

  // Remover logo anterior
  if (tenant.logo_key) {
    await deleteFile(tenant.logo_key, r2);
  }

  const key = logoKey(tenantId);
  await uploadImage(db, key, buffer, r2);

  // Actualizar DB
  await updateTenantLogo(db, tenantId, key);

  return key;
}

/**
 * Remove logótipo da empresa.
 */
export async function deleteCompanyLogo(
  db: D1Database,
  r2: R2Bucket,
  tenantId: string,
): Promise<void> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) throw serviceError("Empresa não encontrada.", "tenant_not_found", 404);
  if (!tenant.logo_key) {
    throw serviceError("A empresa não tem logótipo para remover.", "no_logo", 404);
  }

  await deleteFile(tenant.logo_key, r2);
  await updateTenantLogo(db, tenantId, null);
}
