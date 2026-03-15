/**
 * (super)/super/tenants/+page.server.ts — Lista de empresas
 *
 * R: BUILD_PLAN.md §M2.6
 * R: R07 — paginação cursor-based
 */
import type { PageServerLoad } from "./$types";

interface TenantListRow {
  id: string;
  name: string;
  email: string;
  status: string;
  admin_seat_limit: number;
  member_seat_limit: number;
  client_seat_limit: number;
  user_count: number;
  collab_count: number;
  client_count: number;
  created_at: number;
}

interface TenantsResponse {
  data: TenantListRow[];
  next_cursor: string | null;
  meta: { pending: number; active: number; inactive: number };
}

export const load: PageServerLoad = async ({ platform, url, request }) => {
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  if (status) params.set("status", status);

  const res = await platform.env.API.fetch(
    new Request(`https://internal/api/super/tenants?${params}`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    }),
  );
  if (!res.ok) {
    return { tenants: [], nextCursor: null, meta: { pending: 0, active: 0, inactive: 0 } };
  }

  const body = (await res.json()) as TenantsResponse;
  return {
    tenants: body.data,
    nextCursor: body.next_cursor,
    meta: body.meta,
    currentStatus: status ?? null,
    currentCursor: cursor ?? null,
  };
};
