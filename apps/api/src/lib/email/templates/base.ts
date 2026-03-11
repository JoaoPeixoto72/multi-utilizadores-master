/**
 * email/templates/base.ts — Layout HTML base para todos os emails
 *
 * Design minimalista, compatível com os principais clientes de email.
 * Cores hardcoded (não usa CSS tokens — email clients não suportam variáveis CSS).
 */

export interface BaseEmailOptions {
  title: string;
  previewText?: string;
  bodyHtml: string;
  footerText?: string;
  /** Nome da app/produto exibido no topo */
  appName?: string;
  /** URL do logótipo (opcional) */
  logoUrl?: string;
  /** Cor de destaque (hex). Default: #18181b (zinc-900) */
  accentColor?: string;
}

export function baseEmailHtml(opts: BaseEmailOptions): string {
  const {
    title,
    previewText = "",
    bodyHtml,
    footerText = "Recebeu este email porque tem uma conta na nossa plataforma.",
    appName     = "CF-Base",
    accentColor = "#18181b",
  } = opts;

  return `<!DOCTYPE html>
<html lang="pt" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escHtml(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: #f4f4f5; }
    a { color: ${accentColor}; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escHtml(previewText)}&nbsp;&#847; &zwnj;&nbsp;&#847; &zwnj;</div>` : ""}

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 20px;border-bottom:1px solid #f4f4f5;">
              <span style="font-size:16px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:0.08em;">${escHtml(appName)}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">${escHtml(footerText)}</p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->
</body>
</html>`;
}

/** Escapa caracteres HTML para uso em strings interpoladas */
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Botão de call-to-action */
export function ctaButton(label: string, url: string, color = "#18181b"): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:6px;background-color:${color};">
          <a href="${url}" target="_blank"
             style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.02em;">
            ${escHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Parágrafo estilizado */
export function para(text: string, muted = false): string {
  const color = muted ? "#71717a" : "#18181b";
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${color};">${text}</p>`;
}

/** URL de fallback (texto copiável) */
export function fallbackUrl(url: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
    Se o botão não funcionar, copie este link:<br/>
    <a href="${url}" style="color:#52525b;word-break:break-all;">${url}</a>
  </p>`;
}
