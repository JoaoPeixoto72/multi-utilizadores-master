/**
 * db/queries/users.ts — Queries de utilizadores
 *
 * R: STACK_LOCK.md §7 — único local de SQL, prepared statements
 * R: STACK_LOCK.md §7 — IDOR: owner/tenant verificado antes de mutações
 * R: G10 — zero SQL inline fora deste directório
 * R: GS09 — pass_hash NUNCA em respostas JSON
 */

export interface UserRow {
  id: string;
  email: string;
  pass_hash: string;
  tenant_id: string | null;
  role: "super_user" | "tenant_admin" | "member" | "collaborator" | "client";
  is_owner: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  website: string | null;
  avatar_key: string | null;
  preferred_language: string;
  status: "active" | "inactive" | "deleted";
  is_temp_owner: number;
  temp_owner_expires_at: number | null;
  email_pending: string | null;
  email_token: string | null;
  email_token_expires_at: number | null;
  created_at: number;
  updated_at: number;
}

export type UserPublic = Omit<UserRow, "pass_hash" | "email_token">;

// Projecção segura — sem pass_hash, sem email_token
const USER_PUBLIC_COLS = `
  id, email, tenant_id, role, is_owner,
  display_name, first_name, last_name, phone, website, avatar_key, preferred_language,
  status, is_temp_owner, temp_owner_expires_at,
  email_pending,
  created_at, updated_at
`.trim();

// Projecção interna — inclui pass_hash (só para auth)
const USER_FULL_COLS = `
  id, email, pass_hash, tenant_id, role, is_owner,
  display_name, first_name, last_name, phone, website, avatar_key, preferred_language,
  status, is_temp_owner, temp_owner_expires_at,
  email_pending, email_token, email_token_expires_at,
  created_at, updated_at
`.trim();

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const result = await db
    .prepare(`SELECT ${USER_FULL_COLS} FROM users WHERE email = ?1`)
    .bind(email.toLowerCase().trim())
    .first<UserRow>();
  return result ?? null;
}

export async function getUserById(db: D1Database, id: string): Promise<UserPublic | null> {
  const result = await db
    .prepare(`SELECT ${USER_PUBLIC_COLS} FROM users WHERE id = ?1`)
    .bind(id)
    .first<UserPublic>();
  return result ?? null;
}

export async function getUserByIdAndTenant(
  db: D1Database,
  id: string,
  tenantId: string,
): Promise<UserPublic | null> {
  const result = await db
    .prepare(`SELECT ${USER_PUBLIC_COLS} FROM users WHERE id = ?1 AND tenant_id = ?2`)
    .bind(id, tenantId)
    .first<UserPublic>();
  return result ?? null;
}

export async function getTenantOwner(db: D1Database, tenantId: string): Promise<UserPublic | null> {
  const result = await db
    .prepare(
      `SELECT ${USER_PUBLIC_COLS} FROM users
       WHERE tenant_id = ?1 AND is_owner = 1 AND is_temp_owner = 0
         AND status != 'deleted'`,
    )
    .bind(tenantId)
    .first<UserPublic>();
  return result ?? null;
}

