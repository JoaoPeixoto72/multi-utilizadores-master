/**
 * /super/integrations/confirm — Confirmação de recepção do email de verificação.
 *
 * Quando o utilizador clica no link do email de verificação, esta página:
 *  1. Valida os parâmetros (token + id)
 *  2. Activa a integração na DB (via API)
 *  3. Redireciona para /super/integrations com mensagem de sucesso
 */

import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url, platform, request }) => {
  const cookiesHeader = request.headers.get("cookie") ?? "";
  const id = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  if (!id || !token) {
    throw redirect(303, "/super/integrations?confirm=invalid");
  }

  // Obter CSRF token
  let csrf = "";
  try {
    const r = await platform.env.API.fetch(
      new Request(`https://internal/api/auth/csrf`, {
        headers: {
          cookie: cookiesHeader,
        },
      }),
    );
    const rText = await r.text();
    console.log("[super/integrations/confirm] csrf response status:", r.status);
    console.log("[super/integrations/confirm] csrf response body:", rText);
    if (r.ok) {
      const d = JSON.parse(rText) as { token: string };
      csrf = d.token ?? "";
    }
  } catch (e) {
    console.log("[super/integrations/confirm] error fetching csrf:", e);
    /* sem CSRF, tenta na mesma */
  }

  // 1. Marcar como testada (caso ainda não esteja)
  try {
    const testRes = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations/${id}/test`, {
        method: "POST",
        headers: {
          "x-csrf-token": csrf,
          cookie: cookiesHeader,
        },
      }),
    );
    console.log("[super/integrations/confirm] test response status:", testRes.status);
  } catch (e) {
    console.log("[super/integrations/confirm] error testing integration:", e);
    /* ignorar erro de teste — prosseguir para activar */
  }

  // 2. Activar a integração
  const activateRes = await platform.env.API.fetch(
    new Request(`https://internal/api/super/integrations/${id}/activate`, {
      method: "POST",
      headers: {
        "x-csrf-token": csrf,
        cookie: cookiesHeader,
      },
    }),
  );
  const activateBodyText = await activateRes.text();
  console.log("[super/integrations/confirm] activate response status:", activateRes.status);
  console.log("[super/integrations/confirm] activate response body:", activateBodyText);

  if (activateRes.ok) {
    throw redirect(303, "/super/integrations?confirm=ok");
  } else {
    const err = (activateBodyText ? JSON.parse(activateBodyText) : {}) as { detail?: string };
    const msg = encodeURIComponent(err.detail ?? "Erro ao activar");
    throw redirect(303, `/super/integrations?confirm=error&msg=${msg}`);
  }
};
