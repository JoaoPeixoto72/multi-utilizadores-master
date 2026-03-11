/**
 * db/queries/invitations.ts — Queries de convites
 *
 * R: STACK_LOCK.md §7 — prepared statements, IDOR por tenant_id
 * R: BUILD_PLAN.md §M2.2
 * R: G10 — zero SQL inline fora deste directório
 */

export interface InvitationRow {
  id: string;
  tenant_id: string | null;
  email: string;
  role: "tenant_admin" | "member" | "collaborator" | "client";
  is_owner: number;
  invited_by: string;
  token_hash: string;
  module_permissions: string; // JSON
  language: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  created_at: number;
  expires_at: number;
  accepted_at: number | null;
  cancelled_at: number | null;
}

export type InvitationPublic = Omit<InvitationRow, "token_hash">;

// ── Leitura ────────────────────────────────────────────────────────────────────

export async function getInvitationByTokenHash(
  db: D1Database,
  tokenHash: string,
): Promise<InvitationRow | null> {
  const result = await db
    .prepare(
      `SELECT id, tenant_id, email, role, is_owner, invited_by, token_hash,
              module_permissions, language, status,
              created_at, expires_at, accepted_at, cancelled_at
       FROM invitations WHERE token_hash = ?1`,
    )
    .bind(tokenHash)
    .first<InvitationRow>();
  return result ?? null;
}

export async function getInvitationById(
  db: D1Database,
  id: string,
  tenantId: string,
): Promise<InvitationPublic | null> {
  const result = await db
    .prepare(
      `SELECT id, tenant_id, email, role, is_owner, invited_by,
              module_permissions, language, status,
              created_at, expires_at, accepted_at, cancelled_at
       FROM invitations WHERE id = ?1 AND tenant_id = ?2`,
    )
    .bind(id, tenantId)
    .first<InvitationPublic>();
  return result ?? null;
}

export async function getPendingInvitationByEmail(
  db: D1Database,
  email: string,
  tenantId: string,
): Promise<InvitationPublic | null> {
  const result = await db
    .prepare(
      `SELECT id, tenant_id, email, role, is_owner, invited_by,
              module_permissions, language, status,
              created_at, expires_at, accepted_at, cancelled_at
       FROM invitations
       WHERE email = ?1 AND tenant_id = ?2 AND status = 'pending'`,
    )
    .bind(email.toLowerCase().trim(), tenantId)
    .first<InvitationPublic>();
  return result ?? null;
}

export async function listInvitationsByTenant(
  db: D1Database,
  tenantId: string,
  opts: { limit: number; cursor?: string; status?: string },
): Promise<{ rows: InvitationPublic[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit, 100);
  const bindings: (string | number)[] = [tenantId];
  let whereExtra = "";

  if (opts.status) {
    whereExtra += " AND status = ?2";
    bindings.push(opts.status);
  }
  if (opts.cursor) {
    whereExtra += ` AND created_at < ?${bindings.length + 1}`;
    bindings.push(Number(opts.cursor));
  }
  bindings.push(limit + 1);

  const rows = (
    await db
      .prepare(
        `SELECT id, tenant_id, email, role, is_owner, invited_by,
                module_permissions, language, status,
                created_at, expires_at, accepted_at, cancelled_at
         FROM invitations
         WHERE tenant_id = ?1${whereExtra}
         ORDER BY created_at DESC LIMIT ?${bindings.length}`,
      )
      .bind(...bindings)
      .all<InvitationPublic>()
  ).results;

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(slice[slice.length - 1].created_at) : null;
  return { rows: slice, nextCursor };
}

// ── Escrita ────────────────────────────────────────────────────────────────────

export interface CreateInvitationInput {
  tenant_id: string | null;
  email: string;
  role: "tenant_admin" | "member" | "collaborator" | "client";
  is_owner: 0 | 1;
  invited_by: string;
  token_hash: string;
  module_permissions?: string;
  language?: string;
  expires_at: number;
}

export async function createInvitation(
  db: D1Database,
  input: CreateInvitationInput,
): Promise<InvitationPublic> {
  const result = await db
    .prepare(
      `INSERT INTO invitations
         (tenant_id, email, role, is_owner, invited_by, token_hash,
          module_permissions, language, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       RETURNING id, tenant_id, email, role, is_owner, invited_by,
                 module_permissions, language, status,
                 created_at, expires_at, accepted_at, cancelled_at`,
    )
    .bind(
      input.tenant_id,
      input.email.toLowerCase().trim(),
      input.role,
      input.is_owner,
      input.invited_by,
      input.token_hash,
      input.module_permissions ?? "{}",
      input.language ?? "pt",
      input.expires_at,
    )
    .first<InvitationPublic>();

  if (!result) throw new Error("Failed to create invitation");
  return result;
}

export async function acceptInvitation(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `UPDATE invitations
       SET status = 'accepted', accepted_at = unixepoch()
       WHERE id = ?1`,
    )
    .bind(id)
    .run();
}

export async function cancelInvitation(
  db: D1Database,
  id: string,
  tenantId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE invitations
       SET status = 'cancelled', cancelled_at = unixepoch()
       WHERE id = ?1 AND tenant_id = ?2`,
    )
    .bind(id, tenantId)
    .run();
}

export async function deleteInvitation(
  db: D1Database,
  id: string,
  tenantId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM invitations WHERE id = ?1 AND tenant_id = ?2`)
    .bind(id, tenantId)
    .run();
}

export async function expireStaleInvitations(db: D1Database): Promise<void> {
  await db
    .prepare(
      `UPDATE invitations
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at < unixepoch()`,
    )
    .run();
}
