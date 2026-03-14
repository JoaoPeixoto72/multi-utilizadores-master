/**
 * /super/integrations/confirm — Confirmação de recepção do email de verificação.
 *
 * Quando o utilizador clica no link do email de verificação, esta página:
 *  1. Valida os parâmetros (token + id)
 *  2. Activa a integração na DB (via API)
 *  3. Redireciona para /super/integrations com mensagem de sucesso
 */

import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import type { PageServerLoad } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
  const apiBase = getApiBase();
  const id    = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  if (!id || !token) {
    throw redirect(303, "/super/integrations?confirm=invalid");
  }

  // Obter CSRF token
  let csrf = "";
  try {
    const r = await fetch(`${apiBase}/api/auth/csrf`, {
      headers: {
        cookie: cookies.toString()
      }
    });
    if (r.ok) {
      const d = (await r.json()) as { token: string };
      csrf = d.token ?? "";
    }
  } catch { /* sem CSRF, tenta na mesma */ }

  // 1. Marcar como testada (caso ainda não esteja)
  try {
    await fetch(`${apiBase}/api/super/integrations/${id}/test`, {
      method: "POST",
      headers: { 
        "x-csrf-token": csrf,
        cookie: cookies.toString()
      },
    });
  } catch { /* ignorar erro de teste — prosseguir para activar */ }

  // 2. Activar a integração
  const activateRes = await fetch(`${apiBase}/api/super/integrations/${id}/activate`, {
    method: "POST",
    headers: { 
      "x-csrf-token": csrf,
      cookie: cookies.toString()
    },
  });

  if (activateRes.ok) {
    throw redirect(303, "/super/integrations?confirm=ok");
  } else {
    const err = await activateRes.json().catch(() => ({})) as { detail?: string };
    const msg = encodeURIComponent(err.detail ?? "Erro ao activar");
    throw redirect(303, `/super/integrations?confirm=error&msg=${msg}`);
  }
};
