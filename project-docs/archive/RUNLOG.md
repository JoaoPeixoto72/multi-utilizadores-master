# RUNLOG.md — cf-base
# Propósito: registo append-only de artefactos criados, gates e deploy por milestone
# NÃO colocar aqui: bugs (→ LESSONS_LEARNED.md), testes (→ TESTS_LOG.md), estado actual (→ KNOWLEDGE.md)
# Formato por entrada: Milestone | Data | Artefactos | Gates | Deploy | Commit

---

## M0 — Scaffolding + CI + Infraestrutura base (2026-02-26)

**Artefactos criados:**
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.json` (raiz)
- `vitest.config.ts`, `wrangler.toml`, `.dev.vars.example`, `.gitignore`, `worker-configuration.d.ts`
- `.github/workflows/ci.yml`
- SvelteKit: `svelte.config.js`, `vite.config.ts`, `app.html`, `app.css`, `tokens.css`
- `hooks.server.ts`, `+layout.svelte`, `+layout.server.ts`, `+error.svelte`, `+page.svelte`
- `apps/web/src/lib/api/client.ts`
- Hono: `apps/api/src/index.ts` (AppType), `routes/health.ts`, `lib/logger.ts`, `lib/problem.ts`
- Shared: `packages/shared/schemas/pagination.ts`, `schemas/common.ts`, `types/roles.ts`
- `migrations/0001_auth.sql` (users + sessions)
- `messages/pt.json` + `messages/en.json` (50+ chaves)
- `project-docs/design/tokens.css` (371 variáveis, 11 secções)

**Gates:** G01 ✅ G02 ✅ G06 ✅ G07 ✅ G10 ✅ G12 ✅ G13 ✅ GS05 ✅ GS06 ✅ GS07 ✅ GS09 ✅

**Deploy:** —

---

## M1 — Autenticação (2026-02-26)

**Artefactos criados:**
- `apps/api/src/lib/auth.ts`, `lib/session.ts`, `lib/csrf.ts`, `lib/token.ts`, `lib/rate-limiter-do.ts`
- `apps/api/src/middleware/auth.ts`, `middleware/csrf.ts`, `middleware/rate-limit.ts`
- `apps/api/src/routes/auth/csrf.ts`, `login.ts`, `logout.ts`, `me.ts`, `setup.ts`, `password-reset.ts`
- `apps/api/src/db/queries/users.ts`, `sessions.ts`, `password-resets.ts`
- `apps/api/src/tests/auth.test.ts`, `csrf.test.ts`, `token.test.ts`, `session.test.ts`
- `apps/api/src/tests/logger.test.ts`, `problem.test.ts`, `rate-limiter-do.test.ts`
- `apps/web/src/routes/(auth)/login/`, `setup/`, `password-reset/`, `password-reset/[token]/`
- `apps/web/src/lib/components/auth/PasswordChecklist.svelte`
- `migrations/0002_auth_extended.sql`
- i18n: 67 chaves `pt.json` + 67 chaves `en.json`

**Gates:** G01 ✅ G02 ✅ G04 ✅ 82/82 G05 ✅ 81.4% GS01 ✅ GS04 ✅ GS05 ✅ GS06 ✅ GS07 ✅ GS08 ✅ GS09 ✅

**Deploy:** Version `a84f83a1` — https://cf-base.acemang-jedi.workers.dev

**Commit:** `fix(M1): install bcryptjs` + `test(M1): add unit tests 82/82`

---

## M2 — Multi-tenancy + Super User (2026-02-27)

**Artefactos criados:**
- `migrations/0003_core.sql` (tenants, invitations, tenant_module_limits, tenant_storage_usage, tenant_daily_email_count, app_config + extensão de users)
- `migrations/0006_tenant_pending_status.sql` (fix: DEFAULT 'pending')
- `apps/api/src/db/queries/tenants.ts`, `invitations.ts`, `app-config.ts`, `email-counters.ts`, `storage.ts`
- `apps/api/src/services/tenant.service.ts`, `invitation.service.ts`, `quota.service.ts`
- `apps/api/src/routes/super/tenants.ts` (11 endpoints), `routes/invitations/accept.ts`
- `apps/api/src/tests/tenant.test.ts` (12), `invitation.test.ts` (11), `queries.test.ts` (30), `middleware.test.ts` (19)
- `apps/web/src/routes/invite/[token]/`
- `apps/web/src/routes/(super)/+layout.server.ts`, `+layout.svelte`
- `apps/web/src/routes/(super)/super/dashboard/`, `tenants/`, `tenants/new/`, `tenants/[id]/`

**Gates:** G01 ✅ G02 ✅ G03 ✅ G04 ✅ 145/145 G05 ✅ 75.9% GS01 ✅

**Deploy:** Version `cbbb5ca8` → `a84f83a1` (hotfixes: LL-03, LL-05, LL-06)

**Commit:** `feat(M2): multi-tenancy + super user` + `fix(M2): redirect/session hotfixes`

---

## M2 Reorganização de docs (2026-02-27)

**Artefactos criados/actualizados:**
- `project-docs/` reestruturado (pasta duplicada eliminada)
- `project-docs/KNOWLEDGE.md` criado
- `project-docs/LESSONS_LEARNED.md` criado (LL-01..LL-06)
- `project-docs/README.txt` criado
- `apps/web/package.json`: script `prebuild` com `paraglide-js compile` (elimina necessidade de actualizar messages.js manualmente)
- STACK_LOCK.md, STACK_RUNTIME.md, STACK_SOFTWARE.md, design-guidelines.md → `project-docs/archive/`

**Commit:** `chore(docs): reorganizar project-docs + melhorias de processo`

---

## M3 — Administradores + Equipa (2026-02-27)

**Artefactos criados:**
- `migrations/0004_team.sql` (coluna `module_permissions` em users)
- `apps/api/src/db/queries/users.ts` actualizado (listUsersByTenant, listUsersByTenantWithCursor, updateUserRole, getPermissionsMatrix)
- `apps/api/src/services/team.service.ts` (softDeleteUser, deactivateCollaborator, reactivateCollaborator, validateHierarchy, listCollaborators, listMembers, listTeamInvitations, cancelTeamInvitation, updatePermissions, deleteTeamUser)
- `apps/api/src/routes/admin/team.ts` (11 endpoints)
- `apps/api/src/tests/team.test.ts` (26 testes)
- `apps/web/src/routes/(admin)/+layout.server.ts`, `+layout.svelte`
- `apps/web/src/routes/(admin)/dashboard/+page.server.ts`, `+page.svelte`
- `apps/web/src/routes/(admin)/team/+page.server.ts` (load + 7 actions), `+page.svelte`
- i18n: ~60 chaves adicionadas

**Gates:** G01 ✅ G02 ✅ G04 ✅ 171/171 GS01 ✅ GS05 ✅ GS09 ✅ G03 ✅ 11.22s

**Deploy:** Version `62ee2bc3`

**Commit:** `feat(M3): administradores + equipa`

---

## M4 — Colaboradores + Permissões de módulos (2026-02-27)

**Artefactos criados:**
- `apps/api/src/services/user.service.ts` (getUserModules, selfDeleteUser, getUserProfile, getUserModulesWithProfile)
- `apps/api/src/routes/user/index.ts` (GET /modules, GET /profile, DELETE /me)
- `apps/api/src/tests/user.test.ts` (15 testes)
- `apps/web/src/routes/(admin)/dashboard/` actualizado (view por role)
- `apps/web/src/routes/(admin)/modules/[id]/+page.svelte`, `+page.server.ts`
- i18n: chaves M4 adicionadas (modules_title, modules_empty, self_delete_*, etc.)

**Gates:** G01 ✅ G02 ✅ G04 ✅ 186/186 GS01 ✅ G03 ✅ 11.93s

**Deploy:** Version `052b56c0`

**Commit:** `feat(M4): colaboradores + permissões módulos`

---

## M5 — Perfis + Armazenamento (2026-02-27)

**Artefactos criados:**
- `migrations/0005_profiles.sql` (first_name, last_name, email_pending, email_token, email_token_expires_at + índices)
- `apps/api/src/lib/storage.ts` (validateWebP, validateFileSize, validateImageDimensions, uploadFile, deleteFile, avatarKey, logoKey)
- `apps/api/src/services/profile.service.ts` (getProfile, patchProfile, uploadAvatar, deleteAvatar, requestEmailChange, confirmEmailChangeToken, changePassword, exportRgpd, getCompanyProfile, patchCompanyProfile, uploadCompanyLogo, deleteCompanyLogo)
- `apps/api/src/db/queries/users.ts` actualizado (updateUserProfile, updateUserAvatar, setEmailPending, confirmEmailChange, getUserByEmailToken, clearEmailPending, isEmailTaken)
- `apps/api/src/db/queries/tenants.ts` actualizado (updateTenantProfile, updateTenantLogo)
- `apps/api/src/routes/user/index.ts` expandido (7 endpoints M5)
- `apps/api/src/routes/admin/company.ts` (4 endpoints)
- `apps/api/src/tests/profile.test.ts` (22 testes)
- `apps/web/src/routes/(admin)/profile/+page.server.ts`, `+page.svelte`

**Gates:** G01 ✅ G02 ✅ G04 ✅ 208/208 GS01 ✅ G03 ✅ 13.99s

**Deploy:** Version `4ab24d8d` | Migration 0005: local ✅ remoto ✅

**Commit:** `feat(M5): perfis + armazenamento`

---

## M6 — Notificações (2026-02-27)

**Artefactos criados:**
- `migrations/0007_notifications.sql` (tabela notifications + índices)
- `apps/api/src/services/notification.service.ts` (createNotification, notifyAdmins, notifyOwners)
- `apps/api/src/db/queries/notifications.ts`
- `apps/api/src/routes/user/notifications.ts` (4 endpoints)
- `apps/web/src/lib/components/NotificationBell.svelte`
- `apps/web/src/routes/(admin)/notifications/+page.svelte`, `+page.server.ts`
- Integração nos fluxos: invitation accept, tenant activate, elevation grant/revoke

**Gates:** G02 ✅ G04 ✅ 208/208 GS01 ✅ G03 ✅ 13.58s

**Deploy:** Version `1a406c42` | Migration 0007: local ✅ remoto ✅

**Commit:** `feat(M6): notificações`

---

## M7 — Integrações externas (2026-02-27)

**Artefactos criados:**
- `migrations/0008_integrations.sql` (tabela integrations + índices + trigger updated_at)
- `apps/api/src/lib/encryption.ts` (AES-256-GCM encrypt/decrypt)
- `apps/api/src/lib/circuit-breaker.ts` (withCircuitBreaker: timeout 5s, 3 retries, backoff exponencial)
- `apps/api/src/lib/integrations/adapter.interface.ts` (EmailAdapter, SmsAdapter, LlmAdapter)
- `apps/api/src/lib/integrations/email/resend.ts` (ResendEmailAdapter — fetch directo)
- `apps/api/src/lib/integrations/email/templates/index.ts` (inviteOwner, inviteMember, passwordReset — HTML + texto)
- `apps/api/src/db/queries/integrations.ts` (9 funções CRUD)
- `apps/api/src/services/integration.service.ts` (getAllIntegrations, createIntegration, updateCredentials, testIntegration, activate/deactivate/remove, getActiveEmailAdapter, sendEmail)
- `apps/api/src/routes/super/integrations.ts` (7 endpoints)
- `apps/web/src/routes/(super)/super/integrations/+page.server.ts`, `+page.svelte`
- Link "⚡ Integrações" adicionado ao sidebar do layout super

**Gates:** G01 ✅ G02 ✅ G04 ✅ 208/208 GS01 ✅ G03 ✅ 14.63s

**Deploy:** Version `43fa99f5` → `51c82b5f` (docs fix) | Migration 0008: local ✅ remoto ✅

**Commit:** `feat(M7): integrações externas` (`ce28811`) + `docs(M6/M7): docs fix` (`e97bbbd`)

---

## M8 — Backups (2026-02-28)

**Artefactos criados:**
- `migrations/0009_backups.sql` (tabelas: backups, backup_auto_config)
- `apps/api/src/db/queries/backups.ts` (insertBackup, listBackupsByTenant, listAllBackups, getBackupById, updateBackupRunning, updateBackupDone, updateBackupFailed, deleteOldBackups, upsertAutoConfig, getAutoConfig, listAllAutoConfigs, getLastDoneBackupByTenant, deleteBackup)
- `apps/api/src/services/backup.service.ts` (generateBackup, listBackups, removeBackup, streamBackupFromR2, getAutoBackupConfig, setAutoBackupConfig, scheduleAutoBackup, importBackup)
- `apps/api/src/routes/admin/backups.ts` (GET/POST /api/admin/backups, GET /api/admin/backups/:id/download, DELETE /api/admin/backups/:id, GET/PATCH /api/admin/backups/config)
- `apps/api/src/routes/super/backups.ts` (GET /api/super/backups, POST /api/super/backups/import)
- `apps/web/src/routes/(admin)/backups/+page.server.ts` + `+page.svelte`
- `apps/web/src/routes/(super)/super/backups/+page.server.ts` + `+page.svelte`
- Sidebar admin + super: link /backups e /super/backups adicionados
- Scheduled handler em `apps/api/src/index.ts` (cron `0 0 * * *` → scheduleAutoBackup)
- Nota: Queue comentada (plano Workers PAGO necessário); backup síncrono implementado

**Gates:** G01 ✅  G02 ✅  G04 ✅ 220/220  GS01 ✅

**Deploy:** Version `a95f01f7-f7f8-4760-b98f-39ff49ef031d` | Migration 0009: local ✅ remoto ✅

**Commit:** `feat(M8): backups — migration, service, routes, UI`

---

## M9 — Histórico de actividade + Audit log + RGPD (2026-02-28)

**Artefactos criados:**
- `migrations/0010_logs.sql` (tabelas: activity_log, audit_log, break_glass_log)
- `apps/api/src/db/queries/activity-log.ts` (insertActivityLog, listActivityLogs, deleteActivityLogByTenant, exportActivityLogByTenant)
- `apps/api/src/db/queries/audit-log.ts` (insertAuditLog, listAuditLogs, deleteExpiredAuditLogs, insertBreakGlassLog, getLastBreakGlassDownload)
- `apps/api/src/services/activity-log.service.ts` (logAction, listActivity, cleanHistory, exportHistory)
- `apps/api/src/services/audit-log.service.ts` (logAuditEvent, listAudit, cleanExpiredAuditLogs, generateBreakGlass)
- `apps/api/src/services/rgpd.service.ts` (exportUserData — dados núcleo + actividade + stub módulos)
- `apps/api/src/routes/admin/activity.ts` (GET/DELETE /api/admin/activity, GET /api/admin/activity/export)
- `apps/api/src/routes/super/audit.ts` (GET /api/super/audit, GET /api/super/break-glass)
- `apps/web/src/routes/(admin)/activity/` (+page.server.ts + +page.svelte)
- `apps/web/src/routes/(super)/super/audit/` (+page.server.ts + +page.svelte)
- Sidebar admin: link /activity adicionado; Sidebar super: link /super/audit adicionado
- `apps/api/src/tests/activity.test.ts` — 18 novos testes
- `notification.service.ts` — BREAK_GLASS_DOWNLOADED adicionado ao NOTIFICATION_TYPES

**Gates:** G01 ✅  G02 ✅  G04 ✅ 238/238  GS01 ✅  Zero PII ✅

**Deploy:** Version `7e917653-0877-4957-b5a9-f5ea31ada30c` | Migration 0010: local ✅ remoto ✅

**Commit:** `feat(M9): histórico actividade, audit log, RGPD, break-glass`

---

---

## M10 — Sistema de Módulos (2026-02-28)

**Artefactos criados:**
- `apps/api/src/modules.config.ts` — array MODULES com 5 módulos (core, notifications, backups, activity, integrations)
- `apps/api/src/lib/module-registry.ts` — getRegisteredModules, getModuleById, initTenantModuleLimits, getTenantModuleLimits, callOnUserDelete, callOnTenantDelete, callOnCronMaintenance, callOnRgpdExport
- `apps/api/src/tests/modules.test.ts` — 24 novos testes
- `apps/api/src/services/user.service.ts` — getUserModules usa registry real; super_user retorna []
- `apps/api/src/services/tenant.service.ts` — initTenantModuleLimits chamado ao criar empresa
- `apps/api/src/routes/user/index.ts` — GET /api/user/nav (navegação dinâmica por role)
- `apps/web/src/lib/components/Navigation.svelte` — componente de nav dinâmica com indicação de integrações em falta

**Gates:** G01 ✅ G02 ✅ G04 ✅ 262/262 GS01 ✅ 22.27s

**Deploy:** Version `928664af` | sem migration

**Commit:** `feat(M10): sistema de módulos — registry, nav dinâmica, limites`

---

## M11 — Tema Visual (2026-02-28)

**Artefactos criados:**
- `apps/web/src/styles/tokens.css` — §12 tokens de layout (--shell-columns, --sidebar-display, --topnav-display, --compact-sidebar-display, --nav-item-*)
- `apps/web/src/lib/stores/theme.svelte.ts` — store $state com layout/palette/theme; cookies cf_layout/cf_palette/cf_theme; applyToBody sem re-render
- `apps/web/src/lib/components/Sidebar.svelte` — sidebar 224px com nav, brand zone, footer
- `apps/web/src/lib/components/CompactSidebar.svelte` — sidebar icon-only 60px com tooltips
- `apps/web/src/lib/components/Header.svelte` — barra topo 56px partilhada
- `apps/web/src/lib/components/ThemeSwitcher.svelte` — selector paleta/tema/layout com dropdown
- `apps/web/src/routes/(admin)/+layout.svelte` — integra Sidebar+CompactSidebar+Header+ThemeSwitcher+mobile drawer
- `apps/web/src/routes/(super)/+layout.svelte` — idem para super
- `apps/web/src/hooks.server.ts` — transformPageChunk: injecta data-layout/data-theme/palette-* no body via cookie SSR

**Gates:** G01 ✅ G02 ✅ GS01 ✅ 23.39s GS03 ✅

**Deploy:** Version `ab2fe545` | sem migration

**Commit:** `feat(M11): tema visual — sidebar, compact, topnav, paletas, dark mode`

---

## M12 — Internacionalização completa (2026-02-28)

**Artefactos criados/modificados:**
- `messages/pt.json` + `messages/en.json` — 395 chaves (paridade total pt/en); +24 chaves novas (backup_date_col, backup_type_col, backup_download_btn, super_audit_date_col, super_audit_actor_col, audit_load_more, audit_records, activity_clean_confirm_*, team_owner_temp_badge, activity_load_more, team_active_modules, col_actions, ...)
- `apps/web/src/routes/(admin)/backups/+page.svelte` — substituição de todas as strings hard-coded por chaves m.*()
- `apps/web/src/routes/(super)/super/audit/+page.svelte` — idem (Actor ID, Data, Carregar mais, reg.)
- `apps/web/src/routes/(admin)/activity/+page.svelte` — idem (modal clean confirm, empty state, load more)
- `apps/web/src/routes/(admin)/team/+page.svelte` — idem (Owner Temp., Módulos activos, badge-temp)
- `apps/api/src/lib/integrations/email/templates/index.ts` — refactored: aceita `lang?: "pt"|"en"`, helper `localizeExpiry()`, strings completas em ambas as línguas
- `apps/web/scripts/check-i18n-parity.mjs` — **novo**: script G03 que aborta build se faltar chave em en.json vs pt.json (exit code 1)
- `apps/web/package.json` — `prebuild` integra `check-i18n-parity.mjs` antes de `paraglide-js compile`

**Gates:** G01 ✅ G02 ✅ G03 ✅ 395 chaves G04 ✅ 270/270 GS01 ✅ GS04 ✅

**Deploy:** Version `112974a` (pendente prod) | sem migration

**Commit:** `M12: Full i18n — zero hardcoded text, 395 keys pt+en, email templates i18n, G03 build guard`

---

## M13 — Observabilidade, Health Probes, Graceful Shutdown (2026-02-28)

**Artefactos criados/modificados:**
- `apps/api/src/middleware/observability.ts` — **novo**: `traceMiddleware` (X-Trace-Id), `requestLogger` (JSON estruturado com trace_id + duration_ms), `makeErrorHandler` (redige PII, suporte Sentry via SENTRY_DSN), `withGracefulShutdown` (ctx.waitUntil wrap)
- `apps/api/src/tests/observability.test.ts` — **novo**: 8 testes (trace header, request log, error handler, graceful shutdown)
- `apps/api/src/index.ts` — integração de `traceMiddleware` + `requestLogger` + `makeErrorHandler` como middleware global
- `apps/api/src/routes/admin/team.ts` — PII removido dos logs (email → sem PII em invitation_created)
- `worker-configuration.d.ts` — `SENTRY_DSN?: string` (já presente, confirmado)
- `apps/api/src/routes/health.ts` — já implementado: `/api/health/live` (200+ts) e `/api/health/ready` (SELECT 1 → D1)

**Gates:** G01 ✅ G02 ✅ G03 ✅ G04 ✅ 277/277 GS08 ✅ GS09 ✅ Zero PII ✅

**Deploy:** Version `8f68c13` (pendente prod) | sem migration

**Commit:** `M13: Observability — trace_id middleware, request logger, error handler, graceful shutdown`

---

## M14 — Segurança final e hardening (2026-02-28)

**Artefactos criados/modificados:**
- `apps/api/src/middleware/security-headers.ts` — **novo**: middleware que injeta CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy em todas as respostas
- `apps/api/src/tests/security-headers.test.ts` — **novo**: 7 testes (presença de cada header, valores corretos)
- `apps/api/src/index.ts` — integração de `securityHeadersMiddleware` como middleware global
- `apps/web/src/routes/(admin)/backups/+page.svelte` — fix `use:enhance` callback (SvelteKit 2 API: SubmitFunction)
- BUILD_PLAN.md — checkpoints M12/M13/M14 marcados ✅ DONE
- IDOR: todos os handlers admin filtram por `tenant_id` da sessão; queries sempre com `AND tenant_id = ?`

**Gates:** G01 ✅ G02 ✅ G03 ✅ 23.977s G04 ✅ 277/277 G14 ✅ G20 ✅ GS01 ✅ GS08 ✅ GS09 ✅

**Deploy:** Version `a6f0bfc` (pendente prod) | sem migration
**Commit:** `M14: Security hardening` + `GS01: Fix svelte-check 0 errors/warnings`


---

## M15 — QA Final + Testes E2E (2026-02-28)

**Artefactos criados/modificados:**
- `apps/web/e2e/f1-f4.spec.ts` — Testes E2E F1-F4: setup, login, convites member/collaborator
- `apps/web/e2e/f5-f8.spec.ts` — Testes E2E F5-F8: cancel convite, elevação temporária, transfer-ownership, deactivate/activate
- `apps/web/e2e/f9-f15.spec.ts` — Testes E2E F9-F15: hard delete, password reset, change email, RGPD, backup, activity clean, resource limits
- `apps/web/e2e/helpers.ts` — Utilitários: loadSession() com renovação automática de sessão expirada; rate-limit safe (storageState)
- `apps/web/e2e/global-setup.ts` — Setup global: login uma vez e guarda sessões em .auth/super.json e .auth/admin.json
- `apps/web/e2e/.auth/super.json` — Sessão super_user (expires ~2026-03-29)
- `apps/web/e2e/.auth/admin.json` — Sessão admin/tenant_admin (expires ~2026-03-29)
- `apps/web/playwright.config.ts` — Timeout 40s, retries=1, workers=1 (sequencial), trace on-first-retry; json reporter

**Fixes durante M15:**
- Descoberto: `GET /api/super/tenants` retorna `{ data: [...] }` (não `{ tenants: [...] }`)
- Descoberto: `POST /api/admin/team/invitations` retorna `{ invitation: {...}, token }` (não `{ id, token }`)
- Descoberto: `GET /api/admin/team/invitations` retorna `{ rows: [...], nextCursor }` (não `{ invitations: [...] }`)
- Descoberto: `PATCH /api/super/tenants/:id/limits` (não `/api/super/tenants/:id`)
- Descoberto: DELETE convite → status=cancelled (não remoção física)
- Rate limiter DO: 5 tentativas/min/IP — resolvido com storageState (1 login por sessão)
- Cloudflare error 1102 de curl/sandbox: esperado (rate limit por IP sandbox); Playwright contorna via browser context

**Resultado final:** 15/15 E2E passam em 15.8s (0 falhas, 0 flaky após correcções)

**Gates:** G01 ✅ G02 ✅ G03 ✅ G04 ✅ 277/277 unitários ✅ **G15 ✅ 15/15 E2E**

**Deploy:** Version `a6f0bfc` → pendente novo deploy com ficheiros E2E

**Commit:** `M15: QA Final — 15/15 E2E Playwright pass`
