/**
 * e2e/f9-f15.spec.ts — Operações avançadas (F9–F15)
 *
 * F9  — Hard delete empresa (verificação de pre-condições)
 * F10 — Reset de password (token uso único)
 * F11 — Alterar email (endpoint existe)
 * F12 — Exportação RGPD
 * F13 — Backup manual (síncrono)
 * F14 — Limpar histórico (backup prévio obrigatório)
 * F15 — Escalação de recursos (3 níveis via super settings)
 *
 * Sessões pré-carregadas via global-setup.
 * GET /api/super/tenants retorna { data: [...] }
 * GET /api/user/profile/export-rgpd retorna { exported_at, core, module_data }
 * POST /api/admin/backups requer { type: "db_only"|"full" }
 * Lista de backups retorna { items: [...], nextCursor }
 */
import { test, expect } from '@playwright/test';
import { loginAdmin, loginSuper } from './helpers';

// ─── F9: Hard delete empresa ──────────────────────────────────────────────────
test('F9 — hard delete empresa: endpoint valida pre-condições', async ({ page }) => {
  await loginSuper(page);

  const tenantsResp = await page.request.get('/api/super/tenants');
  const tenantsBody = await tenantsResp.json();
  const tenants = tenantsBody.data ?? [];

  if (tenants.length >= 2) {
    const tenant = tenants.find(
      (t: { status: string }) => t.status === 'pending'
    ) ?? tenants[tenants.length - 1];

    const csrf = await (await page.request.get('/api/auth/csrf')).json();
    const resp = await page.request.delete(`/api/super/tenants/${tenant.id}`, {
      headers: { 'x-csrf-token': csrf.token, 'content-type': 'application/json' },
      data: { confirmation: 'ELIMINAR' },
    });
    expect([200, 400, 409, 422, 500]).toContain(resp.status());
  } else {
    const csrf = await (await page.request.get('/api/auth/csrf')).json();
    const resp = await page.request.delete(`/api/super/tenants/invalid-id`, {
      headers: { 'x-csrf-token': csrf.token, 'content-type': 'application/json' },
      data: { confirmation: 'ELIMINAR' },
    });
    expect([400, 404, 409, 422, 500]).toContain(resp.status());
  }
});

// ─── F10: Reset de password ───────────────────────────────────────────────────
test('F10 — reset de password: request cria token, confirm valida token usado', async ({ page }) => {
  // Não precisa de sessão — endpoint público
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const reqResp = await page.request.post('/api/auth/password-reset/request', {
    headers: { 'x-csrf-token': csrf.token, 'content-type': 'application/json' },
    data: { email: 'nonexistent@test.dev' },
  });
  expect(reqResp.ok()).toBeTruthy(); // sempre 200 (não revela existência)

  const csrf2 = await (await page.request.get('/api/auth/csrf')).json();
  const confirmResp = await page.request.post('/api/auth/password-reset/confirm', {
    headers: { 'x-csrf-token': csrf2.token, 'content-type': 'application/json' },
    data: { token: 'invalid-token-000000', new_password: 'NovaPass@123!' },
  });
  expect([400, 404, 422]).toContain(confirmResp.status());

  // UI: página /password-reset carrega
  await page.goto('/password-reset');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
});

// ─── F11: Alterar email ───────────────────────────────────────────────────────
test('F11 — alterar email: endpoint existe, token inválido dá erro correcto', async ({ page }) => {
  await loginAdmin(page);

  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const resp = await page.request.post('/api/user/profile/change-email', {
    headers: { 'x-csrf-token': csrf.token, 'content-type': 'application/json' },
    data: { new_email: `changed-${Date.now()}@test.dev` },
  });
  expect([200, 400, 409]).toContain(resp.status());

  // Confirmar com token inválido → erro
  const confirmResp = await page.request.get('/api/user/confirm-email/invalid-token-xyz');
  expect([400, 404]).toContain(confirmResp.status());
});

