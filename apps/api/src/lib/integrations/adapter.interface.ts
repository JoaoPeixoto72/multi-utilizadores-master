/**
 * lib/integrations/adapter.interface.ts — Interfaces para adaptadores (M7)
 *
 * R: BUILD_PLAN.md §M7.2
 *
 * Cada categoria expõe uma interface específica.
 * Os adaptadores implementam estas interfaces via duck-typing.
 */

// ── Email ─────────────────────────────────────────────────────────────────────

export interface EmailMessage {
  to: string | string[];
  from?: string; // usa default da configuração se omitido
  subject: string;
  html: string;
  text?: string; // versão texto puro (fallback)
  replyTo?: string;
}

export interface EmailSendResult {
  messageId: string;
  provider: string;
}

export interface EmailAdapter {
  readonly provider: string;
  send(msg: EmailMessage): Promise<EmailSendResult>;
  /** Teste de conectividade — não envia email real */
  ping(): Promise<boolean>;
}

// ── SMS ───────────────────────────────────────────────────────────────────────

export interface SmsMessage {
  to: string; // número E.164 (+351...)
  body: string;
}

export interface SmsSendResult {
  messageId: string;
  provider: string;
}

export interface SmsAdapter {
  readonly provider: string;
  send(msg: SmsMessage): Promise<SmsSendResult>;
  ping(): Promise<boolean>;
}

// ── LLM ──────────────────────────────────────────────────────────────────────

export interface LlmRequest {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  content: string;
  tokensUsed: number;
  provider: string;
}

export interface LlmAdapter {
  readonly provider: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
  ping(): Promise<boolean>;
}

// ── Category map ─────────────────────────────────────────────────────────────

export type IntegrationCategory =
  | "email"
  | "sms"
  | "llm"
  | "cloud_storage"
  | "calendar"
  | "payments"
  | "invoicing"
  | "pdf";

export type IntegrationAdapter = EmailAdapter | SmsAdapter | LlmAdapter;
