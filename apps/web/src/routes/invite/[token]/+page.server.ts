/**
 * invite/[token]/+page.server.ts — Aceitação de convite
 *
 * R: BUILD_PLAN.md §M2.5
 * R: briefing.md §2 — roles e convites; sem auto-login após aceitar
 */
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

interface InviteData {
  email: string;
  role: string;
  is_owner: number;
  language: string;
  expires_at: number;
}

export const load: PageServerLoad = async ({ params, fetch, parent }) => {
  // Obter CSRF token do layout root
  const { csrfToken } = await parent();

  const res = await fetch(`/api/invitations/${params.token}`);

  if (res.status === 404) {
    error(404, "Convite inválido ou expirado");
  }

  if (!res.ok) {
    error(500, "Erro ao validar convite");
  }

  const invite = (await res.json()) as InviteData;
  return { invite, csrfToken };
};

export const actions: Actions = {
  default: async ({ params, request, fetch }) => {
    const data = await request.formData();
    const password = data.get("password")?.toString() ?? "";
    const display_name = data.get("display_name")?.toString() ?? "";
    const csrf = data.get("_csrf")?.toString() ?? "";

    if (!password) {
      return fail(422, { error: "validation" });
    }

    const res = await fetch(`/api/invitations/${params.token}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify({ password, display_name: display_name || undefined }),
    });

    if (res.status === 404) {
      return fail(404, { error: "invalid_token" });
    }

    if (res.status === 422) {
      const body = (await res.json()) as { errors?: Array<{ field: string; message: string }> };
      const pwdError = body.errors?.find((e: { field: string }) => e.field === "password");
      return fail(422, {
        error: "password_policy",
        password_error: pwdError?.message,
      });
    }

    if (!res.ok) {
      return fail(500, { error: "generic" });
    }

    redirect(303, "/login?invited=1");
  },
};