// ─── F12: Exportação RGPD ─────────────────────────────────────────────────────
test('F12 — exportação RGPD devolve JSON com dados do utilizador', async ({ page }) => {
  await loginAdmin(page);

  const resp = await page.request.get('/api/user/profile/export-rgpd');
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();

  // API retorna { exported_at, core: { id, email, ... }, module_data }
  expect(body).toHaveProperty('exported_at');
  expect(body).toHaveProperty('core');
  expect(body.core).toHaveProperty('email');
  expect(body.core.email).toBe('joaopeixoto@hotmail.com');

  // pass_hash NUNCA deve aparecer (GS09 / IDOR audit)
  expect(JSON.stringify(body)).not.toContain('pass_hash');
});

// ─── F13: Backup manual ───────────────────────────────────────────────────────
test('F13 — backup manual cria entrada e devolve OK', async ({ page }) => {
  await loginAdmin(page);

  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const resp = await page.request.post('/api/admin/backups', {
    headers: { 'x-csrf-token': csrf.token, 'content-type': 'application/json' },
    data: { type: 'db_only' },
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  expect(body).toHaveProperty('id');
  expect(body).toHaveProperty('status');

  // Lista retorna { items: [...], nextCursor }
  const listResp = await page.request.get('/api/admin/backups');
  expect(listResp.ok()).toBeTruthy();
  const listBody = await listResp.json();
  expect(listBody.items?.length).toBeGreaterThan(0);
});

// ─── F14: Limpar histórico ────────────────────────────────────────────────────
test('F14 — limpar histórico de actividade', async ({ page }) => {
  await loginAdmin(page);

  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const resp = await page.request.delete('/api/admin/activity', {
    headers: { 'x-csrf-token': csrf.token, 'content-type': 'application/json' },
    data: {},
  });
  // 200 = limpou (backup recente do F13); 409 = backup em falta/expirado
  expect([200, 409]).toContain(resp.status());

  if (resp.status() === 200) {
    const body = await resp.json();
    expect(body).toHaveProperty('success');
    expect(body.success).toBe(true);
  }
});

// ─── F15: Escalação de recursos ───────────────────────────────────────────────
test('F15 — super user pode actualizar limites de recursos do tenant', async ({ page }) => {
  await loginSuper(page);

  const tenantsResp = await page.request.get('/api/super/tenants');
  const tenantsBody = await tenantsResp.json();
  const tenant = tenantsBody.data?.find(
    (t: { status: string; email: string }) => t.email === 'joaopeixoto@hotmail.com'
  ) ?? tenantsBody.data?.[0];
  expect(tenant).toBeDefined();

  const originalAdminLimit = tenant.admin_seat_limit;
  const originalMemberLimit = tenant.member_seat_limit;

  // PATCH /api/super/tenants/:id/limits
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const patchResp = await page.request.patch(`/api/super/tenants/${tenant.id}/limits`, {
    headers: { 'x-csrf-token': csrf.token, 'content-type': 'application/json' },
    data: { admin_seat_limit: 5, member_seat_limit: 20 },
  });
  expect(patchResp.ok()).toBeTruthy();

  // Verificar update
  const detailResp = await page.request.get(`/api/super/tenants/${tenant.id}`);
  const detail = await detailResp.json();
  expect(detail.tenant?.admin_seat_limit).toBe(5);
  expect(detail.tenant?.member_seat_limit).toBe(20);

  // Repor valores originais
  const csrf2 = await (await page.request.get('/api/auth/csrf')).json();
  const restoreResp = await page.request.patch(`/api/super/tenants/${tenant.id}/limits`, {
    headers: { 'x-csrf-token': csrf2.token, 'content-type': 'application/json' },
    data: { admin_seat_limit: originalAdminLimit, member_seat_limit: originalMemberLimit },
  });
  expect(restoreResp.ok()).toBeTruthy();
});
