/**
 * (auth)/login/+page.server.ts — Login server actions
 *
 * R: BUILD_PLAN M1.4 — POST /api/auth/login via server action
 * R: STACK_LOCK.md §6 — erros genéricos, sessão única
 * R: GS08 — zero process.env
 * R: briefing.md §3.1 — redirect por role após login
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

export const load: PageServerLoad = async ({ parent, url, fetch }) => {
  const { user } = await parent();

  // Se já autenticado, redirecionar para o dashboard correcto
  if (user) {
    const u = user as { role?: string };
    if (u.role === "super_user") {
      redirect(302, "/super/dashboard");
    }
    redirect(302, "/");
  }

  // Verificar se o setup foi feito — se não, redirecionar para /setup
  try {
    const res = await fetch("/api/setup");
    if (res.ok) {
      const data = (await res.json()) as { available: boolean };
      if (data.available) {
        redirect(302, "/setup");
      }
    }
  } catch (e) {
    // Relançar Redirect (não é erro de rede)
    if (isRedirect(e)) throw e;
    // Em caso de erro de rede, mostrar login de qualquer forma
  }

  const resetSuccess = url.searchParams.get("reset") === "success";
  const invitedSuccess = url.searchParams.has("invited");
  return { resetSuccess, invitedSuccess };
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const data = await request.formData();
    const email = data.get("email")?.toString() ?? "";
    const password = data.get("password")?.toString() ?? "";
    const csrf = data.get("_csrf")?.toString() ?? "";

    if (!email || !password) {
      return fail(422, { error: "auth_invalid_credentials", email });
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return fail(res.status === 429 ? 429 : 401, {
        error: res.status === 429 ? "rate_limited" : "auth_invalid_credentials",
        email,
      });
    }

    // Ler role da resposta ANTES de consumir o body
    const loginData = (await res.json()) as { id: string; email: string; role: string; tenant_id: string | null };

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

    // Redirect por role (usando dados da resposta de login)
    if (loginData.role === "super_user") {
      redirect(302, "/super/dashboard");
    }

    redirect(302, "/");
  },
};
