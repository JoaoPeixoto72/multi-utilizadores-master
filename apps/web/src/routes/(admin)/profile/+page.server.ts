/**
 * (admin)/profile/+page.server.ts — Página de perfil (M5)
 *
 * R: BUILD_PLAN.md §M5.4
 * R: briefing.md §3.5, §3.6, §3.8, §3.9
 *
 * Carrega:
 *   - Perfil do utilizador (GET /api/user/profile)
 *   - Empresa, se owner (GET /api/admin/company)
 *
 * Actions:
 *   - update_profile: PATCH /api/user/profile
 *   - change_email: POST /api/user/profile/change-email
 *   - change_password: POST /api/user/profile/change-password
 *   - update_company: PATCH /api/admin/company
 */

import { fail } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import type { Actions, PageServerLoad } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

interface UserProfile {
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
  email_pending: string | null;
}

interface CompanyProfile {
  id: string;
  name: string;
  address: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  logo_key: string | null;
  storage_used: number;
  storage_limit: number;
}

export const load: PageServerLoad = async ({ fetch, parent, cookies }) => {
  const apiBase = getApiBase();
  const { adminUser } = await parent();

  // Carregar perfil
  let profile: UserProfile | null = null;
  try {
    const res = await fetch(`${apiBase}/api/user/profile`, {
      headers: {
        cookie: cookies.toString()
      }
    });
    if (res.ok) {
      profile = (await res.json()) as UserProfile;
    }
  } catch {
    // perfil vazio em caso de erro
  }

  // Carregar empresa (apenas owners)
  const isOwner = adminUser.is_owner === 1 || adminUser.is_temp_owner === 1;
  let company: CompanyProfile | null = null;
  if (isOwner && adminUser.tenant_id) {
    try {
      const res = await fetch(`${apiBase}/api/admin/company`, {
        headers: {
          cookie: cookies.toString()
        }
      });
      if (res.ok) {
        company = (await res.json()) as CompanyProfile;
      }
    } catch {
      // empresa vazia em caso de erro
    }
  }

  return {
    adminUser,
    profile,
    company,
    isOwner,
  };
};

export const actions: Actions = {
  // ── Actualizar perfil pessoal ─────────────────────────────────────────────
  update_profile: async ({ fetch, request, cookies }) => {
    const apiBase = getApiBase();
    const form = await request.formData();
    const body = {
      first_name: form.get("first_name")?.toString().trim() || null,
      last_name: form.get("last_name")?.toString().trim() || null,
      display_name: form.get("display_name")?.toString().trim() || null,
      phone: form.get("phone")?.toString().trim() || null,
      website: form.get("website")?.toString().trim() || null,
      preferred_language: form.get("preferred_language")?.toString() || undefined,
    };

    const csrf = form.get("csrf_token")?.toString() ?? "";
    const res = await fetch(`${apiBase}/api/user/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        cookie: cookies.toString()
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = (await res.json()) as { detail?: string };
      return fail(res.status, { action: "update_profile", error: err.detail ?? "Erro ao guardar." });
    }

    return { action: "update_profile", success: true };
  },

  // ── Alterar email ─────────────────────────────────────────────────────────
  change_email: async ({ fetch, request, cookies }) => {
    const apiBase = getApiBase();
    const form = await request.formData();
    const csrf = form.get("csrf_token")?.toString() ?? "";
    const body = {
      current_password: form.get("current_password")?.toString() ?? "",
      new_email: form.get("new_email")?.toString().trim() ?? "",
    };

    const res = await fetch(`${apiBase}/api/user/profile/change-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        cookie: cookies.toString()
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = (await res.json()) as { detail?: string };
      return fail(res.status, { action: "change_email", error: err.detail ?? "Erro." });
    }

    return { action: "change_email", success: true };
  },

  // ── Alterar password ──────────────────────────────────────────────────────
  change_password: async ({ fetch, request, cookies }) => {
    const apiBase = getApiBase();
    const form = await request.formData();
    const csrf = form.get("csrf_token")?.toString() ?? "";
    const body = {
      current_password: form.get("current_password")?.toString() ?? "",
      new_password: form.get("new_password")?.toString() ?? "",
    };

    if (body.new_password.length < 12) {
      return fail(400, {
        action: "change_password",
        error: "A nova password deve ter pelo menos 12 caracteres.",
      });
    }

    const res = await fetch(`${apiBase}/api/user/profile/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        cookie: cookies.toString()
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = (await res.json()) as { detail?: string };
      return fail(res.status, { action: "change_password", error: err.detail ?? "Erro." });
    }

    return { action: "change_password", success: true };
  },

  // ── Actualizar empresa (owner only) ──────────────────────────────────────
  update_company: async ({ fetch, request, cookies }) => {
    const apiBase = getApiBase();
    const form = await request.formData();
    const csrf = form.get("csrf_token")?.toString() ?? "";
    const body = {
      name: form.get("name")?.toString().trim() || undefined,
      address: form.get("address")?.toString().trim() || null,
      phone: form.get("phone")?.toString().trim() || null,
      website: form.get("website")?.toString().trim() || null,
    };

    const res = await fetch(`${apiBase}/api/admin/company`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        cookie: cookies.toString()
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = (await res.json()) as { detail?: string };
      return fail(res.status, {
        action: "update_company",
        error: err.detail ?? "Erro ao guardar empresa.",
      });
    }

    return { action: "update_company", success: true };
  },
};
