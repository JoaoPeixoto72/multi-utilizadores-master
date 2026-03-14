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

export const load: PageServerLoad = async ({ platform, parent, url, cookies }) => {
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
      platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/collaborators?limit=50`, {
          headers: {
            cookie: cookies.toString(),
          },
        }),
      ),
      platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/members?limit=50`, {
          headers: {
            cookie: cookies.toString(),
          },
        }),
      ),
      platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/invitations?limit=50`, {
          headers: {
            cookie: cookies.toString(),
          },
        }),
      ),
      platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/clients?limit=50`, {
          headers: {
            cookie: cookies.toString(),
          },
        }),
      ),
    ]);

    const collabText = await collabRes.text();
    console.log("[admin/team] collab response status:", collabRes.status);
    console.log("[admin/team] collab response body:", collabText);
    if (collabRes.ok) {
      const data = JSON.parse(collabText) as { rows: TeamUser[] };
      collaborators = data.rows;
    }

    const membersText = await membersRes.text();
    console.log("[admin/team] members response status:", membersRes.status);
    console.log("[admin/team] members response body:", membersText);
    if (membersRes.ok) {
      const data = JSON.parse(membersText) as { rows: TeamUser[] };
      members = data.rows;
    }

    const invitesText = await invitesRes.text();
    console.log("[admin/team] invites response status:", invitesRes.status);
    console.log("[admin/team] invites response body:", invitesText);
    if (invitesRes.ok) {
      const data = JSON.parse(invitesText) as { rows: Invitation[] };
      invitations = data.rows.filter(i => i.status !== "accepted");
    }

    const clientsText = await clientsRes.text();
    console.log("[admin/team] clients response status:", clientsRes.status);
    console.log("[admin/team] clients response body:", clientsText);
    if (clientsRes.ok) {
      const data = JSON.parse(clientsText) as { rows: TeamUser[] };
      clients = data.rows;
    }

    // Carregar permissões se tab=permissions
    if (tab === "permissions") {
      const permRes = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/permissions`, {
          headers: {
            cookie: cookies.toString(),
          },
        }),
      );
      const permText = await permRes.text();
      console.log("[admin/team] perm response status:", permRes.status);
      console.log("[admin/team] perm response body:", permText);
      if (permRes.ok) {
        const data = JSON.parse(permText) as { rows: PermissionRow[] };
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
  invite: async ({ request, platform, cookies }) => {
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
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/invitations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
          body: JSON.stringify({ email, role }),
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] invite response status:", res.status);
      console.log("[admin/team] invite response body:", bodyText);

      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
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
  deactivate: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/collaborators/${userId}/deactivate`, {
          method: "POST",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] deactivate response status:", res.status);
      console.log("[admin/team] deactivate response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao desactivar." });
      }
      return { deactivate_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Reactivar colaborador ───────────────────────────────────────────────────
  reactivate: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/collaborators/${userId}/reactivate`, {
          method: "POST",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] reactivate response status:", res.status);
      console.log("[admin/team] reactivate response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao reactivar." });
      }
      return { reactivate_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar colaborador ────────────────────────────────────────────────────
  delete_collaborator: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/collaborators/${userId}`, {
          method: "DELETE",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] delete_collaborator response status:", res.status);
      console.log("[admin/team] delete_collaborator response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar sócio ──────────────────────────────────────────────────────────
  delete_member: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/members/${userId}`, {
          method: "DELETE",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] delete_member response status:", res.status);
      console.log("[admin/team] delete_member response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar sócio." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar cliente ───────────────────────────────────────────────────────
  delete_client: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const userId = form.get("user_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/clients/${userId}`, {
          method: "DELETE",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] delete_client response status:", res.status);
      console.log("[admin/team] delete_client response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar cliente." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Cancelar convite ────────────────────────────────────────────────────────
  cancel_invite: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const inviteId = form.get("invite_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/invitations/${inviteId}`, {
          method: "DELETE",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] cancel_invite response status:", res.status);
      console.log("[admin/team] cancel_invite response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao cancelar convite." });
      }
      return { cancel_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Eliminar convite ────────────────────────────────────────────────────────
  delete_invite: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const inviteId = form.get("invite_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/invitations/${inviteId}/force`, {
          method: "DELETE",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] delete_invite response status:", res.status);
      console.log("[admin/team] delete_invite response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao eliminar convite." });
      }
      return { delete_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Reenviar convite ────────────────────────────────────────────────────────
  resend_invite: async ({ request, platform, cookies }) => {
    const form = await request.formData();
    const inviteId = form.get("invite_id")?.toString() ?? "";
    const csrfToken = form.get("csrf_token")?.toString() ?? "";

    try {
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/invitations/${inviteId}/resend`, {
          method: "POST",
          headers: {
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] resend_invite response status:", res.status);
      console.log("[admin/team] resend_invite response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { action_error: data.detail ?? "Erro ao reenviar convite." });
      }
      return { resend_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { action_error: "Erro interno." });
    }
  },

  // ── Actualizar permissões ───────────────────────────────────────────────────
  update_permissions: async ({ request, platform, cookies }) => {
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
      const res = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/permissions/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            cookie: cookies.toString(),
          },
          body: JSON.stringify({ module_permissions: permissions }),
        }),
      );
      const bodyText = await res.text();
      console.log("[admin/team] update_permissions response status:", res.status);
      console.log("[admin/team] update_permissions response body:", bodyText);
      if (!res.ok) {
        const data = JSON.parse(bodyText) as { detail?: string };
        return fail(res.status, { permissions_error: data.detail ?? "Erro ao actualizar permissões." });
      }
      return { permissions_success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return fail(500, { permissions_error: "Erro interno." });
    }
  },
};
