/**
 * (admin)/notifications/+page.server.ts — Página de notificações (M6)
 *
 * R: BUILD_PLAN.md §M6.4
 */

import { env } from "$env/dynamic/public";
import type { PageServerLoad, Actions } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

interface Notification {
  id: string;
  type: string;
  title_key: string;
  body_key: string;
  params: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
  read_at: string | null;
}

interface NotifResponse {
  notifications: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}

export const load: PageServerLoad = async ({ fetch, url, cookies }) => {
  const apiBase = getApiBase();
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const params = new URLSearchParams({ ...(cursor ? { cursor } : {}) });

  const res = await fetch(`${apiBase}/api/user/notifications?${params}`, {
    headers: {
      cookie: cookies.toString()
    }
  });
  const data: NotifResponse = res.ok
    ? await res.json()
    : { notifications: [], nextCursor: null, unreadCount: 0 };

  return {
    notifications: data.notifications,
    nextCursor: data.nextCursor,
    unreadCount: data.unreadCount,
  };
};

export const actions: Actions = {
  read_all: async ({ fetch, cookies }) => {
    const apiBase = getApiBase();
    await fetch(`${apiBase}/api/user/notifications/read-all`, { 
      method: "POST",
      headers: {
        cookie: cookies.toString()
      }
    });
    return { success: true };
  },
};