export async function countUsersByTenant(
  db: D1Database,
  tenantId: string,
): Promise<{
  admins: number;
  members: number;
  collaborators: number;
  clients: number;
  total: number;
}> {
  const result = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN role = 'tenant_admin' THEN 1 ELSE 0 END) as admins,
         SUM(CASE WHEN role = 'member'       THEN 1 ELSE 0 END) as members,
         SUM(CASE WHEN role = 'collaborator' THEN 1 ELSE 0 END) as collaborators,
         SUM(CASE WHEN role = 'client'       THEN 1 ELSE 0 END) as clients,
         COUNT(*) as total
       FROM users
       WHERE tenant_id = ?1 AND status != 'deleted'`,
    )
    .bind(tenantId)
    .first<{
      admins: number;
      members: number;
      collaborators: number;
      clients: number;
      total: number;
    }>();
  return {
    admins: result?.admins ?? 0,
    members: result?.members ?? 0,
    collaborators: result?.collaborators ?? 0,
    clients: result?.clients ?? 0,
    total: result?.total ?? 0,
  };
}

export async function countUsers(db: D1Database): Promise<number> {
  const result = await db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
  return result?.count ?? 0;
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  pass_hash: string;
  tenant_id?: string | null;
  role?: "super_user" | "tenant_admin" | "member" | "collaborator" | "client";
  is_owner?: 0 | 1;
  display_name?: string;
  preferred_language?: string;
}

export async function createUser(db: D1Database, input: CreateUserInput): Promise<UserPublic> {
  const result = await db
    .prepare(
      `INSERT INTO users (email, pass_hash, tenant_id, role, is_owner, display_name, preferred_language)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       RETURNING ${USER_PUBLIC_COLS}`,
    )
    .bind(
      input.email.toLowerCase().trim(),
      input.pass_hash,
      input.tenant_id ?? null,
      input.role ?? "collaborator",
      input.is_owner ?? 0,
      input.display_name ?? null,
      input.preferred_language ?? "pt",
    )
    .first<UserPublic>();

  if (!result) throw new Error("Failed to create user");
  return result;
}

export async function updateUserPassword(
  db: D1Database,
  userId: string,
  passHash: string,
): Promise<void> {
  await db
    .prepare("UPDATE users SET pass_hash = ?1, updated_at = unixepoch() WHERE id = ?2")
    .bind(passHash, userId)
    .run();
}

export async function updateUserStatus(
  db: D1Database,
  userId: string,
  tenantId: string,
  status: "active" | "inactive",
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET status = ?1, updated_at = unixepoch()
       WHERE id = ?2 AND tenant_id = ?3`,
    )
    .bind(status, userId, tenantId)
    .run();
}

export async function softDeleteUser(
  db: D1Database,
  userId: string,
  tenantId: string,
): Promise<void> {
  // Anonimiza: nome genérico, email único inválido, limpa dados pessoais
  const deletedEmail = `deleted_${userId}@removed.invalid`;
  await db
    .prepare(
      `UPDATE users
       SET status            = 'deleted',
           email             = ?1,
           display_name      = 'Removed User',
           phone             = NULL,
           website           = NULL,
           avatar_key        = NULL,
           is_temp_owner     = 0,
           temp_owner_expires_at = NULL,
           updated_at        = unixepoch()
       WHERE id = ?2 AND tenant_id = ?3`,
    )
    .bind(deletedEmail, userId, tenantId)
    .run();
}

export async function setTempOwner(
  db: D1Database,
  userId: string,
  tenantId: string,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET is_temp_owner = 1, temp_owner_expires_at = ?1, updated_at = unixepoch()
       WHERE id = ?2 AND tenant_id = ?3 AND role = 'member'`,
    )
    .bind(expiresAt, userId, tenantId)
    .run();
}

export async function revokeTempOwner(
  db: D1Database,
  userId: string,
  tenantId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET is_temp_owner = 0, temp_owner_expires_at = NULL, updated_at = unixepoch()
       WHERE id = ?1 AND tenant_id = ?2`,
    )
    .bind(userId, tenantId)
    .run();
}

