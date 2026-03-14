/**
 * (auth)/password-reset/+page.server.ts — Pedido de reset de password
 *
 * R: BUILD_PLAN M1.4 — POST /api/auth/password-reset/request
 * R: STACK_LOCK.md §6 — resposta neutra (não revelar se email existe)
 */
import { fail } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import type { Actions, PageServerLoad } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const apiBase = getApiBase();
    const data = await request.formData();
    const email = data.get("email")?.toString() ?? "";
    const csrf = data.get("_csrf")?.toString() ?? "";

    if (!email) {
      return fail(422, { error: "validation" });
    }

    const res = await fetch(`${apiBase}/api/auth/password-reset/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        cookie: cookies.toString()
      },
      body: JSON.stringify({ email }),
    });

    if (res.status === 429) {
      return fail(429, { error: "rate_limited" });
    }

    // Resposta sempre neutra (igual para email existente e inexistente)
    return { sent: true };
  },
};
