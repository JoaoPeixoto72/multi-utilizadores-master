/**
 * (auth)/password-reset/+page.server.ts — Pedido de reset de password
 *
 * R: BUILD_PLAN M1.4 — POST /api/auth/password-reset/request
 * R: STACK_LOCK.md §6 — resposta neutra (não revelar se email existe)
 */
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const data = await request.formData();
    const email = data.get("email")?.toString() ?? "";
    const csrf = data.get("_csrf")?.toString() ?? "";

    if (!email) {
      return fail(422, { error: "validation" });
    }

    const res = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
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
