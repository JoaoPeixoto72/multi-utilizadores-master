import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ platform, request }) => {
  const env = (platform as any)?.env as Record<string, string | undefined> | undefined;
  const cookiesHeader = request.headers.get("cookie") ?? "";

  const res = await platform.env.API.fetch(
    new Request(`https://internal/api/super/settings/config`, {
      headers: {
        cookie: cookiesHeader,
      },
    }),
  );
  const bodyText = await res.text();
  console.log("[super/settings] response status:", res.status);
  console.log("[super/settings] response body:", bodyText);
  const configData = res.ok ? (JSON.parse(bodyText) as { config: Record<string, string> }) : { config: {} };
  const appConfig = configData.config;

  // Variáveis não-secretas (leitura directa)
  const publicVars = [
    { key: "APP_ENV", label: "Ambiente", value: env?.APP_ENV ?? "—", secret: false, description: "Ambiente de execução (development / production)" },
    { key: "APP_URL", label: "URL da App", value: env?.APP_URL ?? "—", secret: false, description: "URL pública da aplicação (usado nos emails e links)" },
  ];

  // Secrets — nunca expor valores, apenas indicar se estão definidos
  const secretVars = [
    { key: "CSRF_SECRET", label: "CSRF Secret", configured: !!env?.CSRF_SECRET, description: "Segredo para tokens CSRF (min. 64 hex chars)" },
    { key: "SESSION_SECRET", label: "Session Secret", configured: !!env?.SESSION_SECRET, description: "Segredo para assinar sessões (min. 64 hex chars)" },
    { key: "ENCRYPTION_KEY", label: "Encryption Key", configured: !!env?.ENCRYPTION_KEY, description: "Chave AES-256-GCM para cifrar credenciais de integrações" },
    { key: "CF_ACCOUNT_ID", label: "CF Account ID", configured: !!env?.CF_ACCOUNT_ID, description: "Cloudflare Account ID (usado para PDF via Browser Rendering)" },
    { key: "CF_API_TOKEN", label: "CF API Token", configured: !!env?.CF_API_TOKEN, description: "Cloudflare API Token com permissão Browser Rendering" },
    { key: "SENTRY_DSN", label: "Sentry DSN", configured: !!env?.SENTRY_DSN, description: "DSN do Sentry para error monitoring (opcional)" },
  ];

  // Serviços Cloudflare
  const cloudflareServices = [
    { label: "D1 Database", binding: "DB", active: true, description: "Base de dados SQLite distribuída globalmente" },
    { label: "R2 Storage", binding: "R2_BUCKET", active: true, description: "Armazenamento de objectos (backups, ficheiros)" },
    { label: "Rate Limiter", binding: "RATE_LIMITER", active: true, description: "Durable Object para rate limiting por IP" },
    { label: "Backup Queue", binding: "BACKUP_QUEUE", active: false, description: "Queue de backups (requer Workers Paid plan)" },
  ];

  return { publicVars, secretVars, cloudflareServices, appConfig };
};

export const actions: Actions = {
  default: async ({ request, platform }) => {
    const cookiesHeader = request.headers.get("cookie") ?? "";
    const formData = await request.formData();
    const configData: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && key !== "_csrf") {
        configData[key] = value;
      }
    }

    const csrfToken = formData.get("_csrf") as string || "";

    const res = await platform.env.API.fetch(
      new Request(`https://internal/api/super/settings/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
          cookie: cookiesHeader,
        },
        body: JSON.stringify(configData),
      }),
    );
    const bodyText = await res.text();
    console.log("[super/settings] response status:", res.status);
    console.log("[super/settings] response body:", bodyText);

    if (!res.ok) {
      const errorData = (bodyText ? JSON.parse(bodyText) : {}) as { detail?: string };
      return fail(res.status, {
        error: errorData.detail || "Erro ao guardar as configurações.",
      });
    }

    return { success: true };
  },
};
