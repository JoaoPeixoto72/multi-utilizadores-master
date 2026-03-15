/**
 * email/templates/index.ts — Templates prontos a usar
 *
 * Todos os templates devolvem HTML completo e texto plain-text.
 * Portáveis para qualquer projecto — apenas editar os textos e o appName.
 */

import { type EmailEnv, sendEmail } from "../sender.js";
import { baseEmailHtml, ctaButton, fallbackUrl, para } from "./base.js";

// ── Convite de membro ────────────────────────────────────────────────────────

export interface InviteEmailOptions {
  to: string;
  inviterName: string;
  tenantName: string;
  role: "member" | "collaborator" | string;
  inviteUrl: string;
  /** Horas até expirar. Default: 24 */
  expiresInHours?: number;
  appName?: string;
}

export async function sendInviteEmail(env: EmailEnv, opts: InviteEmailOptions) {
  const {
    to,
    inviterName,
    tenantName,
    role,
    inviteUrl,
    expiresInHours = 24,
    appName = "CF-Base",
  } = opts;

  const roleLabel = role === "member" ? "Membro" : role === "collaborator" ? "Colaborador" : role;

  const bodyHtml = [
    para(
      `<strong>${inviterName}</strong> convidou-o para se juntar a <strong>${tenantName}</strong> como <strong>${roleLabel}</strong>.`,
    ),
    para(`O convite expira em ${expiresInHours} hora${expiresInHours === 1 ? "" : "s"}.`, true),
    ctaButton("Aceitar convite", inviteUrl),
    fallbackUrl(inviteUrl),
  ].join("");

  const html = baseEmailHtml({
    title: `Convite para ${tenantName}`,
    previewText: `${inviterName} convidou-o para ${tenantName}`,
    bodyHtml,
    appName,
    footerText: "Se não esperava este convite, pode ignorar este email.",
  });

  const text = `${inviterName} convidou-o para se juntar a ${tenantName} como ${roleLabel}.\n\nAceitar convite: ${inviteUrl}\n\nO convite expira em ${expiresInHours}h.`;

  return sendEmail(env, { to, subject: `Convite para ${tenantName}`, html, text });
}

// ── Reset de password ────────────────────────────────────────────────────────

export interface PasswordResetEmailOptions {
  to: string;
  resetUrl: string;
  /** Minutos até expirar. Default: 60 */
  expiresInMinutes?: number;
  appName?: string;
}

export async function sendPasswordResetEmail(env: EmailEnv, opts: PasswordResetEmailOptions) {
  const { to, resetUrl, expiresInMinutes = 60, appName = "CF-Base" } = opts;

  const bodyHtml = [
    para("Recebemos um pedido para redefinir a password da sua conta."),
    para(
      `Este link expira em ${expiresInMinutes} minuto${expiresInMinutes === 1 ? "" : "s"}.`,
      true,
    ),
    ctaButton("Redefinir password", resetUrl),
    fallbackUrl(resetUrl),
    para(
      "Se não pediu a redefinição de password, pode ignorar este email. A sua password permanece inalterada.",
      true,
    ),
  ].join("");

  const html = baseEmailHtml({
    title: "Redefinir password",
    previewText: "Pedido de redefinição de password",
    bodyHtml,
    appName,
    footerText:
      "Por segurança, este link é de uso único e expira ao fim de " +
      expiresInMinutes +
      " minutos.",
  });

  const text = `Pedido de redefinição de password.\n\nRedefinir: ${resetUrl}\n\nExpira em ${expiresInMinutes} minutos.\n\nSe não pediu isto, ignore este email.`;

  return sendEmail(env, { to, subject: "Redefinir password", html, text });
}

// ── Boas-vindas ──────────────────────────────────────────────────────────────

export interface WelcomeEmailOptions {
  to: string;
  userName: string;
  loginUrl: string;
  appName?: string;
}

export async function sendWelcomeEmail(env: EmailEnv, opts: WelcomeEmailOptions) {
  const { to, userName, loginUrl, appName = "CF-Base" } = opts;

  const bodyHtml = [
    para(`Olá <strong>${userName}</strong>, a sua conta está pronta!`),
    para("Bem-vindo à plataforma. Pode fazer login e começar a utilizar o sistema.", true),
    ctaButton("Ir para o painel", loginUrl),
  ].join("");

  const html = baseEmailHtml({
    title: `Bem-vindo ao ${appName}`,
    previewText: `A sua conta ${appName} está pronta`,
    bodyHtml,
    appName,
  });

  const text = `Olá ${userName},\n\nA sua conta está pronta.\n\nLogin: ${loginUrl}`;

  return sendEmail(env, { to, subject: `Bem-vindo ao ${appName}`, html, text });
}
