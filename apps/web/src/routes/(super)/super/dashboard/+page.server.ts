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

export const load: PageServerLoad = async ({ platform, cookies }) => {
  // Buscar stats + recentes (todos os status)
  const [allRes, activeRes] = await Promise.all([
    platform.env.API.fetch(
      new Request(`https://internal/api/super/tenants?limit=5`, {
        headers: {
          cookie: cookies.toString(),
        },
      }),
    ),
    platform.env.API.fetch(
      new Request(`https://internal/api/super/tenants?limit=5&status=active`, {
        headers: {
          cookie: cookies.toString(),
        },
      }),
    ),
  ]);

  const allText = await allRes.text();
  console.log("[super/dashboard] all response status:", allRes.status);
  console.log("[super/dashboard] all response body:", allText);

  if (!allRes.ok) {
    return { stats: { active: 0, inactive: 0, pending: 0 }, recent: [], activeCompanies: [] };
  }

  const body = JSON.parse(allText) as TenantsResponse;
  const activeText = await activeRes.text();
  console.log("[super/dashboard] active response status:", activeRes.status);
  console.log("[super/dashboard] active response body:", activeText);
  const activeBody = activeRes.ok ? (JSON.parse(activeText) as TenantsResponse) : { data: [] };

  return {
    stats: body.meta,
    recent: body.data,
    activeCompanies: activeBody.data,
  };
};
