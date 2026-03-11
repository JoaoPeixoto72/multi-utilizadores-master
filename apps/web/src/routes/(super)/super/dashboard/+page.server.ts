/**
 * (super)/super/dashboard/+page.server.ts — Dashboard Super User
 *
 * R: BUILD_PLAN.md §M2.6
 */
import type { PageServerLoad } from "./$types";

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

export const load: PageServerLoad = async ({ fetch }) => {
  // Buscar stats + recentes (todos os status)
  const [allRes, activeRes] = await Promise.all([
    fetch("/api/super/tenants?limit=5"),
    fetch("/api/super/tenants?limit=5&status=active"),
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
