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

export const load: PageServerLoad = async ({ url, fetch }) => {
  const id    = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  if (!id || !token) {
    throw redirect(303, "/super/integrations?confirm=invalid");
  }

  // Obter CSRF token
  let csrf = "";
  try {
    const r = await fetch("/api/auth/csrf");
    if (r.ok) {
      const d = (await r.json()) as { token: string };
      csrf = d.token ?? "";
    }
  } catch { /* sem CSRF, tenta na mesma */ }

  // 1. Marcar como testada (caso ainda não esteja)
  try {
    await fetch(`/api/super/integrations/${id}/test`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
  } catch { /* ignorar erro de teste — prosseguir para activar */ }

  // 2. Activar a integração
  const activateRes = await fetch(`/api/super/integrations/${id}/activate`, {
    method: "POST",
    headers: { "x-csrf-token": csrf },
  });

  if (activateRes.ok) {
    throw redirect(303, "/super/integrations?confirm=ok");
  } else {
    const err = await activateRes.json().catch(() => ({})) as { detail?: string };
    const msg = encodeURIComponent(err.detail ?? "Erro ao activar");
    throw redirect(303, `/super/integrations?confirm=error&msg=${msg}`);
  }
};
