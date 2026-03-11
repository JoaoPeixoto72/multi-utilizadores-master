/**
 * (super)/super/tenants/[id]/+page.server.ts — Detalhe da empresa
 *
 * R: BUILD_PLAN.md §M2.6
 */
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_owner: number;
  is_temp_owner: number;
  status: string;
  created_at: number;
}

interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    email: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    status: string;
    admin_seat_limit: number;
    member_seat_limit: number;
    client_seat_limit: number;
    storage_limit_bytes: number;
    daily_email_limit: number;
    created_at: number;
    logo_key?: string | null;
  };
  owner: { id: string; email: string; display_name: string | null } | null;
  seats: { admins: number; members: number; collaborators: number; clients: number; total: number };
  storage_used?: number;
}

interface TenantUsers {
  owner: UserRow | null;
  tempOwners: UserRow[];
  members: UserRow[];
  collaborators: UserRow[];
  collaboratorCount: number;
  clients: UserRow[];
  clientCount: number;
}

export const load: PageServerLoad = async ({ params, fetch, url, parent }) => {
  const { csrfToken } = await parent();
  const [res, usersRes] = await Promise.all([
    fetch(`/api/super/tenants/${params.id}`),
    fetch(`/api/super/tenants/${params.id}/users`),
  ]);

  if (res.status === 404) {
    error(404, "Empresa não encontrada");
  }
  if (!res.ok) {
    error(500, "Erro ao carregar empresa");
  }

  const body = (await res.json()) as TenantDetail;
  const users = usersRes.ok ? (await usersRes.json()) as TenantUsers : { owner: null, tempOwners: [], members: [], collaborators: [], collaboratorCount: 0, clients: [], clientCount: 0 };

  return {
    ...body,
    users,
    csrfToken,
    created: url.searchParams.has("created"),
  };
};

export const actions: Actions = {
  update_limits: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";

    const body = {
      admin_seat_limit: Number(data.get("admin_seat_limit")),
      member_seat_limit: Number(data.get("member_seat_limit")),
      client_seat_limit: Number(data.get("client_seat_limit")),
      daily_email_limit: Number(data.get("daily_email_limit")),
    };

    const res = await fetch(`/api/super/tenants/${params.id}/limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify(body),
    });

    if (!res.ok) return fail(500, { action_error: "limits_error" });
    return { success: "limits_updated" };
  },

  update_storage: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";

    const storageMb = Number(data.get("storage_limit_mb") ?? 0);
    const storageBytes = storageMb * 1024 * 1024;

    const body = {
      storage_limit_bytes: storageBytes,
    };

    const res = await fetch(`/api/super/tenants/${params.id}/limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify(body),
    });

    if (!res.ok) return fail(500, { action_error: "storage_error" });
    return { success: "storage_updated" };
  },

  activate: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";
    await fetch(`/api/super/tenants/${params.id}/activate`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
    return { success: "activated" };
  },

  deactivate: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";
    await fetch(`/api/super/tenants/${params.id}/deactivate`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
    return { success: "deactivated" };
  },

  soft_delete: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";
    const res = await fetch(`/api/super/tenants/${params.id}/soft-delete`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
    if (!res.ok) return fail(500, { action_error: "delete_error" });
    // Redirecionar para a lista genérica após "desactivar" apagando logicamente a empresa
    redirect(303, "/super/tenants");
  },

  hard_delete: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";
    const res = await fetch(`/api/super/tenants/${params.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf },
    });
    if (!res.ok) return fail(500, { action_error: "delete_error" });
    // Redirecionar para a lista de empresas após apagar
    redirect(303, "/super/tenants");
  },

  elevate: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";
    const user_id = data.get("user_id")?.toString() ?? "";
    const duration = Number(data.get("duration_hours") ?? 24) * 3600;

    const res = await fetch(`/api/super/tenants/${params.id}/elevate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ user_id, duration_seconds: duration }),
    });

    if (!res.ok) return fail(500, { action_error: "elevate_error" });
    return { success: "elevated" };
  },

  revoke_elevation: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";
    const user_id = data.get("user_id")?.toString() ?? "";

    const res = await fetch(`/api/super/tenants/${params.id}/elevate?user_id=${user_id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf },
    });

    if (!res.ok) return fail(500, { action_error: "revoke_error" });
    return { success: "elevation_revoked" };
  },

  transfer_ownership: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const csrf = data.get("_csrf")?.toString() ?? "";
    const new_owner_id = data.get("new_owner_id")?.toString() ?? "";

    const res = await fetch(`/api/super/tenants/${params.id}/transfer-ownership`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ new_owner_user_id: new_owner_id }),
    });

    if (!res.ok) return fail(500, { action_error: "transfer_error" });
    return { success: "ownership_transferred" };
  },
};
