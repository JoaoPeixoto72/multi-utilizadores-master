/**
 * (super)/super/dashboard/+page.server.ts — Dashboard Super User
 *
 * R: BUILD_PLAN.md §M2.6
 */
import { env } from "$env/dynamic/public";
import type { PageServerLoad } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

interface StatsResponse {
  active: number;
  inactive: number;
  pending: number;
}

interface TenantsResponse {
  data: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    created_at: number;
  }>;
  next_cursor: string | null;
  meta: StatsResponse;
}

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const apiBase = getApiBase();
  // Buscar stats + recentes (todos os status)
  const [allRes, activeRes] = await Promise.all([
    fetch(`${apiBase}/api/super/tenants?limit=5`, {
      headers: {
        cookie: cookies.toString()
      }
    }),
    fetch(`${apiBase}/api/super/tenants?limit=5&status=active`, {
      headers: {
        cookie: cookies.toString()
      }
    }),
  ]);

  if (!allRes.ok) {
    return { stats: { active: 0, inactive: 0, pending: 0 }, recent: [], activeCompanies: [] };
  }

  const body = (await allRes.json()) as TenantsResponse;
  const activeBody = activeRes.ok ? (await activeRes.json()) as TenantsResponse : { data: [] };

  return {
    stats: body.meta,
    recent: body.data,
    activeCompanies: activeBody.data,
  };
};
