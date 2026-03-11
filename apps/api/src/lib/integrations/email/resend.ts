/**
 * lib/integrations/email/resend.ts — Adaptador Resend (email) via fetch directo (M7)
 *
 * R: BUILD_PLAN.md §M7.2, §M7.4
 * R: STACK_LOCK.md §18 — zero SDK npm, usar fetch directo
 *
 * API: https://api.resend.com/emails  (POST)
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

import { withCircuitBreaker } from "../../circuit-breaker.js";
import type { EmailAdapter, EmailMessage, EmailSendResult } from "../adapter.interface.js";

interface ResendCredentials {
  api_key: string;
  from_email: string; // ex: "cf-base <noreply@seudominio.com>"
}

interface ResendApiResponse {
  id?: string;
  statusCode?: number;
  message?: string;
  name?: string;
}

export class ResendEmailAdapter implements EmailAdapter {
  readonly provider = "resend";

  constructor(private readonly creds: ResendCredentials) {}

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const to = Array.isArray(msg.to) ? msg.to : [msg.to];

    const result = await withCircuitBreaker(
      async () => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.creds.api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: msg.from ?? this.creds.from_email,
            to,
            subject: msg.subject,
            html: msg.html,
            ...(msg.text ? { text: msg.text } : {}),
            ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as ResendApiResponse;
          throw new Error(`resend_error:${res.status}:${err.message ?? "unknown"}`);
        }

        const data = (await res.json()) as ResendApiResponse;
        return data;
      },
      { name: "resend-email", timeoutMs: 8000, maxRetries: 2 },
    );

    return {
      messageId: (result as ResendApiResponse).id ?? crypto.randomUUID(),
      provider: "resend",
    };
  }

  async ping(): Promise<boolean> {
    try {
      // Tentativa 1: listar domínios (funciona com keys não-restritas)
      const res = await withCircuitBreaker(
        () =>
          fetch("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${this.creds.api_key}` },
          }),
        { name: "resend-ping", timeoutMs: 5000, maxRetries: 1 },
      );

      if (res.ok) return true;

      // Tentativa 2: se o erro for "restricted_api_key", a key É válida
      // — apenas não tem permissão para listar domínios (key de envio only)
      if (res.status === 401) {
        const body = (await res.json().catch(() => ({}))) as { name?: string };
        if (body.name === "restricted_api_key") {
          // Key válida mas restrita — confirmar com um send mínimo
          // Usar o endereço "onboarding@resend.dev" que não precisa de domínio verificado
          const verifyRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.creds.api_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: this.creds.from_email,
              to: ["delivered@resend.dev"], // endereço de teste Resend — sempre entrega
              subject: "cf-base ping",
              text: "ping",
            }),
          });
          return verifyRes.status === 200 || verifyRes.status === 201;
        }
        // 401 com outro motivo = key inválida
        return false;
      }

      return false;
    } catch {
      return false;
    }
  }

  /** Factory — deserializa credenciais e cria adapter */
  static fromCredentials(raw: string): ResendEmailAdapter {
    let creds: ResendCredentials;
    try {
      creds = JSON.parse(raw) as ResendCredentials;
    } catch {
      throw new Error("resend_invalid_credentials");
    }
    if (!creds.api_key || !creds.from_email) {
      throw new Error("resend_missing_fields");
    }
    return new ResendEmailAdapter(creds);
  }
}