export async function expireStaleElevations(db: D1Database): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET is_temp_owner = 0, temp_owner_expires_at = NULL, updated_at = unixepoch()
       WHERE is_temp_owner = 1 AND temp_owner_expires_at < unixepoch()`,
    )
    .run();
}

// ── M3: Queries de equipa ─────────────────────────────────────────────────────

export interface TeamUserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: "tenant_admin" | "member" | "collaborator" | "client";
  is_owner: number;
  is_temp_owner: number;
  status: "active" | "inactive" | "deleted";
  created_at: number;
}

/**
 * Lista todos os colaboradores de um tenant (role='collaborator'), excluindo deleted.
 * Cursor-based pagination por created_at DESC.
 */
export async function listCollaboratorsByTenant(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string },
): Promise<{ rows: TeamUserRow[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit, 100);
  const bindings: (string | number)[] = [tenantId];
  let whereExtra = " AND role = 'collaborator'";

  if (opts.cursor) {
    whereExtra += ` AND created_at < ?${bindings.length + 1}`;
    bindings.push(Number(opts.cursor));
  }
  bindings.push(limit + 1);

  const rows = (
    await db
      .prepare(
        `SELECT id, email, display_name, role, is_owner, is_temp_owner, status, created_at
         FROM users
         WHERE tenant_id = ?1${whereExtra} AND status != 'deleted'
         ORDER BY created_at DESC LIMIT ?${bindings.length}`,
      )
      .bind(...bindings)
      .all<TeamUserRow>()
  ).results;

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(slice[slice.length - 1].created_at) : null;
  return { rows: slice, nextCursor };
}

/**
 * Lista todos os membros/sócios de um tenant (role='member'), excluindo deleted.
 */
export async function listMembersByTenant(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string },
): Promise<{ rows: TeamUserRow[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit, 100);
  const bindings: (string | number)[] = [tenantId];
  let whereExtra = " AND role IN ('member', 'tenant_admin')";

  if (opts.cursor) {
    whereExtra += ` AND created_at < ?${bindings.length + 1}`;
    bindings.push(Number(opts.cursor));
  }
  bindings.push(limit + 1);

  const rows = (
    await db
      .prepare(
        `SELECT id, email, display_name, role, is_owner, is_temp_owner, status, created_at
         FROM users
         WHERE tenant_id = ?1${whereExtra} AND status != 'deleted'
         ORDER BY created_at DESC LIMIT ?${bindings.length}`,
      )
      .bind(...bindings)
      .all<TeamUserRow>()
  ).results;

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(slice[slice.length - 1].created_at) : null;
  return { rows: slice, nextCursor };
}

/**
 * Lista todos os clientes de um tenant (role='client'), excluindo deleted.
 * Cursor-based pagination por created_at DESC.
 */
export async function listClientsByTenant(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string },
): Promise<{ rows: TeamUserRow[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit, 100);
  const bindings: (string | number)[] = [tenantId];
  let whereExtra = " AND role = 'client'";

  if (opts.cursor) {
    whereExtra += ` AND created_at < ?${bindings.length + 1}`;
    bindings.push(Number(opts.cursor));
  }
  bindings.push(limit + 1);

  const rows = (
    await db
      .prepare(
        `SELECT id, email, display_name, role, is_owner, is_temp_owner, status, created_at
         FROM users
         WHERE tenant_id = ?1${whereExtra} AND status != 'deleted'
         ORDER BY created_at DESC LIMIT ?${bindings.length}`,
      )
      .bind(...bindings)
      .all<TeamUserRow>()
  ).results;

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(slice[slice.length - 1].created_at) : null;
  return { rows: slice, nextCursor };
}

/**
 * Actualiza o role de um utilizador dentro de um tenant.
 * Usado para alterar permissões de módulos (tenant_admin <-> member <-> collaborator).
 */
export async function updateUserRole(
  db: D1Database,
  userId: string,
  tenantId: string,
  role: "tenant_admin" | "member" | "collaborator" | "client",
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET role = ?1, updated_at = unixepoch()
       WHERE id = ?2 AND tenant_id = ?3`,
    )
    .bind(role, userId, tenantId)
    .run();
}

/**
 * Retorna a matriz de permissões de módulos de todos os colaboradores de um tenant.
 * Inclui as permissões definidas no convite aceite (ou {} se não houver).
 */
export async function getPermissionsMatrix(
  db: D1Database,
  tenantId: string,
): Promise<
  { user_id: string; email: string; display_name: string | null; module_permissions: string }[]
> {
  const rows = (
    await db
      .prepare(
        `SELECT u.id as user_id, u.email, u.display_name,
                COALESCE(
                  (SELECT i.module_permissions
                   FROM invitations i
                   WHERE i.tenant_id = ?1 AND i.email = u.email AND i.status = 'accepted'
                   ORDER BY i.accepted_at DESC LIMIT 1),
                  '{}'
                ) as module_permissions
         FROM users u
         WHERE u.tenant_id = ?1 AND u.role IN ('collaborator', 'client') AND u.status != 'deleted'
         ORDER BY u.created_at ASC`,
      )
      .bind(tenantId)
      .all<{
        user_id: string;
        email: string;
        display_name: string | null;
        module_permissions: string;
      }>()
  ).results;
  return rows;
}

