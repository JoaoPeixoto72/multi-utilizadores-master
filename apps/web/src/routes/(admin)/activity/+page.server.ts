/**
 * (admin)/activity/+page.server.ts — Histórico de actividade (M9)
 *
 * R: BUILD_PLAN.md §M9.5
 */

import { isRedirect } from '@sveltejs/kit';
import { env } from "$env/dynamic/public";
import type { Actions, PageServerLoad } from './$types';

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

export interface ActivityItem {
  id: number;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: string;
  was_temp_owner: number;
  created_at: number;
}

export const load: PageServerLoad = async ({ fetch, url, parent, cookies }) => {
  const apiBase = getApiBase();
  const { adminUser } = await parent();
  const cursor = url.searchParams.get('cursor') || undefined;
  const actor_id = url.searchParams.get('actor_id') || undefined;
  const action = url.searchParams.get('action') || undefined;

  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (actor_id) params.set('actor_id', actor_id);
  if (action) params.set('action', action);

  const res = await fetch(`${apiBase}/api/admin/activity?${params}`, {
    headers: {
      cookie: cookies.toString()
    }
  });
  const data = res.ok
    ? (await res.json()) as { items: ActivityItem[]; nextCursor: number | null }
    : { items: [], nextCursor: null };

  return {
    adminUser,
    items: data.items,
    nextCursor: data.nextCursor,
    filters: { actor_id: actor_id ?? '', action: action ?? '' },
  };
};

export const actions: Actions = {
  clean: async ({ request, fetch, cookies }) => {
    const apiBase = getApiBase();
    const form = await request.formData();
    const csrfToken = form.get('csrf_token')?.toString() ?? '';
    try {
      const res = await fetch(`${apiBase}/api/admin/activity`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrfToken,
          cookie: cookies.toString()
        }
      });
      if (!res.ok) {
        let msg = 'Erro ao limpar histórico';
        try {
          const err = (await res.json()) as { detail?: string };
          msg = err.detail ?? msg;
        } catch { }
        return { success: false, error: msg };
      }
      const data = (await res.json()) as { deleted: number };
      return { success: true, deleted: data.deleted };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return { success: false, error: 'Erro inesperado' };
    }
  },
};
