/**
 * (admin)/team/+page.server.ts — Gestão de equipa
 *
 * R: BUILD_PLAN.md §M3.3
 * R: STACK_LOCK.md §14 — form actions para mutações; fetch para queries
 * R: LL-03 — isRedirect em todos os try/catch
 * R: LL-05 — enhance com { result } + goto() para redirects
 */

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "status" in e && "location" in e;
}

interface TeamUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_owner: number;
  is_temp_owner: number;
  status: string;
  created_at: number;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  is_owner: number;
  invited_by: string;
  status: string;
  created_at: number;
  expires_at: number;
}

interface PermissionRow {
  user_id: string;
  email: string;
  display_name: string | null;
  module_permissions: Record<string, unknown>;
}

export const load: PageServerLoad = async ({ fetch, parent, url }) => {
  const { adminUser } = await parent();
  const tab = url.searchParams.get("tab") ?? "collaborators";

  let collaborators: TeamUser[] = [];
  let members: TeamUser[] = [];
  let clients: TeamUser[] = [];
  let invitations: Invitation[] = [];
  let permissions: PermissionRow[] = [];
  let errors: Record<string, string> = {};

  try {
    const [collabRes, membersRes, invitesRes, clientsRes] = await Promise.all([
      fetch("/api/admin/team/collaborators?limit=50"),
      fetch("/api/admin/team/members?limit=50"),
      fetch("/api/admin/team/invitations?limit=50"),
      fetch("/api/admin/team/clients?limit=50"),
    ]);

    if (collabRes.ok) {
      const data = await collabRes.json() as { rows: TeamUser[] };
      collaborators = data.rows;
    }
    if (membersRes.ok) {
      const data = await membersRes.json() as { rows: TeamUser[] };
      members = data.rows;
    }
    if (invitesRes.ok) {
      const data = await invitesRes.json() as { rows: Invitation[] };
      invitations = data.rows.filter(i => i.status !== "accepted");
    }
    if (clientsRes.ok) {
      const data = await clientsRes.json() as { rows: TeamUser[] };
      clients = data.rows;
    }

    // Carregar permissões se tab=permissions
    if (tab === "permissions") {
      const permRes = await fetch("/api/admin/team/permissions");
      if (permRes.ok) {
        const data = await permRes.json() as { rows: PermissionRow[] };
        permissions = data.rows;
      }
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
    errors.load = "Erro ao carregar dados da equipa.";
  }

  return {
    adminUser,
    collaborators,
    members,
    clients,
    invitations,
    permissions,
    activeTab: tab,
    errors,
  };
};

export const actions: Actions = {
  // ── Convidar membro/colaborador ─────────────────────────────────────────────
  invite: async ({ request, fetch }) => {
    const form = await request.formData();
    const email = form.get("email")?.toString().trim() ?? "";
    const role = form.get("role")?.toString() ?? "collaborator";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    if (!email || !email.includes("@")) {
      return fail(400, { invite_error: "Email inválido.", email, role });
    }
    if (!["member", "collaborator", "client"].includes(role)) {
      return fail(400, { invite_error: "Role inválido.", email, role });
    }

    try {
      const res = await fetch("/api/admin/team/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        const msg = data.detail ?? "Erro ao criar convite.";
        if (res.status === 409) {
          return fail(409, { invite_error: msg, email, role });
        }
        if (res.status === 403) {
          return fail(403, { invite_error: "Não tem permissão para enviar este convite.", email, role });
        }
        return fail(res.status, { invite_error: msg, email, role });
      }

      return { invite_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { invite_error: "Erro interno.", email, role });
    }
  },

  // ── Desactivar colaborador ──────────────────────────────────────────────────
  deactivate: async ({ request, fetch }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/collaborators/${userId}/deactivate`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao desactivar." });
      }
      return { deactivate_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Reactivar colaborador ───────────────────────────────────────────────────
  reactivate: async ({ request, fetch }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/collaborators/${userId}/reactivate`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao reactivar." });
      }
      return { reactivate_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar colaborador ────────────────────────────────────────────────────
  delete_collaborator: async ({ request, fetch }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/collaborators/${userId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar sócio ──────────────────────────────────────────────────────────
  delete_member: async ({ request, fetch }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/members/${userId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar sócio." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar cliente ───────────────────────────────────────────────────────
  delete_client: async ({ request, fetch }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/clients/${userId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar cliente." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Cancelar convite ────────────────────────────────────────────────────────
  cancel_invite: async ({ request, fetch }) => {
    const form = await request.formData();
    const inviteId = form.get("invite_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/invitations/${inviteId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao cancelar convite." });
      }
      return { cancel_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar convite ────────────────────────────────────────────────────────
  delete_invite: async ({ request, fetch }) => {
    const form = await request.formData();
    const inviteId = form.get("invite_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/invitations/${inviteId}/force`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar convite." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Reenviar convite ────────────────────────────────────────────────────────
  resend_invite: async ({ request, fetch }) => {
    const form = await request.formData();
    const inviteId = form.get("invite_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await fetch(`/api/admin/team/invitations/${inviteId}/resend`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao reenviar convite." });
      }
      return { resend_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Actualizar permissões ───────────────────────────────────────────────────
  update_permissions: async ({ request, fetch }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const permissionsJson = form.get("permissions")?.toString() ?? "{}";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    let permissions: Record<string, unknown> = {};
    try {
      permissions = JSON.parse(permissionsJson);
    } catch {
      return fail(400, { permissions_error: "Formato de permissões inválido." });
    }

    try {
      const res = await fetch(`/api/admin/team/permissions/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ module_permissions: permissions }),
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        return fail(res.status, { permissions_error: data.detail ?? "Erro ao actualizar permissões." });
      }
      return { permissions_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { permissions_error: "Erro interno." });
    }
  },
};
