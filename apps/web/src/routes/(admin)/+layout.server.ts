/**
 * (admin)/+layout.server.ts — Guard de autenticação para páginas de admin de empresa
 *
 * R: BUILD_PLAN.md §M3.3
 * R: STACK_LOCK.md §14 — guard em layout.server.ts, sem process.env
 * R: briefing.md §1 — tenant_admin, member (owner fixo ou temp), collaborator com tenant_id
 *
 * Permite: tenant_admin, member, collaborator — todos com tenant_id
 * Redireciona: não autenticado → /login; super_user → /super/dashboard
 *
 * Padrão idêntico ao (super)/+layout.server.ts
 */

import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import type { LayoutServerLoad } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

export const load: LayoutServerLoad = async ({ fetch, cookies }) => {
  const apiBase = getApiBase();

  // Obter utilizador actual
  let user: {
    id: string;
    email: string;
    role: string;
    tenant_id: string | null;
    is_owner: number;
    is_temp_owner?: number;
    display_name?: string | null;
  } | null = null;

  try {
    const res = await fetch(`${apiBase}/api/auth/me`, {
      headers: {
        cookie: cookies.toString()
      }
    });
    if (res.ok) {
      user = await res.json();
    }
  } catch {
    // ignorar erros de rede
  }

  if (!user) {
    redirect(302, "/login");
  }

  // Super user vai para o seu painel
  if (user.role === "super_user") {
    redirect(302, "/super/dashboard");
  }

  // Todos os utilizadores de empresa devem ter tenant_id
  if (!user.tenant_id) {
    redirect(302, "/login");
  }

  return {
    adminUser: {
      id: user.id,
      email: user.email,
      role: user.role as "tenant_admin" | "member" | "collaborator",
      tenant_id: user.tenant_id,
      is_owner: user.is_owner,
      is_temp_owner: user.is_temp_owner ?? 0,
      display_name: user.display_name ?? null,
    },
    unreadNotifCount: await fetch(`${apiBase}/api/user/notifications/unread-count`, {
      headers: {
        cookie: cookies.toString()
      }
    })
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((d) => (d as { count: number }).count ?? 0)
      .catch(() => 0),
    navModules: await fetch(`${apiBase}/api/user/nav`, {
      headers: {
        cookie: cookies.toString()
      }
    })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => (d as { items: { id: string; name_key: string; icon: string; integrations_required: string[] }[] }).items ?? [])
      .catch(() => []),
  };
};
