/**
 * e2e/global-setup.ts — Setup global: login uma vez, guardar cookies
 *
 * Faz login para super_user e admin UMA VEZ antes de todos os testes.
 * Guarda as sessões em ficheiros JSON reutilizados por todos os testes.
 * Evita rate limiting (5 tentativas/min por IP) do Durable Object.
 */
import { chromium, type FullConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://cf-base.acemang-jedi.workers.dev';

async function loginAndSave(
  baseURL: string,
  email: string,
  password: string,
  stateFile: string
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    // Obter CSRF
    const csrfResp = await page.request.get('/api/auth/csrf');
    const { token: csrf } = await csrfResp.json();

    // Login via API
    const loginResp = await page.request.post('/api/auth/login', {
      headers: {
        'x-csrf-token': csrf,
        'content-type': 'application/json',
      },
      data: { email, password },
    });

    if (!loginResp.ok()) {
      const body = await loginResp.text();
      throw new Error(`Login falhou (${loginResp.status()}): ${body}`);
    }

    // Guardar estado (cookies) para reutilização
    await context.storageState({ path: stateFile });
    console.log(`[global-setup] Sessão guardada: ${email} → ${stateFile}`);
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(_config: FullConfig) {
  await loginAndSave(BASE_URL, 'acemang@gmail.com', 'Teste1234!@', 'e2e/.auth/super.json');
  await loginAndSave(BASE_URL, 'joaopeixoto@hotmail.com', 'Teste1234!@', 'e2e/.auth/admin.json');
}
