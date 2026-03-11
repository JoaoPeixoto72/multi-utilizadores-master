import type { LayoutServerLoad } from "./$types";

/**
 * +layout.server.ts — carrega preferências de layout/tema/paleta dos cookies
 * e o utilizador autenticado (sessão)
 * Persistência via cookies (NUNCA localStorage — STACK_LOCK.md §14)
 */
export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
  // Obter configurações globais da aplicação
  let appConfig: Record<string, string> = {};
  try {
    const res = await fetch("/api/super/settings/config");
    if (res.ok) {
      const data = await res.json() as { config: Record<string, string> };
      appConfig = data.config || {};
    }
  } catch {
    // ignorar erros de fetch na configuração
  }

  const layout = cookies.get("cf_layout") ?? "sidebar";
  const theme = cookies.get("cf_theme") ?? "light";
  // A cor preferencial da aplicação sobrepõe-se à cookie se estiver configurada globalmente
  const palette = appConfig.ui_theme_palette || cookies.get("cf_palette") || "indigo";
  const radius = appConfig.ui_border_radius || "lg";
  const fontFamily = appConfig.ui_font_family || "inter";
  const borderActive = appConfig.ui_input_border_active ?? "true";
  const borderColor = appConfig.ui_input_border_color ?? "";
  const inputBgColor = appConfig.ui_input_bg_color ?? "";
  const inputPadding = appConfig.ui_input_padding ?? "";

  const buttonRadius = appConfig.ui_button_radius ?? "full";
  const buttonBgColor = appConfig.ui_button_bg_color ?? "";
  const buttonTextColor = appConfig.ui_button_text_color ?? "";

  // Verificar sessão activa
  let user: { id: string; email: string; role: string; tenant_id: string | null; is_owner: number; display_name: string | null } | null = null;
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = (await res.json()) as { id: string; email: string; role: string; tenant_id: string | null; is_owner: number; display_name: string | null };
      user = data;
    }
  } catch {
    // ignorar erros de rede — não autenticado
  }

  // Obter CSRF token (necessário nos formulários de mutação)
  let csrfToken: string | null = null;
  try {
    const res = await fetch("/api/auth/csrf");
    if (res.ok) {
      const data = (await res.json()) as { token: string };
      csrfToken = data.token;
    }
  } catch {
    // ignorar
  }

  return { layout, theme, palette, radius, fontFamily, borderActive, borderColor, inputBgColor, inputPadding, buttonRadius, buttonBgColor, buttonTextColor, user, csrfToken, appConfig };
};
