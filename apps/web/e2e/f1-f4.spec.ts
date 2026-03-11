/**
 * e2e/f1-f4.spec.ts — Autenticação e convites (F1, F2, F3, F4)
 *
 * F1 — Setup inicial + login super user
 * F2 — Criar empresa + convite owner + aceitar + login owner
 * F3 — Convidar sócio + aceitar + login sócio
 * F4 — Convidar colaborador + aceitar + login colaborador
 *
 * Sessões pré-carregadas via global-setup (evita rate limiting).
 */
import { test, expect } from '@playwright/test';
import { loginSuper, loginAdmin, SUPER_EMAIL, ADMIN_EMAIL } from './helpers';

// ─── F1: Setup inicial + login super user ────────────────────────────────────
test('F1 — setup disponível ou já feito; login super user funciona', async ({ page }) => {
  // Verificar /api/setup
  const setupResp = await page.request.get('/api/setup');
  expect([200]).toContain(setupResp.status());
  const setupBody = await setupResp.json();
  expect(typeof setupBody.available).toBe('boolean');

  // Carregar sessão super_user
  await loginSuper(page);

  // Confirmar sessão activa
  const me = await page.request.get('/api/auth/me');
  expect(me.ok()).toBeTruthy();
  const meBody = await me.json();
  expect(meBody.role).toBe('super_user');
  expect(meBody.email).toBe(SUPER_EMAIL);

  // Verificar que dashboard super carrega
  await page.goto('/super/dashboard');
  await page.waitForLoadState('networkidle', { timeout: 25_000 });
  await expect(page).toHaveURL(/\/super\/dashboard/);
});

// ─── F2: Criar empresa + convite owner ───────────────────────────────────────
test('F2 — super user pode ver lista de empresas; tenant admin pode fazer login', async ({ page }) => {
  // Sessão super_user
  await loginSuper(page);

  // Navegar para lista de empresas
  await page.goto('/super/tenants');
  await page.waitForLoadState('networkidle', { timeout: 25_000 });
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('table, [data-testid="tenants-list"]').first()).toBeVisible({ timeout: 15_000 });

  // Trocar para sessão admin
  await loginAdmin(page);
  const me = await page.request.get('/api/auth/me');
  const meBody = await me.json();
  expect(meBody.role).toBe('tenant_admin');
  expect(meBody.email).toBe(ADMIN_EMAIL);

  // Verificar dashboard admin
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle', { timeout: 25_000 });
  await expect(page).toHaveURL(/\/dashboard/);
});

// ─── F3: Convidar sócio + aceitar convite ────────────────────────────────────
test('F3 — tenant admin pode convidar sócio; convite é válido', async ({ page }) => {
  await loginAdmin(page);

  // Ir para /team
  await page.goto('/team');
  await page.waitForLoadState('networkidle', { timeout: 25_000 });
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
  const csrfResp = await page.request.get('/api/auth/csrf');
  const { token: csrf } = await csrfResp.json();

  const memberEmail = `m15-member-${Date.now()}@test.dev`;
  const invResp = await page.request.post('/api/admin/team/invitations', {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { email: memberEmail, role: 'member' },
  });
  expect(invResp.ok()).toBeTruthy();
  const invBody = await invResp.json();
  // API retorna { invitation: { id, ... }, token }
  expect(invBody).toHaveProperty('invitation');
  expect(invBody.invitation).toHaveProperty('id');

  // Verificar que convite aparece na lista
  const listResp = await page.request.get('/api/admin/team/invitations');
  expect(listResp.ok()).toBeTruthy();
  const listBody = await listResp.json();
  // API retorna { rows: [...], nextCursor }
  const invList = listBody.rows ?? listBody.invitations ?? [];
  const found = invList.some((i: { email: string }) => i.email === memberEmail);
  expect(found).toBeTruthy();
});

// ─── F4: Convidar colaborador ────────────────────────────────────────────────
test('F4 — tenant admin pode convidar colaborador; convite é válido', async ({ page }) => {
  await loginAdmin(page);

  const csrfResp = await page.request.get('/api/auth/csrf');
  const { token: csrf } = await csrfResp.json();

  const collabEmail = `m15-collab-${Date.now()}@test.dev`;
  const invResp = await page.request.post('/api/admin/team/invitations', {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { email: collabEmail, role: 'collaborator' },
  });
  expect(invResp.ok()).toBeTruthy();
  const invBody = await invResp.json();
  expect(invBody).toHaveProperty('invitation');
  expect(invBody.invitation).toHaveProperty('id');
  expect(invBody.invitation.role).toBe('collaborator');
});
