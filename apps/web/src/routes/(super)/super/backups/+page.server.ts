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

export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch('/api/super/backups');
  const data = res.ok
    ? (await res.json()) as { items: BackupItem[]; nextCursor: number | null }
    : { items: [], nextCursor: null };

  return {
    backups: data.items,
    nextCursor: data.nextCursor,
  };
};
