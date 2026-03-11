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

export const load: PageServerLoad = async ({ fetch, params, parent }) => {
  await parent(); // assegura guard de auth do layout

  const moduleId = params.id;

  try {
    const res = await fetch("/api/user/modules");
    if (!res.ok) {
      error(403, "Sem acesso a módulos.");
    }

    const data = (await res.json()) as { modules: ModuleEntry[] };
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
