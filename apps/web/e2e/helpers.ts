/**
 * e2e/helpers.ts — utilitários partilhados pelos testes M15
 *
 * Estratégia de autenticação:
 *   - loadSession() tenta carregar sessão pré-guardada em .auth/
 *   - se expirada (401), faz login automático e guarda nova sessão
 *   - rate limiting: max 5 logins/min por IP — testes sequenciais evitam isso
 */
import { expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

export const SUPER_EMAIL = "acemang@gmail.com";
export const SUPER_PASSWORD = "Teste1234!@";
export const ADMIN_EMAIL = "joaopeixoto@hotmail.com";
export const ADMIN_PASSWORD = "Teste1234!@";
export const BASE_URL = process.env.BASE_URL ?? "https://cf-base.acemang-jedi.workers.dev";

// ESModule-safe __dirname
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Carregar sessão guardada e injectar cookies no contexto */
async function loadSession(
  page: Page,
  stateFile: string,
  email: string,
  password: string,
): Promise<void> {
  const filePath = path.resolve(__dirname, stateFile);

  // Tentar sessão existente
  if (fs.existsSync(filePath)) {
    const state = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      cookies: Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: number;
        httpOnly: boolean;
        secure: boolean;
        sameSite: "Strict" | "Lax" | "None";
      }>;
    };
    await page.context().addCookies(state.cookies);

    // Verificar se sessão ainda é válida
    const meResp = await page.request.get("/api/auth/me");
    if (meResp.ok()) {
      return; // sessão válida
    }
    // Sessão expirada — limpar e refazer login
    await page.context().clearCookies();
  }

  // Login fresco
  const csrfResp = await page.request.get("/api/auth/csrf");
  const { token: csrf } = await csrfResp.json();
  const loginResp = await page.request.post("/api/auth/login", {
    headers: { "x-csrf-token": csrf, "content-type": "application/json" },
    data: { email, password },
  });

  if (!loginResp.ok()) {
    const body = await loginResp.text();
    throw new Error(`Login falhou (${loginResp.status()}): ${body.substring(0, 200)}`);
  }

  // Guardar nova sessão
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.context().storageState({ path: filePath });
}

/** Login super user — carrega ou renova sessão */
export async function loginSuper(page: Page): Promise<void> {
  await loadSession(page, ".auth/super.json", SUPER_EMAIL, SUPER_PASSWORD);
}

/** Login admin — carrega ou renova sessão */
export async function loginAdmin(page: Page): Promise<void> {
  await loadSession(page, ".auth/admin.json", ADMIN_EMAIL, ADMIN_PASSWORD);
}

/** Obter CSRF token via API */
export async function getCsrfToken(page: Page): Promise<string> {
  const resp = await page.request.get("/api/auth/csrf");
  const body = await resp.json();
  return body.token as string;
}

/** Criar convite via API e devolver o objecto invitation */
export async function createInviteViaApi(
  page: Page,
  opts: { email: string; role: "member" | "collaborator" },
): Promise<{ id: string; token: string }> {
  const csrf = await getCsrfToken(page);
  const resp = await page.request.post("/api/admin/team/invitations", {
    headers: { "x-csrf-token": csrf, "content-type": "application/json" },
    data: { email: opts.email, role: opts.role },
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  return { id: body.invitation.id, token: body.token };
}

/** Gerar email único de teste */
export function testEmail(prefix: string): string {
  return `${prefix}+${Date.now()}@test.cf-base.dev`;
}
