/**
 * +page.server.ts — Rota raiz: redirect por role
 *
 * R: briefing.md §3.1 — após login, cada role vai para o seu dashboard
 * R: STACK_LOCK.md §6 — rotas protegidas requerem sessão
 *
 * Mapa de redirects:
 *   super_user   → /super/dashboard
 *   tenant_admin → /dashboard
 *   member       → /dashboard
 *   collaborator → /dashboard
 *   não autenticado → /login
 */
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();

  if (!user) {
    redirect(302, "/login");
  }

  const u = user as { role?: string };

  // Redirect por role
  if (u.role === "super_user") {
    redirect(302, "/super/dashboard");
  }

  // M3: tenant_admin, member, collaborator → /dashboard
  if (u.role === "tenant_admin" || u.role === "member" || u.role === "collaborator") {
    redirect(302, "/dashboard");
  }

  // Fallback
  redirect(302, "/login");
};
