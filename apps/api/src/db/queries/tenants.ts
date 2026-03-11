/**
 * db/queries/tenants.ts — Queries de empresas
 *
 * R: STACK_LOCK.md §7 — único local de SQL, prepared statements
 * R: BUILD_PLAN.md §M2.2
 * R: G10 — zero SQL inline fora deste directório
 */

export interface TenantRow {
  id: string;
  name: string;
  address: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  logo_key: string | null;
  admin_seat_limit: number;
  member_seat_limit: number;
  client_seat_limit: number;
  storage_limit_bytes: number;
  daily_email_limit: number;
  allowed_languages: string; // JSON array serializado
  status: "pending" | "active" | "inactive" | "deleted";
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface TenantLimits {
  admin_seat_limit: number;
  member_seat_limit: number;
  client_seat_limit: number;
  storage_limit_bytes: number;
  daily_email_limit: number;
}

// ── Leitura ────────────────────────────────────────────────────────────────────

export async function getTenantById(db: D1Database, id: string): Promise<TenantRow | null> {
  const result = await db
    .prepare(
      `SELECT id, name, address, email, phone, website, logo_key,
              admin_seat_limit, member_seat_limit, client_seat_limit,
              storage_limit_bytes,
              daily_email_limit, allowed_languages, status,
              created_at, updated_at, deleted_at
       FROM tenants WHERE id = ?1 AND deleted_at IS NULL`,
    )
    .bind(id)
    .first<TenantRow>();
  return result ?? null;
}

export async function getTenantByEmail(db: D1Database, email: string): Promise<TenantRow | null> {
  const result = await db
    .prepare(
      `SELECT id, name, address, email, phone, website, logo_key,
              admin_seat_limit, member_seat_limit, client_seat_limit,
              storage_limit_bytes,
              daily_email_limit, allowed_languages, status,
              created_at, updated_at, deleted_at
       FROM tenants WHERE email = ?1 AND deleted_at IS NULL`,
    )
    .bind(email.toLowerCase().trim())
    .first<TenantRow>();
  return result ?? null;
}

export interface TenantListRow {
  id: string;
  name: string;
  email: string;
  status: "pending" | "active" | "inactive" | "deleted";
  admin_seat_limit: number;
  member_seat_limit: number;
  client_seat_limit: number;
  user_count: number; // admins + members (seats ocupados)
  collab_count: number; // colaboradores (não contam para seats)
  client_count: number; // clientes
  created_at: number;
}

export async function listTenants(
  db: D1Database,
  opts: { limit: number; cursor?: string; status?: string },
): Promise<{ rows: TenantListRow[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit, 100);
  // JOIN com users para contar utilizadores activos por tenant
  const baseSelect = `SELECT t.id, t.name, t.email, t.status,
                             t.admin_seat_limit, t.member_seat_limit, t.client_seat_limit, t.created_at,
                             COUNT(CASE WHEN u.role IN ('tenant_admin','member') THEN 1 END) as user_count,
                             COUNT(CASE WHEN u.role = 'collaborator' THEN 1 END) as collab_count,
                             COUNT(CASE WHEN u.role = 'client' THEN 1 END) as client_count
                      FROM tenants t
                      LEFT JOIN users u ON u.tenant_id = t.id AND u.status != 'deleted'`;
  const baseGroup = `GROUP BY t.id`;
  let query: string;
  let bindings: (string | number)[];

  if (opts.cursor) {
    if (opts.status) {
      query = `${baseSelect}
               WHERE t.deleted_at IS NULL AND t.status = ?1 AND t.created_at < ?2
               ${baseGroup}
               ORDER BY t.created_at DESC LIMIT ?3`;
      bindings = [opts.status, Number(opts.cursor), limit + 1];
    } else {
      query = `${baseSelect}
               WHERE t.deleted_at IS NULL AND t.created_at < ?1
               ${baseGroup}
               ORDER BY t.created_at DESC LIMIT ?2`;
      bindings = [Number(opts.cursor), limit + 1];
    }
  } else {
    if (opts.status) {
      query = `${baseSelect}
               WHERE t.deleted_at IS NULL AND t.status = ?1
               ${baseGroup}
               ORDER BY t.created_at DESC LIMIT ?2`;
      bindings = [opts.status, limit + 1];
    } else {
      query = `${baseSelect}
               WHERE t.deleted_at IS NULL
               ${baseGroup}
               ORDER BY t.created_at DESC LIMIT ?1`;
      bindings = [limit + 1];
    }
  }

  const stmt = db.prepare(query);
  const rows = (await stmt.bind(...bindings).all<TenantListRow>()).results;

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(slice[slice.length - 1].created_at) : null;
  return { rows: slice, nextCursor };
}

export async function countTenantsByStatus(
  db: D1Database,
): Promise<{ pending: number; active: number; inactive: number }> {
  const result = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
       FROM tenants WHERE deleted_at IS NULL`,
    )
    .first<{ pending: number; active: number; inactive: number }>();
  return {
    pending: result?.pending ?? 0,
    active: result?.active ?? 0,
    inactive: result?.inactive ?? 0,
  };
}

// ── Escrita ────────────────────────────────────────────────────────────────────

export interface CreateTenantInput {
  name: string;
  email: string;
  address?: string;
  phone?: string;
  website?: string;
  admin_seat_limit?: number;
  member_seat_limit?: number;
  client_seat_limit?: number;
  storage_limit_bytes?: number;
  daily_email_limit?: number;
}

export async function createTenant(db: D1Database, input: CreateTenantInput): Promise<TenantRow> {
  const result = await db
    .prepare(
      `INSERT INTO tenants (name, email, address, phone, website,
         admin_seat_limit, member_seat_limit, client_seat_limit, storage_limit_bytes, daily_email_limit,
         status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending')
       RETURNING id, name, address, email, phone, website, logo_key,
                 admin_seat_limit, member_seat_limit, client_seat_limit, storage_limit_bytes,
                 daily_email_limit, allowed_languages, status,
                 created_at, updated_at, deleted_at`,
    )
    .bind(
      input.name,
      input.email.toLowerCase().trim(),
      input.address ?? null,
      input.phone ?? null,
      input.website ?? null,
      input.admin_seat_limit ?? 3,
      input.member_seat_limit ?? 0,
      input.client_seat_limit ?? 0,
      input.storage_limit_bytes ?? 1073741824,
      input.daily_email_limit ?? 100,
    )
    .first<TenantRow>();

  if (!result) throw new Error("Failed to create tenant");
  return result;
}

export async function updateTenantLimits(
  db: D1Database,
  tenantId: string,
  limits: Partial<TenantLimits>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (limits.admin_seat_limit !== undefined) {
    fields.push(`admin_seat_limit = ?${idx++}`);
    values.push(limits.admin_seat_limit);
  }
  if (limits.member_seat_limit !== undefined) {
    fields.push(`member_seat_limit = ?${idx++}`);
    values.push(limits.member_seat_limit);
  }
  if (limits.client_seat_limit !== undefined) {
    fields.push(`client_seat_limit = ?${idx++}`);
    values.push(limits.client_seat_limit);
  }
  if (limits.storage_limit_bytes !== undefined) {
    fields.push(`storage_limit_bytes = ?${idx++}`);
    values.push(limits.storage_limit_bytes);
  }
  if (limits.daily_email_limit !== undefined) {
    fields.push(`daily_email_limit = ?${idx++}`);
    values.push(limits.daily_email_limit);
  }
  if (fields.length === 0) return;

  fields.push(`updated_at = unixepoch()`);
  values.push(tenantId);

  await db
    .prepare(`UPDATE tenants SET ${fields.join(", ")} WHERE id = ?${idx}`)
    .bind(...values)
    .run();
}

export async function updateTenantStatus(
  db: D1Database,
  tenantId: string,
  status: "active" | "inactive",
): Promise<void> {
  await db
    .prepare("UPDATE tenants SET status = ?1, updated_at = unixepoch() WHERE id = ?2")
    .bind(status, tenantId)
    .run();
}

export async function softDeleteTenant(db: D1Database, tenantId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE tenants
       SET status = 'deleted', deleted_at = unixepoch(), updated_at = unixepoch()
       WHERE id = ?1`,
    )
    .bind(tenantId)
    .run();
}

/**
 * Apaga fisicamente a empresa e todos os dados associados (ON DELETE CASCADE).
 * Permite que o mesmo email seja reutilizado no futuro.
 */
export async function physicalDeleteTenant(db: D1Database, tenantId: string): Promise<void> {
  // Apagar utilizadores da empresa primeiro (para libertar o email UNIQUE nos users)
  await db
    .prepare(`DELETE FROM users WHERE tenant_id = ?1`)
    .bind(tenantId)
    .run();

  // Apagar convites pendentes associados à empresa (liberta emails de convite)
  await db
    .prepare(`DELETE FROM invitations WHERE tenant_id = ?1`)
    .bind(tenantId)
    .run();

  // Apagar a empresa (ON DELETE CASCADE trata o resto)
  await db
    .prepare(`DELETE FROM tenants WHERE id = ?1`)
    .bind(tenantId)
    .run();
}

export async function updateTenantOwner(
  db: D1Database,
  tenantId: string,
  newOwnerId: string,
  oldOwnerId: string,
): Promise<void> {
  // Atómico via batch: remove owner antigo, define novo owner
  await db.batch([
    db
      .prepare(
        "UPDATE users SET is_owner = 0, updated_at = unixepoch() WHERE id = ?1 AND tenant_id = ?2",
      )
      .bind(oldOwnerId, tenantId),
    db
      .prepare(
        "UPDATE users SET is_owner = 1, updated_at = unixepoch() WHERE id = ?1 AND tenant_id = ?2",
      )
      .bind(newOwnerId, tenantId),
  ]);
}

// ── M5: Perfil de empresa ─────────────────────────────────────────────────────

export interface UpdateTenantProfileInput {
  name?: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
}

/**
 * Actualiza dados de perfil da empresa (owner fixo ou owner temporário).
 */
export async function updateTenantProfile(
  db: D1Database,
  tenantId: string,
  input: UpdateTenantProfileInput,
): Promise<TenantRow | null> {
  const result = await db
    .prepare(
      `UPDATE tenants
       SET name       = COALESCE(?1, name),
           address    = ?2,
           phone      = ?3,
           website    = ?4,
           updated_at = unixepoch()
       WHERE id = ?5 AND deleted_at IS NULL
       RETURNING id, name, address, email, phone, website, logo_key,
                 admin_seat_limit, member_seat_limit, client_seat_limit, storage_limit_bytes,
                 daily_email_limit, allowed_languages, status,
                 created_at, updated_at, deleted_at`,
    )
    .bind(
      input.name ?? null,
      input.address ?? null,
      input.phone ?? null,
      input.website ?? null,
      tenantId,
    )
    .first<TenantRow>();
  return result ?? null;
}

/**
 * Actualiza o logo_key do tenant.
 */
export async function updateTenantLogo(
  db: D1Database,
  tenantId: string,
  logoKey: string | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE tenants SET logo_key = ?1, updated_at = unixepoch()
       WHERE id = ?2 AND deleted_at IS NULL`,
    )
    .bind(logoKey, tenantId)
    .run();
}
