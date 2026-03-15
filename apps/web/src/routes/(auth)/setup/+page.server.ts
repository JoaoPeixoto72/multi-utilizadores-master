/**
 * (auth)/setup/+page.server.ts — Setup inicial do super-user
 *
 * R: BUILD_PLAN M1.4 — POST /api/setup
 * R: STACK_LOCK.md §6 — valida política de password
 * R: briefing.md §3.1 — após setup, super user vai para /super/dashboard
 * R: briefing.md §3.1 — setup fica indisponível após execução
 */
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

// SvelteKit redirect() lança uma excepção especial — relançar sempre
function isRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    "location" in e &&
    typeof (e as { status: unknown }).status === "number"
  );
}

export const load: PageServerLoad = async ({ parent, platform }) => {
  console.log("[setup/+page.server.ts] load entered");

  const { user, csrfToken } = await parent();

  console.log(
    "[setup/+page.server.ts] csrfToken from parent is",
    csrfToken ? "present" : "missing",
  );

  // Se já autenticado como super_user, vai para dashboard
  if (user) {
    const u = user as { role?: string };
    if (u.role === "super_user") {
      throw redirect(302, "/super/dashboard");
    }
    throw redirect(302, "/");
  }

  // Verificar se o setup já foi feito
  try {
    const setupUrl = "https://internal/api/setup";
    console.log("[setup/+page.server.ts] calling GET", setupUrl);
    const res = await platform.env.API.fetch(new Request(setupUrl));
    const bodyText = await res.text();
    console.log("[setup/+page.server.ts] response status:", res.status);
    console.log("[setup/+page.server.ts] response body:", bodyText);

    if (res.ok) {
      const data = JSON.parse(bodyText) as { available: boolean };
      if (!data.available) {
        throw redirect(302, "/login");
      }
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
    console.log("[setup/+page.server.ts] error:", e);
    // Em caso de erro de rede, mostrar o formulário de qualquer forma
  }

  return { csrfToken };
};

export const actions: Actions = {
  default: async ({ request, platform, cookies }) => {
    const data = await request.formData();
    const email = data.get("email")?.toString() ?? "";
    const password = data.get("password")?.toString() ?? "";
    const csrf = data.get("_csrf")?.toString() ?? "";

    console.log("[setup/+page.server.ts] action email:", email);
    console.log("[setup/+page.server.ts] action password length:", password.length);
    console.log("[setup/+page.server.ts] action csrf present:", Boolean(csrf));

    if (!email || !password) {
      return fail(422, { error: "validation", email });
    }

    try {
      const setupUrl = "https://internal/api/setup";
      console.log("[setup/+page.server.ts] calling POST", setupUrl);
      const res = await platform.env.API.fetch(
        new Request(setupUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify({ email, password }),
        }),
      );

      const bodyText = await res.text();
      console.log("[setup/+page.server.ts] response status:", res.status);
      console.log("[setup/+page.server.ts] response body:", bodyText);

      if (res.status === 404) {
        return fail(409, { error: "already_done", email });
      }

      if (res.status === 422) {
        const body = JSON.parse(bodyText) as {
          errors?: Array<{ field: string; message: string }>;
        };
        console.log("[setup/+page.server.ts] 422 response body:", body);

        const pwdError = body.errors?.find((e: { field: string }) => e.field === "password");
        return fail(422, {
          error: pwdError ? "password_policy" : "validation",
          email,
        });
      }

      if (!res.ok) {
        console.log("[setup/+page.server.ts] non-ok response");
        return fail(500, { error: "generic", email });
      }

      // Propagar cookie de sessão definido pela API
      // IMPORTANTE: o token pode conter '=' (base64) — usar indexOf em vez de split('=')
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const semicolonIdx = setCookie.indexOf(";");
        const cookiePart = semicolonIdx >= 0 ? setCookie.slice(0, semicolonIdx) : setCookie;
        const eqIdx = cookiePart.indexOf("=");
        if (eqIdx > 0) {
          const name = cookiePart.slice(0, eqIdx).trim();
          const value = cookiePart.slice(eqIdx + 1).trim();
          if (name && value) {
            cookies.set(name, value, {
              path: "/",
              httpOnly: true,
              secure: true,
              sameSite: "strict",
              maxAge: 60 * 60 * 24 * 30,
            });
          }
        }
      }

      // Super user vai directo para o dashboard após setup
      throw redirect(302, "/super/dashboard");
    } catch (e) {
      if (isRedirect(e)) throw e;
      console.log("[setup/+page.server.ts] action error:", e);
      return fail(500, { error: "generic", email });
    }
  },
};
