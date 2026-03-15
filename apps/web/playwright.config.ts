import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config — cf-base M15
 * Corre contra a URL de produção (já deployada).
 *
 * Estratégia de autenticação:
 *   - Sessões em e2e/.auth/ criadas manualmente antes dos testes
 *   - helpers.ts carrega cookies por loadSession()
 *   - Sem global-setup automático (evita rate limiting no CI)
 */

const BASE_URL = process.env.BASE_URL ?? "https://cf-base.acemang-jedi.workers.dev";

export default defineConfig({
  testDir: "./e2e",
  timeout: 40_000,
  retries: 1,
  workers: 1, // sequencial — evita conflitos de estado na BD remota
  reporter: [["list"], ["json", { outputFile: "e2e-results.json" }]],

  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