/**
 * Actualiza as permissões de módulos de um colaborador, gravando no convite aceite mais recente.
 * Se não existir convite, cria um registo temporário na tabela invitations com status='accepted'.
 * Abordagem: guarda as permissões directamente num campo `module_permissions` em users
 * via uma coluna adicional (adicionada em migração M3).
 */
export async function updateUserModulePermissions(
  db: D1Database,
  userId: string,
  tenantId: string,
  modulePermissions: Record<string, unknown>,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET module_permissions = ?1, updated_at = unixepoch()
       WHERE id = ?2 AND tenant_id = ?3`,
    )
    .bind(JSON.stringify(modulePermissions), userId, tenantId)
    .run();
}

// ── M5: Perfil ────────────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  website?: string | null;
  preferred_language?: string;
}

/**
 * Actualiza os campos de perfil do utilizador (sem email — alteração de email tem fluxo próprio).
 */
export async function updateUserProfile(
  db: D1Database,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserPublic | null> {
  const result = await db
    .prepare(
      `UPDATE users
       SET first_name         = COALESCE(?1, first_name),
           last_name          = COALESCE(?2, last_name),
           display_name       = COALESCE(?3, display_name),
           phone              = ?4,
           website            = ?5,
           preferred_language = COALESCE(?6, preferred_language),
           updated_at         = unixepoch()
       WHERE id = ?7 AND status != 'deleted'
       RETURNING ${USER_PUBLIC_COLS}`,
    )
    .bind(
      input.first_name ?? null,
      input.last_name ?? null,
      input.display_name ?? null,
      input.phone ?? null,
      input.website ?? null,
      input.preferred_language ?? null,
      userId,
    )
    .first<UserPublic>();
  return result ?? null;
}

/**
 * Actualiza o avatar_key do utilizador.
 */
export async function updateUserAvatar(
  db: D1Database,
  userId: string,
  avatarKey: string | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET avatar_key = ?1, updated_at = unixepoch()
       WHERE id = ?2 AND status != 'deleted'`,
    )
    .bind(avatarKey, userId)
    .run();
}

/**
 * Guarda token de confirmação de email pendente.
 */
export async function setEmailPending(
  db: D1Database,
  userId: string,
  emailPending: string,
  token: string,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET email_pending          = ?1,
           email_token            = ?2,
           email_token_expires_at = ?3,
           updated_at             = unixepoch()
       WHERE id = ?4 AND status != 'deleted'`,
    )
    .bind(emailPending, token, expiresAt, userId)
    .run();
}

/**
 * Confirma alteração de email (após validação de token).
 * Limpa o token e actualiza o email.
 */
export async function confirmEmailChange(
  db: D1Database,
  userId: string,
  newEmail: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET email                  = ?1,
           email_pending          = NULL,
           email_token            = NULL,
           email_token_expires_at = NULL,
           updated_at             = unixepoch()
       WHERE id = ?2 AND status != 'deleted'`,
    )
    .bind(newEmail, userId)
    .run();
}

/**
 * Lookup de utilizador por email_token (para confirmar alteração de email).
 */
export async function getUserByEmailToken(db: D1Database, token: string): Promise<UserRow | null> {
  const result = await db
    .prepare(`SELECT ${USER_FULL_COLS} FROM users WHERE email_token = ?1`)
    .bind(token)
    .first<UserRow>();
  return result ?? null;
}

/**
 * Limpa token de confirmação de email expirado ou cancelado.
 */
export async function clearEmailPending(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET email_pending          = NULL,
           email_token            = NULL,
           email_token_expires_at = NULL,
           updated_at             = unixepoch()
       WHERE id = ?1`,
    )
    .bind(userId)
    .run();
}

/**
 * Verifica se um email já está em uso (activo ou pendente de confirmação).
 */
export async function isEmailTaken(db: D1Database, email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const row = await db
    .prepare(
      `SELECT id FROM users
       WHERE (email = ?1 OR email_pending = ?1) AND status != 'deleted'
       LIMIT 1`,
    )
    .bind(normalized)
    .first<{ id: string }>();
  return row !== null;
}
