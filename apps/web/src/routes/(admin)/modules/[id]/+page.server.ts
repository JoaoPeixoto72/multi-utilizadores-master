/**
 * (admin)/modules/[id]/+page.server.ts — Módulo placeholder (M4)
 *
 * R: BUILD_PLAN.md §M4.2
 * R: STACK_LOCK.md §14 — auth via layout pai
 *
 * Valida que o utilizador tem acesso ao módulo via /api/user/modules.
 * Módulos reais implementados em M10.
 */

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

interface ModuleEntry {
  id: string;
  name_key: string;
  has_access: boolean;
}

export const load: PageServerLoad = async ({ platform, params, parent, cookies }) => {
  await parent(); // assegura guard de auth do layout

  const moduleId = params.id;

  try {
    const res = await platform.env.API.fetch(
      new Request(`https://internal/api/user/modules`, {
        headers: {
          cookie: cookies.toString(),
        },
      }),
    );
    const bodyText = await res.text();
    console.log("[admin/modules/id] response status:", res.status);
    console.log("[admin/modules/id] response body:", bodyText);
    if (!res.ok) {
      error(403, "Sem acesso a módulos.");
    }

    const data = JSON.parse(bodyText) as { modules: ModuleEntry[] };
    const mod = data.modules.find((m) => m.id === moduleId);

    if (!mod) {
      // Módulo não existe ou não disponível para este tenant
      error(404, "Módulo não encontrado.");
    }

    if (!mod.has_access) {
      error(403, "Sem acesso a este módulo.");
    }

    return { moduleId, module: mod };
  } catch (e) {
    if (e instanceof Error && "status" in e) throw e;
    error(500, "Erro ao carregar módulo.");
  }
};
