/**
 * (admin)/notifications/+page.server.ts — Página de notificações (M6)
 *
 * R: BUILD_PLAN.md §M6.4
 */

import type { Actions, PageServerLoad } from "./$types";

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

export const load: PageServerLoad = async ({ platform, url, cookies }) => {
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const params = new URLSearchParams({ ...(cursor ? { cursor } : {}) });

  const res = await platform.env.API.fetch(
    new Request(`https://internal/api/user/notifications?${params}`, {
      headers: {
        cookie: cookies.toString(),
      },
    }),
  );
  const bodyText = await res.text();
  console.log("[admin/notifications] load response status:", res.status);
  console.log("[admin/notifications] load response body:", bodyText);
  const data: NotifResponse = res.ok
    ? (JSON.parse(bodyText) as NotifResponse)
    : { notifications: [], nextCursor: null, unreadCount: 0 };

  return {
    notifications: data.notifications,
    nextCursor: data.nextCursor,
    unreadCount: data.unreadCount,
  };
};

export const actions: Actions = {
  read_all: async ({ platform, cookies }) => {
    const res = await platform.env.API.fetch(
      new Request(`https://internal/api/user/notifications/read-all`, {
        method: "POST",
        headers: {
          cookie: cookies.toString(),
        },
      }),
    );
    console.log("[admin/notifications] read_all response status:", res.status);
    return { success: true };
  },
};
