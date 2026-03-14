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

import type { PageServerLoad } from "./$types";

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

export const load: PageServerLoad = async ({ platform, parent, cookies }) => {
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
      const statsRes = await platform.env.API.fetch(
        new Request(`https://internal/api/admin/team/stats`, {
          headers: {
            cookie: cookies.toString(),
          },
        }),
      );
      const statsText = await statsRes.text();
      console.log("[admin/dashboard] stats response status:", statsRes.status);
      console.log("[admin/dashboard] stats response body:", statsText);
      if (statsRes.ok) {
        stats = JSON.parse(statsText) as TeamStats;
      }
    } catch (e) {
      console.log("[admin/dashboard] error loading stats:", e);
      // ignorar erros — mostrar estado vazio
    }
  } else {
    // Colaboradores: carregar módulos disponíveis
    try {
      const modulesRes = await platform.env.API.fetch(
        new Request(`https://internal/api/user/modules`, {
          headers: {
            cookie: cookies.toString(),
          },
        }),
      );
      const modulesText = await modulesRes.text();
      console.log("[admin/dashboard] modules response status:", modulesRes.status);
      console.log("[admin/dashboard] modules response body:", modulesText);
      if (modulesRes.ok) {
        const data = JSON.parse(modulesText) as { modules: ModuleEntry[] };
        modules = data.modules;
      }
    } catch (e) {
      console.log("[admin/dashboard] error loading modules:", e);
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
