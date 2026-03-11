/**
 * lib/integrations/email/templates/index.ts — Templates de email HTML (M7/M12)
 *
 * R: BUILD_PLAN.md §M7.4, §M12
 *
 * M12: suporte i18n — todos os templates aceitam `lang?: "pt" | "en"` (default: "pt").
 * As strings de UI são definidas em dois idiomas e seleccionadas via `t()`.
 */

// ── Traduções de email ─────────────────────────────────────────────────────────

type Lang = "pt" | "en";

const TRANSLATIONS = {
  pt: {
    footer: "Este email foi enviado automaticamente. Por favor não responda.",
    greeting: "Olá,",
    link_fallback: "Ou copie este URL:",
    invite_owner_subject: (tenantName: string) => `Convite para ser owner da empresa ${tenantName}`,
    invite_owner_body: (tenantName: string, expiresIn: string) =>
      `Foi convidado para ser o <strong>owner</strong> da empresa <strong>${tenantName}</strong> na plataforma.<br><br>Clique no botão abaixo para aceitar o convite e definir a sua password. O link expira em <strong>${expiresIn}</strong>.`,
    invite_owner_btn: "Aceitar convite",
    invite_owner_text: (tenantName: string, acceptUrl: string, expiresIn: string) =>
      `Convite para owner de ${tenantName}\n\nAceite o convite em: ${acceptUrl}\n\nExpira em ${expiresIn}.`,

    invite_member_subject: (roleLabel: string, tenantName: string) =>
      `Convite para ser ${roleLabel} em ${tenantName}`,
    invite_member_body: (
      inviterName: string,
      roleLabel: string,
      tenantName: string,
      expiresIn: string,
    ) =>
      `<strong>${inviterName}</strong> convidou-o para ser <strong>${roleLabel}</strong> da empresa <strong>${tenantName}</strong>.<br><br>Clique no botão abaixo para aceitar o convite. O link expira em <strong>${expiresIn}</strong>.`,
    invite_member_btn: "Aceitar convite",
    invite_member_role_member: "sócio",
    invite_member_role_collaborator: "colaborador",
    invite_member_text: (
      roleLabel: string,
      tenantName: string,
      acceptUrl: string,
      expiresIn: string,
    ) =>
      `Convite para ${roleLabel} em ${tenantName}\n\nAceite o convite em: ${acceptUrl}\n\nExpira em ${expiresIn}.`,

    password_reset_subject: "Redefinição de password",
    password_reset_body: (userEmail: string, expiresIn: string) =>
      `Recebemos um pedido para redefinir a password da sua conta <strong>${userEmail}</strong>.<br><br>Clique no botão abaixo para criar uma nova password. O link expira em <strong>${expiresIn}</strong>.`,
    password_reset_btn: "Redefinir password",
    password_reset_footer: "Se não pediu a redefinição, ignore este email.",
    password_reset_text: (resetUrl: string, expiresIn: string) =>
      `Redefinição de password\n\nDefina a nova password em: ${resetUrl}\n\nExpira em ${expiresIn}.`,

    email_change_subject: "Confirmação de alteração de email",
    email_change_body: (newEmail: string, expiresIn: string) =>
      `Foi pedida a alteração do email da sua conta para <strong>${newEmail}</strong>.<br><br>Clique no botão abaixo para confirmar a alteração. O link expira em <strong>${expiresIn}</strong>.`,
    email_change_btn: "Confirmar novo email",
    email_change_footer: "Se não pediu esta alteração, ignore este email.",
    email_change_text: (confirmUrl: string, expiresIn: string) =>
      `Confirmação de alteração de email\n\nConfirme em: ${confirmUrl}\n\nExpira em ${expiresIn}.`,

    urgent_label: "⚠️ Notificação urgente",
    urgent_subject: (title: string) => `[URGENTE] ${title}`,
    urgent_btn: "Ver detalhes",
    urgent_text: (title: string, body: string, link?: string) =>
      `[URGENTE] ${title}\n\n${body}${link ? `\n\nVer: ${link}` : ""}`,

    expires_hours: (h: number) => (h === 1 ? "1 hora" : `${h} horas`),
    expires_days: (d: number) => (d === 1 ? "1 dia" : `${d} dias`),
  },

  en: {
    footer: "This email was sent automatically. Please do not reply.",
    greeting: "Hello,",
    link_fallback: "Or copy this URL:",
    invite_owner_subject: (tenantName: string) => `Invitation to be owner of ${tenantName}`,
    invite_owner_body: (tenantName: string, expiresIn: string) =>
      `You have been invited to be the <strong>owner</strong> of <strong>${tenantName}</strong>.<br><br>Click the button below to accept the invitation and set your password. The link expires in <strong>${expiresIn}</strong>.`,
    invite_owner_btn: "Accept invitation",
    invite_owner_text: (tenantName: string, acceptUrl: string, expiresIn: string) =>
      `Invitation to be owner of ${tenantName}\n\nAccept the invitation at: ${acceptUrl}\n\nExpires in ${expiresIn}.`,

    invite_member_subject: (roleLabel: string, tenantName: string) =>
      `Invitation to join ${tenantName} as ${roleLabel}`,
    invite_member_body: (
      inviterName: string,
      roleLabel: string,
      tenantName: string,
      expiresIn: string,
    ) =>
      `<strong>${inviterName}</strong> has invited you to be a <strong>${roleLabel}</strong> of <strong>${tenantName}</strong>.<br><br>Click the button below to accept the invitation. The link expires in <strong>${expiresIn}</strong>.`,
    invite_member_btn: "Accept invitation",
    invite_member_role_member: "member",
    invite_member_role_collaborator: "collaborator",
    invite_member_text: (
      roleLabel: string,
      tenantName: string,
      acceptUrl: string,
      expiresIn: string,
    ) =>
      `Invitation to join ${tenantName} as ${roleLabel}\n\nAccept the invitation at: ${acceptUrl}\n\nExpires in ${expiresIn}.`,

    password_reset_subject: "Password reset",
    password_reset_body: (userEmail: string, expiresIn: string) =>
      `We received a request to reset the password for <strong>${userEmail}</strong>.<br><br>Click the button below to create a new password. The link expires in <strong>${expiresIn}</strong>.`,
    password_reset_btn: "Reset password",
    password_reset_footer: "If you did not request this, please ignore this email.",
    password_reset_text: (resetUrl: string, expiresIn: string) =>
      `Password reset\n\nSet your new password at: ${resetUrl}\n\nExpires in ${expiresIn}.`,

    email_change_subject: "Email change confirmation",
    email_change_body: (newEmail: string, expiresIn: string) =>
      `A change of your account email to <strong>${newEmail}</strong> was requested.<br><br>Click the button below to confirm the change. The link expires in <strong>${expiresIn}</strong>.`,
    email_change_btn: "Confirm new email",
    email_change_footer: "If you did not request this change, please ignore this email.",
    email_change_text: (confirmUrl: string, expiresIn: string) =>
      `Email change confirmation\n\nConfirm at: ${confirmUrl}\n\nExpires in ${expiresIn}.`,

    urgent_label: "⚠️ Urgent notification",
    urgent_subject: (title: string) => `[URGENT] ${title}`,
    urgent_btn: "View details",
    urgent_text: (title: string, body: string, link?: string) =>
      `[URGENT] ${title}\n\n${body}${link ? `\n\nSee: ${link}` : ""}`,

    expires_hours: (h: number) => (h === 1 ? "1 hour" : `${h} hours`),
    expires_days: (d: number) => (d === 1 ? "1 day" : `${d} days`),
  },
} as const satisfies Record<Lang, unknown>;

