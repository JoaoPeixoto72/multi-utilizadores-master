/**
 * (super)/super/integrations/+page.server.ts — Gestão de integrações (M7)
 *
 * Fix: todas as actions passam x-csrf-token no fetch interno.
 * Novo: action "verify" envia email de teste e marca integração como testada.
 */

import type { PageServerLoad, Actions } from "./$types";

interface Integration {
  id: string;
  category: string;
  provider: string;
  credentials_encrypted: string;
  is_active: number;
  tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export const load: PageServerLoad = async ({ platform, cookies }) => {
  const res = await platform.env.API.fetch(
    new Request(`https://internal/api/super/integrations`, {
      headers: {
        cookie: cookies.toString(),
      },
    }),
  );
  const bodyText = await res.text();
  console.log("[super/integrations] load response status:", res.status);
  console.log("[super/integrations] load response body:", bodyText);
  const data: { data: Integration[] } = res.ok ? (JSON.parse(bodyText) as { data: Integration[] }) : { data: [] };
  return { integrations: data.data ?? [] };
};

/** Obtém CSRF token para usar nas chamadas fetch internas */
async function getCsrf(platform: any, cookies: { toString: () => string }): Promise<string> {
  try {
    const r = await platform.env.API.fetch(
      new Request(`https://internal/api/auth/csrf`, {
        headers: {
          cookie: cookies.toString(),
        },
      }),
    );
    const rText = await r.text();
    console.log("[super/integrations] csrf response status:", r.status);
    console.log("[super/integrations] csrf response body:", rText);
    if (r.ok) {
      const d = JSON.parse(rText) as { token: string };
      return d.token ?? "";
    }
  } catch (e) {
    console.log("[super/integrations] error fetching csrf:", e);
    /* fallback */
  }
  return "";
}

export const actions: Actions = {
  create: async ({ platform, request, cookies }) => {
    const form = await request.formData();
    const category    = form.get("category") as string;
    const provider    = form.get("provider") as string;
    // Campos simples para Resend — construir JSON internamente
    const apiKey      = form.get("api_key") as string | null;
    const fromEmail   = form.get("from_email") as string | null;
    // Fallback: JSON raw (outros providers)
    const rawJson     = form.get("credentials_json") as string | null;

    let credentials: Record<string, string>;
    try {
      if (apiKey && fromEmail) {
        // Formulário simplificado (Resend e compatíveis)
        credentials = { api_key: apiKey.trim(), from_email: fromEmail.trim() };
      } else if (rawJson) {
        credentials = JSON.parse(rawJson) as Record<string, string>;
      } else {
        return { error: "Preencha a API Key e o email de envio." };
      }
    } catch {
      return { error: "Credenciais inválidas (JSON mal formatado)." };
    }

    const csrf = await getCsrf(platform, cookies);
    const res = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ category, provider, credentials }),
      }),
    );
    const bodyText = await res.text();
    console.log("[super/integrations] create response status:", res.status);
    console.log("[super/integrations] create response body:", bodyText);

    if (!res.ok) {
      const err = (bodyText ? JSON.parse(bodyText) : {}) as { detail?: string; title?: string };
      return {
        error:
          err.detail ?? err.title ?? `Erro ao criar integração (${res.status}).`,
      };
    }
    return { success: true };
  },

  verify: async ({ platform, request, cookies }) => {
    /** Testa a integração e envia um email de confirmação real */
    const form  = await request.formData();
    const id    = form.get("id") as string;
    const email = form.get("verify_email") as string;

    if (!email || !email.includes("@")) {
      return { verifyError: "Indique um email válido para receber o email de teste." };
    }

    const csrf = await getCsrf(platform, cookies);

    // 1. Testar ping (valida API key)
    const testRes = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations/${id}/test`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      }),
    );
    const testText = await testRes.text();
    console.log("[super/integrations] verify test response status:", testRes.status);
    console.log("[super/integrations] verify test response body:", testText);
    const testData = (testText ? JSON.parse(testText) : { ok: false, message: "Erro." }) as { ok: boolean; message: string };

    if (!testData.ok) {
      return { verifyError: `Falha na ligação: ${testData.message}` };
    }

    // 2. Enviar email de verificação real
    const sendRes = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ id, email }),
      }),
    );
    const sendText = await sendRes.text();
    console.log("[super/integrations] verify send response status:", sendRes.status);
    console.log("[super/integrations] verify send response body:", sendText);

    if (!sendRes.ok) {
      const e = (sendText ? JSON.parse(sendText) : {}) as { detail?: string };
      return { verifyError: e.detail ?? "Ligação OK mas falha ao enviar email de teste." };
    }

    return { verifySuccess: `Email de verificação enviado para ${email}. Verifique a sua caixa de entrada.` };
  },

  test: async ({ platform, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(platform, cookies);
    const res  = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations/${id}/test`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      }),
    );
    const bodyText = await res.text();
    console.log("[super/integrations] test response status:", res.status);
    console.log("[super/integrations] test response body:", bodyText);
    const data = bodyText ? JSON.parse(bodyText) : { ok: false, message: "Erro." };
    return { testResult: data };
  },

  activate: async ({ platform, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(platform, cookies);
    const res  = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations/${id}/activate`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      }),
    );
    const bodyText = await res.text();
    console.log("[super/integrations] activate response status:", res.status);
    console.log("[super/integrations] activate response body:", bodyText);
    if (!res.ok) {
      const e = (bodyText ? JSON.parse(bodyText) : {}) as { detail?: string };
      return { error: e.detail ?? "Teste a integração antes de activar." };
    }
    return { success: true };
  },

  deactivate: async ({ platform, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(platform, cookies);
    const res = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations/${id}/deactivate`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      }),
    );
    console.log("[super/integrations] deactivate response status:", res.status);
    return { success: true };
  },

  delete: async ({ platform, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(platform, cookies);
    const res = await platform.env.API.fetch(
      new Request(`https://internal/api/super/integrations/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      }),
    );
    console.log("[super/integrations] delete response status:", res.status);
    return { success: true };
  },
};
