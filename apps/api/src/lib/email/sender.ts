/**
 * email/sender.ts — Núcleo de envio via Resend API
 *
 * Usa fetch nativo (Web API) — funciona em Cloudflare Workers sem imports extra.
 * Sem SDK do Resend — zero dependências adicionais.
 */

/** Subset do Env global necessário para envio de emails */
export interface EmailEnv {
  RESEND_API_KEY?: string;
  APP_ENV?: string;
  /** Domínio de envio verificado no Resend. Ex: "noreply@acmecorp.com" */
  EMAIL_FROM?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string; // Versão plain-text (fallback)
  replyTo?: string;
  from?: string; // Override do remetente (usa EMAIL_FROM se omitido)
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string; // ID do email no Resend (para rastreio)
  error?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Envia um email via Resend.
 * Em modo dry-run (sem API key ou APP_ENV !== "production"), apenas loga.
 */
export async function sendEmail(env: EmailEnv, opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const isProd = env.APP_ENV === "production";
  const from = opts.from ?? env.EMAIL_FROM ?? "noreply@cf-base.dev";

  // Modo dry-run: sem API key em desenvolvimento
  if (!apiKey) {
    if (isProd) {
      console.error("[email] RESEND_API_KEY não configurado em produção!");
      return { ok: false, error: "RESEND_API_KEY not configured" };
    }
    console.log("[email:dry-run]", {
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html.substring(0, 200) + "...",
    });
    return { ok: true, id: "dry-run-" + crypto.randomUUID() };
  }

  try {
    const body = {
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      ...(opts.tags ? { tags: opts.tags } : {}),
    };

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      console.error("[email] Resend error", res.status, errText);
      return { ok: false, error: `Resend ${res.status}: ${errText}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] fetch error:", msg);
    return { ok: false, error: msg };
  }
}
