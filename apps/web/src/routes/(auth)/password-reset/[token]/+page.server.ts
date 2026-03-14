/**
 * (auth)/password-reset/[token]/+page.server.ts — Confirmar reset de password
 *
 * R: BUILD_PLAN M1.4 — POST /api/auth/password-reset/confirm
 * R: STACK_LOCK.md §6 — token uso único, expira 1h, invalida sessão
 */
import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import type { Actions, PageServerLoad } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

export const load: PageServerLoad = async ({ params }) => {
  return { token: params.token };
};

export const actions: Actions = {
  default: async ({ request, fetch, params, cookies }) => {
    const apiBase = getApiBase();
    const data = await request.formData();
    const password = data.get("password")?.toString() ?? "";
    const csrf = data.get("_csrf")?.toString() ?? "";
    const token = params.token;

    if (!password || !token) {
      return fail(422, { error: "validation" });
    }

    const res = await fetch(`${apiBase}/api/auth/password-reset/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
        cookie: cookies.toString()
      },
      body: JSON.stringify({ token, password }),
    });

    if (res.status === 400) {
      return fail(400, { error: "invalid_token" });
    }

    if (res.status === 422) {
      return fail(422, { error: "password_policy" });
    }

    if (!res.ok) {
      return fail(500, { error: "generic" });
    }

    redirect(302, "/login?reset=success");
  },
};
