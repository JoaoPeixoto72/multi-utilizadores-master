/**
 * (auth)/password-reset/[token]/+page.server.ts — Confirmar reset de password
 *
 * R: BUILD_PLAN M1.4 — POST /api/auth/password-reset/confirm
 * R: STACK_LOCK.md §6 — token uso único, expira 1h, invalida sessão
 */
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  return { token: params.token };
};

export const actions: Actions = {
  default: async ({ request, fetch, params }) => {
    const data = await request.formData();
    const password = data.get("password")?.toString() ?? "";
    const csrf = data.get("_csrf")?.toString() ?? "";
    const token = params.token;

    if (!password || !token) {
      return fail(422, { error: "validation" });
    }

    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
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