function t(lang: Lang) {
  return TRANSLATIONS[lang] ?? TRANSLATIONS.pt;
}

// ── Wrapper HTML base ─────────────────────────────────────────────────────────

function baseLayout(title: string, body: string, lang: Lang = "pt"): string {
  const tr = t(lang);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; }
    .card { background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .header { background: #1e293b; padding: 24px 32px; }
    .header h1 { margin: 0; color: #f1f5f9; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; color: #334155; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 8px 0 16px; }
    .btn:hover { background: #2563eb; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; }
    .code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px 20px; font-family: monospace; font-size: 24px; letter-spacing: 4px; color: #1e293b; text-align: center; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header"><h1>cf‑base</h1></div>
      <div class="body"><p>${tr.greeting}</p>${body}</div>
      <div class="footer">${tr.footer}</div>
    </div>
  </div>
</body>
</html>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface InviteOwnerVars {
  inviteeEmail: string;
  tenantName: string;
  acceptUrl: string;
  expiresIn: string;
  lang?: Lang;
}

export function inviteOwnerTemplate(v: InviteOwnerVars): {
  subject: string;
  html: string;
  text: string;
} {
  const lang = v.lang ?? "pt";
  const tr = t(lang);
  const subject = tr.invite_owner_subject(v.tenantName);
  const html = baseLayout(
    subject,
    `<p>${tr.invite_owner_body(v.tenantName, v.expiresIn)}</p>
    <a href="${v.acceptUrl}" class="btn">${tr.invite_owner_btn}</a>
    <p style="color:#64748b;font-size:13px;">${tr.link_fallback} ${v.acceptUrl}</p>`,
    lang,
  );
  const text = tr.invite_owner_text(v.tenantName, v.acceptUrl, v.expiresIn);
  return { subject, html, text };
}

export interface InviteMemberVars {
  inviteeEmail: string;
  tenantName: string;
  role: "member" | "collaborator";
  inviterName: string;
  acceptUrl: string;
  expiresIn: string;
  lang?: Lang;
}

export function inviteMemberTemplate(v: InviteMemberVars): {
  subject: string;
  html: string;
  text: string;
} {
  const lang = v.lang ?? "pt";
  const tr = t(lang);
  const roleLabel =
    v.role === "member" ? tr.invite_member_role_member : tr.invite_member_role_collaborator;
  const subject = tr.invite_member_subject(roleLabel, v.tenantName);
  const html = baseLayout(
    subject,
    `<p>${tr.invite_member_body(v.inviterName, roleLabel, v.tenantName, v.expiresIn)}</p>
    <a href="${v.acceptUrl}" class="btn">${tr.invite_member_btn}</a>
    <p style="color:#64748b;font-size:13px;">${tr.link_fallback} ${v.acceptUrl}</p>`,
    lang,
  );
  const text = tr.invite_member_text(roleLabel, v.tenantName, v.acceptUrl, v.expiresIn);
  return { subject, html, text };
}

export interface PasswordResetVars {
  userEmail: string;
  resetUrl: string;
  expiresIn: string;
  lang?: Lang;
}

export function passwordResetTemplate(v: PasswordResetVars): {
  subject: string;
  html: string;
  text: string;
} {
  const lang = v.lang ?? "pt";
  const tr = t(lang);
  const subject = tr.password_reset_subject;
  const html = baseLayout(
    subject,
    `<p>${tr.password_reset_body(v.userEmail, v.expiresIn)}</p>
    <a href="${v.resetUrl}" class="btn">${tr.password_reset_btn}</a>
    <p style="color:#64748b;font-size:13px;">${tr.password_reset_footer}</p>`,
    lang,
  );
  const text = tr.password_reset_text(v.resetUrl, v.expiresIn);
  return { subject, html, text };
}

export interface EmailChangeVars {
  userEmail: string;
  newEmail: string;
  confirmUrl: string;
  expiresIn: string;
  lang?: Lang;
}

export function emailChangeTemplate(v: EmailChangeVars): {
  subject: string;
  html: string;
  text: string;
} {
  const lang = v.lang ?? "pt";
  const tr = t(lang);
  const subject = tr.email_change_subject;
  const html = baseLayout(
    subject,
    `<p>${tr.email_change_body(v.newEmail, v.expiresIn)}</p>
    <a href="${v.confirmUrl}" class="btn">${tr.email_change_btn}</a>
    <p style="color:#64748b;font-size:13px;">${tr.email_change_footer}</p>`,
    lang,
  );
  const text = tr.email_change_text(v.confirmUrl, v.expiresIn);
  return { subject, html, text };
}

export interface UrgentNotifVars {
  title: string;
  body: string;
  link?: string;
  lang?: Lang;
}

export function urgentNotifTemplate(v: UrgentNotifVars): {
  subject: string;
  html: string;
  text: string;
} {
  const lang = v.lang ?? "pt";
  const tr = t(lang);
  const subject = tr.urgent_subject(v.title);
  const linkHtml = v.link ? `<a href="${v.link}" class="btn">${tr.urgent_btn}</a>` : "";
  const html = baseLayout(
    subject,
    `<p style="color:#dc2626;font-weight:600;">${tr.urgent_label}</p>
    <p><strong>${v.title}</strong></p>
    <p>${v.body}</p>
    ${linkHtml}`,
    lang,
  );
  const text = tr.urgent_text(v.title, v.body, v.link);
  return { subject, html, text };
}

/**
 * Helper: converte "24h" / "1h" / "7d" para string localizada.
 * Usar quando o caller conhece a duração em horas/dias.
 */
export function localizeExpiry(amount: number, unit: "hours" | "days", lang: Lang = "pt"): string {
  const tr = t(lang);
  return unit === "hours" ? tr.expires_hours(amount) : tr.expires_days(amount);
}
