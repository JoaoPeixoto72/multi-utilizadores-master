/**
 * (super)/super/backups/+page.server.ts — Lista global de backups (super user) (M8)
 *
 * R: BUILD_PLAN.md §M8.4
 */

import type { PageServerLoad } from './$types';

interface BackupItem {
  id: string;
  tenant_id: string;
  type: string;
  status: string;
  size_bytes: number | null;
  r2_key: string | null;
  created_by: string;
  created_at: number;
  completed_at: number | null;
}

export const load: PageServerLoad = async ({ platform, cookies }) => {
  const res = await platform.env.API.fetch(
    new Request(`https://internal/api/super/backups`, {
      headers: {
        cookie: cookies.toString(),
      },
    }),
  );
  const bodyText = await res.text();
  console.log("[super/backups] response status:", res.status);
  console.log("[super/backups] response body:", bodyText);
  const data = res.ok
    ? (JSON.parse(bodyText) as { items: BackupItem[]; nextCursor: number | null })
    : { items: [], nextCursor: null };

  return {
    backups: data.items,
    nextCursor: data.nextCursor,
  };
};
