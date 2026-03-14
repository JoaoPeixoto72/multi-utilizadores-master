/**
 * (super)/super/integrations/+page.server.ts — Gestão de integrações (M7)
 *
 * Fix: todas as actions passam x-csrf-token no fetch interno.
 * Novo: action "verify" envia email de teste e marca integração como testada.
 */

import { env } from "$env/dynamic/public";
import type { PageServerLoad, Actions } from "./$types";

function getApiBase(): string {
  const apiBase = env.PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) throw new Error("PUBLIC_API_URL is not configured");
  return apiBase;
}

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

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/super/integrations`, {
    headers: {
      cookie: cookies.toString()
    }
  });
  const data: { data: Integration[] } = res.ok ? await res.json() : { data: [] };
  return { integrations: data.data ?? [] };
};

/** Obtém CSRF token para usar nas chamadas fetch internas */
async function getCsrf(fetch: typeof globalThis.fetch, cookies: { toString: () => string }): Promise<string> {
  const apiBase = getApiBase();
  try {
    const r = await fetch(`${apiBase}/api/auth/csrf`, {
      headers: {
        cookie: cookies.toString()
      }
    });
    if (r.ok) {
      const d = (await r.json()) as { token: string };
      return d.token ?? "";
    }
  } catch { /* fallback */ }
  return "";
}

export const actions: Actions = {
  create: async ({ fetch, request, cookies }) => {
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

    const csrf = await getCsrf(fetch, cookies);
    const res = await fetch("/api/super/integrations", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body:    JSON.stringify({ category, provider, credentials }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: (err as { detail?: string; title?: string }).detail
                   ?? (err as { title?: string }).title
                   ?? `Erro ao criar integração (${res.status}).` };
    }
    return { success: true };
  },

  verify: async ({ fetch, request, cookies }) => {
    /** Testa a integração e envia um email de confirmação real */
    const form  = await request.formData();
    const id    = form.get("id") as string;
    const email = form.get("verify_email") as string;

    if (!email || !email.includes("@")) {
      return { verifyError: "Indique um email válido para receber o email de teste." };
    }

    const csrf = await getCsrf(fetch, cookies);

    // 1. Testar ping (valida API key)
    const testRes = await fetch(`/api/super/integrations/${id}/test`, {
      method:  "POST",
      headers: { "x-csrf-token": csrf },
    });
    const testData = await testRes.json().catch(() => ({ ok: false, message: "Erro." })) as { ok: boolean; message: string };

    if (!testData.ok) {
      return { verifyError: `Falha na ligação: ${testData.message}` };
    }

    // 2. Enviar email de verificação real
    const sendRes = await fetch("/api/super/integrations/verify-email", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body:    JSON.stringify({ id, email }),
    });

    if (!sendRes.ok) {
      const e = await sendRes.json().catch(() => ({})) as { detail?: string };
      return { verifyError: e.detail ?? "Ligação OK mas falha ao enviar email de teste." };
    }

    return { verifySuccess: `Email de verificação enviado para ${email}. Verifique a sua caixa de entrada.` };
  },

  test: async ({ fetch, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(fetch, cookies);
    const res  = await fetch(`/api/super/integrations/${id}/test`, {
      method: "POST", headers: { "x-csrf-token": csrf },
    });
    const data = await res.json().catch(() => ({ ok: false, message: "Erro." }));
    return { testResult: data };
  },

  activate: async ({ fetch, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(fetch, cookies);
    const res  = await fetch(`/api/super/integrations/${id}/activate`, {
      method: "POST", headers: { "x-csrf-token": csrf },
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { detail?: string };
      return { error: e.detail ?? "Teste a integração antes de activar." };
    }
    return { success: true };
  },

  deactivate: async ({ fetch, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(fetch, cookies);
    await fetch(`/api/super/integrations/${id}/deactivate`, {
      method: "POST", headers: { "x-csrf-token": csrf },
    });
    return { success: true };
  },

  delete: async ({ fetch, request, cookies }) => {
    const form = await request.formData();
    const id   = form.get("id") as string;
    const csrf = await getCsrf(fetch, cookies);
    await fetch(`/api/super/integrations/${id}`, {
      method: "DELETE", headers: { "x-csrf-token": csrf },
    });
    return { success: true };
  },
};
