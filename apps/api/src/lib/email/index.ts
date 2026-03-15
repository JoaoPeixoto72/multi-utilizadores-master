/**
 * email/index.ts — Plugin de email reutilizável (Resend)
 *
 * ── Portabilidade ────────────────────────────────────────────────────────────
 * Este módulo é standalone: sem dependências do projecto-pai.
 * Para usar noutro projecto Hono + Cloudflare Workers:
 *   1. Copiar a pasta `email/` para `src/lib/email/`
 *   2. Adicionar RESEND_API_KEY ao .dev.vars e wrangler secret
 *   3. Chamar sendEmail() ou os helpers de template
 *
 * ── Ambiente necessário ──────────────────────────────────────────────────────
 *   env.RESEND_API_KEY  — API key do Resend (obrigatório)
 *   env.APP_ENV         — "production" | "development" (opcional; default: dev)
 *
 * ── Fallback sem Resend ──────────────────────────────────────────────────────
 *   Em desenvolvimento (APP_ENV != "production"), se RESEND_API_KEY não estiver
 *   definido o email é apenas logado na consola (modo dry-run).
 *
 * ── Uso básico ───────────────────────────────────────────────────────────────
 *   import { sendEmail } from "../lib/email";
 *   await sendEmail(env, {
 *     to: "user@example.com",
 *     subject: "Bem-vindo",
 *     html: "<p>Olá!</p>",
 *   });
 *
 * ── Uso com templates ────────────────────────────────────────────────────────
 *   import { sendInviteEmail, sendPasswordResetEmail } from "../lib/email";
 *   await sendInviteEmail(env, { to, inviterName, tenantName, inviteUrl });
 *   await sendPasswordResetEmail(env, { to, resetUrl, expiresInMinutes: 60 });
 */

export type { EmailEnv } from "./sender.js";
export { sendEmail } from "./sender.js";
export {
  sendInviteEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "./templates/index.js";
