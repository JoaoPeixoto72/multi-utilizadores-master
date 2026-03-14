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
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ platform, cookies }) => {
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
    const res = await platform.env.API.fetch(
      new Request(`https://internal/api/auth/me`, {
        headers: {
          cookie: cookies.toString(),
        },
      }),
    );
    const bodyText = await res.text();
    console.log("[admin/layout] auth/me response status:", res.status);
    console.log("[admin/layout] auth/me response body:", bodyText);
    if (res.ok) {
      user = JSON.parse(bodyText);
    }
  } catch (e) {
    console.log("[admin/layout] error fetching auth/me:", e);
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

  // Obter unread count
  let unreadNotifCount = 0;
  try {
    const notifRes = await platform.env.API.fetch(
      new Request(`https://internal/api/user/notifications/unread-count`, {
        headers: {
          cookie: cookies.toString(),
        },
      }),
    );
    const notifText = await notifRes.text();
    console.log("[admin/layout] unread-count response status:", notifRes.status);
    console.log("[admin/layout] unread-count response body:", notifText);
    if (notifRes.ok) {
      const d = JSON.parse(notifText) as { count: number };
      unreadNotifCount = d.count ?? 0;
    }
  } catch (e) {
    console.log("[admin/layout] error fetching unread count:", e);
  }

  // Obter módulos de navegação
  let navModules: { id: string; name_key: string; icon: string; integrations_required: string[] }[] = [];
  try {
    const navRes = await platform.env.API.fetch(
      new Request(`https://internal/api/user/nav`, {
        headers: {
          cookie: cookies.toString(),
        },
      }),
    );
    const navText = await navRes.text();
    console.log("[admin/layout] nav response status:", navRes.status);
    console.log("[admin/layout] nav response body:", navText);
    if (navRes.ok) {
      const d = JSON.parse(navText) as { items: { id: string; name_key: string; icon: string; integrations_required: string[] }[] };
      navModules = d.items ?? [];
    }
  } catch (e) {
    console.log("[admin/layout] error fetching nav modules:", e);
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
    unreadNotifCount,
    navModules,
  };
};
