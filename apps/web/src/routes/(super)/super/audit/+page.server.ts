/**
 * (super)/super/audit/+page.server.ts — Audit log global (M9)
 *
 * R: BUILD_PLAN.md §M9.5
 */

import type { PageServerLoad } from './$types';

export interface AuditItem {
  id: number;
  event_type: string;
  actor_id: string;
  tenant_id: string | null;
  target_type: string | null;
  target_id: string | null;
  bytes_affected: number;
  count_affected: number;
  metadata: string;
  created_at: number;
}

export const load: PageServerLoad = async ({ platform, url, request }) => {
  const cursor = url.searchParams.get('cursor') || undefined;
  const event_type = url.searchParams.get('event_type') || undefined;
  const tenant_id = url.searchParams.get('tenant_id') || undefined;

  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (event_type) params.set('event_type', event_type);
  if (tenant_id) params.set('tenant_id', tenant_id);

  const res = await platform.env.API.fetch(
    new Request(`https://internal/api/super/audit?${params}`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    })
  );
  const data = res.ok
    ? (await res.json()) as { items: AuditItem[]; nextCursor: number | null }
    : { items: [], nextCursor: null };

  return {
    items: data.items,
    nextCursor: data.nextCursor,
    filters: {
      event_type: event_type ?? '',
      tenant_id: tenant_id ?? '',
    },
  };
};
