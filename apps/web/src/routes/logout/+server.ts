/**
 * routes/logout/+server.ts — GET /logout
 *
 * Trata o clique no link "Sair": chama POST /api/auth/logout na API
 * (que invalida a sessão no D1 e devolve Set-Cookie de limpeza),
 * depois apaga o cookie localmente e redireciona para /login.
 *
 * R: BUILD_PLAN M1.4 — invalida sessão, limpa cookie
 * R: LESSONS_LEARNED LL-03 — redirect deve ser re-thrown no catch
 * R: LESSONS_LEARNED LL-06 — cookie pode estar URL-encoded
 * R: csrf.ts CSRF_EXEMPT — /api/auth/logout isento de CSRF por design
 */
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, platform, cookies }) => {
  try {
    // Chama a API para invalidar a sessão no D1
    // /api/auth/logout está isento de CSRF (ver middleware/csrf.ts)
    await platform.env.API.fetch(
      new Request(`https://internal/api/auth/logout`, {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") ?? "",
        },
      }),
    );
  } catch {
    // Mesmo que a chamada à API falhe, limpa cookie e redireciona
  }

  // Garante remoção local do cookie independentemente do resultado da API
  cookies.delete("session", { path: "/" });

  throw redirect(302, "/login");
};
