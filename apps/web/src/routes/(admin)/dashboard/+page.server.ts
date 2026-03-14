/**
 * (admin)/dashboard/+page.server.ts — Dashboard de empresa
 *
 * R: BUILD_PLAN.md §M3.3, §M4.2
 * R: STACK_LOCK.md §14 — sem process.env; fetch via hooks.server.ts
 *
 * Serve dois tipos de utilizador:
 *   Admin/Owner/Member → vê estatísticas de equipa (count/limit)
 *   Collaborator       → vê módulos disponíveis
 */

import { env } from "$env/dynamic/public";
import type { PageServerLoad } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

interface ModuleEntry {
  id: string;
  name_key: string;
  has_access: boolean;
}

interface TeamStats {
  members: { count: number; limit: number };
  collaborators: { count: number; limit: number };
  clients: { count: number; limit: number };
  total: { count: number; limit: number };
}

export const load: PageServerLoad = async ({ fetch, parent, cookies }) => {
  const apiBase = getApiBase();
  const { adminUser } = await parent();

  const isAdmin =
    adminUser.role === "tenant_admin" ||
    adminUser.role === "member" ||
    adminUser.is_owner === 1 ||
    adminUser.is_temp_owner === 1;

  let stats: TeamStats = {
    members: { count: 0, limit: 0 },
    collaborators: { count: 0, limit: 0 },
    clients: { count: 0, limit: 0 },
    total: { count: 0, limit: 0 },
  };
  let modules: ModuleEntry[] = [];

  if (isAdmin) {
    // Admins/owners/members: carregar estatísticas de equipa com limites
    try {
      const statsRes = await fetch(`${apiBase}/api/admin/team/stats`, {
        headers: {
          cookie: cookies.toString()
        }
      });
      if (statsRes.ok) {
        stats = (await statsRes.json()) as TeamStats;
      }
    } catch {
      // ignorar erros — mostrar estado vazio
    }
  } else {
    // Colaboradores: carregar módulos disponíveis
    try {
      const modulesRes = await fetch(`${apiBase}/api/user/modules`, {
        headers: {
          cookie: cookies.toString()
        }
      });
      if (modulesRes.ok) {
        const data = (await modulesRes.json()) as { modules: ModuleEntry[] };
        modules = data.modules;
      }
    } catch {
      // ignorar erros
    }
  }

  return {
    adminUser,
    isAdmin,
    stats,
    modules,
  };
};
