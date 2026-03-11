/**
 * (super)/+layout.server.ts — Guard: apenas super_user acede a /super/*
 *
 * R: BUILD_PLAN.md §M2.6
 * R: briefing.md §1.1 — super_user tem tenant_id = null e role = 'super_user'
 */
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ parent }) => {
  const { user } = await parent();

  // Utilizador não autenticado → login
  if (!user) {
    redirect(302, "/login");
  }

  // Utilizador autenticado mas não é super_user → página raiz
  const u = user as { id: string; email: string; role?: string };
  if (u.role !== "super_user") {
    redirect(302, "/");
  }

  return { user: u };
};
