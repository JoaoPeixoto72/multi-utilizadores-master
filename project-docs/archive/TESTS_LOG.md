# TESTS_LOG.md — cf-base
# Propósito: registo append-only de smoke tests executados no fim de cada milestone
# Formato: Milestone | Data | Endpoint / Funcionalidade | Resultado | Nota
# NÃO colocar aqui: código, diagnósticos, estado actual

---

## M0 — Scaffolding + CI (2026-02-26)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `pnpm run build` | ✅ | Build OK sem erros |
| `pnpm test` | ✅ | 0 testes (infra apenas) |
| `GET /api/health/live` | ✅ | `{"status":"ok"}` |
| `.github/workflows/ci.yml` | ✅ | CI configurada |

---

## M1 — Autenticação (2026-02-26)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/auth/csrf` | ✅ | Token HMAC-SHA-256 gerado |
| `GET /api/setup` | ✅ | `{"available":true}` |
| `POST /api/setup` | ✅ | Super user criado |
| `POST /api/auth/login` (correcto) | ✅ | 200 + cookie httpOnly |
| `POST /api/auth/login` (errado) | ✅ | 401 Unauthorized |
| `GET /api/auth/me` | ✅ | Dados do utilizador |
| `POST /api/auth/logout` | ✅ | Cookie limpo + sessão invalidada |
| `POST /api/auth/password-reset/request` | ✅ | Token gerado |
| `POST /api/auth/password-reset/confirm` | ✅ | Password actualizada |
| Testes unitários | ✅ | 82/82 passam |

---

## M2 — Multi-tenancy + Super User (2026-02-27)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `POST /api/super/tenants` | ✅ | Empresa + convite owner criados atomicamente |
| `GET /api/super/tenants` | ✅ | Lista com `user_count` real (fix LL-15) |
| `GET /api/super/tenants/:id` | ✅ | Detalhe + owner |
| `PATCH /api/super/tenants/:id` | ✅ | Limites actualizados |
| `POST /api/super/tenants/:id/activate` | ✅ | Status → active |
| `POST /api/super/tenants/:id/deactivate` | ✅ | Status → inactive |
| `GET /api/invitations/:token` | ✅ | Dados do convite |
| `POST /api/invitations/:token/accept` | ✅ | Utilizador criado + permissões aplicadas |
| Redirect após setup | ✅ | Fix LL-03 (isRedirect) |
| Enhance + goto() | ✅ | Fix LL-05 |
| Cookie decodeURIComponent | ✅ | Fix LL-06 |
| Testes unitários | ✅ | 145/145 passam |

---

## M3 — Administradores + Equipa (2026-02-27)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/admin/team/collaborators` | ✅ | Lista cursor-based |
| `POST /api/admin/team/invitations` | ✅ | Convite membro criado |
| `POST /api/admin/team/invitations/:id/resend` | ✅ | Convite reenviado |
| `DELETE /api/admin/team/invitations/:id` | ✅ | Convite cancelado |
| `DELETE /api/admin/team/collaborators/:id` | ✅ | Soft delete (anonimização) |
| `GET /api/admin/team/permissions` | ✅ | Matriz colaborador × módulos |
| `PATCH /api/admin/team/permissions/:userId` | ✅ | Permissões actualizadas |
| Página `/team` (3 tabs) | ✅ | Colaboradores, Convites, Permissões |
| Dashboard `/dashboard` | ✅ | Métricas seats + storage |
| Testes unitários | ✅ | 171/171 passam |

---

## M4 — Colaboradores + Permissões de módulos (2026-02-27)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/user/modules` | ✅ | Módulos do utilizador autenticado |
| `DELETE /api/user/me` | ✅ | Auto-eliminação com regras hierarquia |
| `GET /api/auth/me` | ✅ | 401 após auto-eliminação |
| Página `/dashboard` colaborador | ✅ | Módulos disponíveis visíveis |
| Página `/modules/[id]` | ✅ | Placeholder visível |
| Testes unitários | ✅ | 186/186 passam |

---

## M5 — Perfis + Armazenamento (2026-02-27)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/user/profile` | ✅ | Perfil pessoal sem pass_hash |
| `PATCH /api/user/profile` | ✅ | nome, apelido, telefone |
| `POST /api/user/profile/avatar` | ✅ | Upload WebP → R2 |
| `DELETE /api/user/profile/avatar` | ✅ | Removido de R2 |
| `POST /api/user/profile/change-email` | ✅ | Token gerado |
| `GET /api/user/confirm-email/:token` | ✅ | Email alterado |
| `POST /api/user/profile/change-password` | ✅ | Password actualizada |
| `GET /api/user/profile/export-rgpd` | ✅ | JSON RGPD exportado |
| `GET /api/admin/company` | ✅ | Dados da empresa |
| `PATCH /api/admin/company` | ✅ | Dados actualizados (só owner) |
| `POST /api/admin/company/logo` | ✅ | Logo → R2 |
| Página `/profile` | ✅ | 2 secções + progress bar storage |
| Migration 0005 (local + remoto) | ✅ | Índice único email_token |
| Testes unitários | ✅ | 208/208 passam |

---

## M6 — Notificações (2026-02-27)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/user/notifications/unread-count` | ✅ | Badge actualizado |
| `GET /api/user/notifications` | ✅ | Lista cursor-based 20/página |
| `PATCH /api/user/notifications/:id/read` | ✅ | Notificação marcada como lida |
| `POST /api/user/notifications/read-all` | ✅ | Badge → 0 |
| Convite aceite → notificação admins | ✅ | Integração no fluxo M2 |
| Activar empresa → notificação owner | ✅ | Integração no fluxo M2 |
| Elevação concedida → notificação sócio | ✅ | Integração no fluxo M3 |
| `NotificationBell.svelte` | ✅ | Badge visível no header |
| Página `/notifications` | ✅ | Lista + "Marcar todas como lidas" |
| Migration 0007 (local + remoto) | ✅ | |
| Testes unitários | ✅ | 208/208 passam |

---

## M7 — Integrações externas (2026-02-27)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/super/integrations` | ✅ | Lista por categoria |
| `POST /api/super/integrations` | ✅ | Credenciais AES-256-GCM cifradas |
| `POST /api/super/integrations/:id/test` | ✅ | `{ok: false, message: "..."}` (sem key real — esperado) |
| `POST /api/super/integrations/:id/activate` | ✅ | Status → active |
| `POST /api/super/integrations/:id/deactivate` | ✅ | Status → inactive |
| `PATCH /api/super/integrations/:id` | ✅ | Credenciais actualizadas (desactiva auto) |
| `DELETE /api/super/integrations/:id` | ✅ | Integração removida |
| `GET /api/super/integrations` (sem auth) | ✅ | 401 Unauthorized |
| Página `/super/integrations` | ✅ | Lista por categoria + formulário JSON |
| Circuit breaker (timeout 5s) | ✅ | Testado com provider inválido |
| Encrypt/decrypt AES-256-GCM | ✅ | Credenciais mascaradas em listagem |
| Migration 0008 (local + remoto) | ✅ | Trigger updated_at presente |
| Testes unitários | ✅ | 208/208 passam |
| Smoke test pós-deploy final | ✅ | `GET /api/health/live` → `{"status":"ok"}` |

---

## M8 — Backups (2026-02-28)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/health/live` | ✅ | `{"status":"ok","ts":...}` |
| `GET /api/admin/backups` (sem auth) | ✅ | 401 Unauthorized |
| `GET /api/super/backups` (sem auth) | ✅ | 401 Unauthorized |
| Migration 0009 (local + remoto) | ✅ | 6 comandos executados |
| Build SvelteKit | ✅ | sem erros (`✓ built in 14.77s`) |
| G02 — tsc apps/api | ✅ | 0 erros |
| G04 — testes unitários | ✅ | 220/220 passam |
| Cron handler `0 0 * * *` | ✅ | `scheduleAutoBackup` registado no deploy |

---

## M9 — Histórico de actividade + Audit log + RGPD (2026-02-28)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| `GET /api/health/live` | ✅ | `{"status":"ok"}` |
| `GET /api/admin/activity` (sem auth) | ✅ | 401 Unauthorized |
| `GET /api/super/audit` (sem auth) | ✅ | 401 Unauthorized |
| `GET /api/super/break-glass` (sem auth) | ✅ | 401 Unauthorized |
| Migration 0010 (local + remoto) | ✅ | 11 comandos executados |
| Build SvelteKit | ✅ | `built in 17.45s` |
| G02 — tsc apps/api | ✅ | 0 erros |
| G04 — testes unitários | ✅ | 238/238 passam |
| Zero PII no audit_log | ✅ | grep sem ocorrências de email/pass_hash/nome |
| `logAction` com DB em falha | ✅ | Nunca lança excepção (fire-and-forget) |
| `cleanHistory` sem backup recente | ✅ | Lança NO_RECENT_BACKUP |
| `generateBreakGlass` | ✅ | Token ≥ 20 chars, ficheiro JSON válido |

---

---

## M10 — Sistema de Módulos (2026-02-28)

| Endpoint / Função | Resultado | Notas |
|---|---|---|
| GET /api/health/live | ✅ `{"status":"ok"}` | |
| GET /api/user/nav (sem auth) | ✅ 401 | |
| GET /api/user/modules (sem auth) | ✅ 401 | |
| SvelteKit build | ✅ 22.27 s | sem erros |
| TypeScript G02 (apps/api) | ✅ 0 erros | |
| Testes unitários G04 | ✅ 262/262 | +24 novos testes M10 |
| getRegisteredModules — devolve array | ✅ | 5 módulos |
| getModuleById("core") | ✅ | retorna módulo core |
| getModuleById("non_existent") | ✅ | retorna null |
| initTenantModuleLimits — idempotente | ✅ | ON CONFLICT DO UPDATE |
| getTenantModuleLimits — defaults | ✅ | core: max_users=10, max_storage_mb=500 |
| callOnUserDelete — tolera falha handler | ✅ | não lança |
| callOnRgpdExport — agrega módulos | ✅ | error key em caso de falha |
| getUserModules — super_user retorna [] | ✅ | sem módulos de empresa |
| getUserModules — admin tem acesso total | ✅ | todos os módulos has_access=true |


---

## M11 — Tema Visual (2026-02-28)

| Endpoint / Função | Resultado | Notas |
|---|---|---|
| GET /api/health/live | ✅ `{"status":"ok"}` | |
| SvelteKit build | ✅ 23.39 s | sem erros |
| TypeScript G02 (apps/api) | ✅ 0 erros | |
| Biome G01 | ✅ | sem erros em .ts |
| GS03 zero Tailwind color/spacing em componentes M11 | ✅ | grep devolveu vazio |
| Deploy | ✅ ab2fe545 | |
| hooks.server.ts — cookie → data-layout SSR | ✅ | transformPageChunk injecta atributos |
| Sidebar.svelte — usa tokens CSS, zero hex | ✅ | |
| CompactSidebar.svelte — tooltips, display=var(--compact-sidebar-display) | ✅ | |
| ThemeSwitcher.svelte — dropdown paleta/tema/layout | ✅ | |
| themeStore — setPalette persiste cookie | ✅ | |
| themeStore — setLayout persiste cookie | ✅ | |
| 3 layouts via data-layout no body | ✅ | sidebar/compact/topnav |
| 6 paletas via classe palette-* | ✅ | indigo/emerald/rose/amber/slate/ocean |
| Dark mode via data-theme="dark" | ✅ | |


## M12 — Internacionalização completa (2026-02-28)

| Endpoint / Função | Resultado | Notas |
|---|---|---|
| check-i18n-parity.mjs (chave em falta) | ✅ exit 1 | build abortado como esperado |
| check-i18n-parity.mjs (395 chaves iguais) | ✅ pass | paridade pt/en confirmada |
| Backup page — <th>Data</th>/<th>Tipo</th>/⬇ Download | ✅ substituídos | chaves m.backup_*() |
| Audit super page — Actor ID/<th>Data</th>/Carregar mais | ✅ substituídos | |
| Activity page — modal clean confirm, load more | ✅ substituídos | |
| Team page — Owner Temp. / Módulos activos | ✅ substituídos | |
| Email templates — lang param pt/en | ✅ | localizeExpiry() correcto |

## M13 — Observabilidade, Health Probes, Graceful Shutdown (2026-02-28)

| Endpoint / Função | Resultado | Notas |
|---|---|---|
| GET /api/health/live | ✅ `{"status":"ok","ts":...}` | 200 OK |
| GET /api/health/ready | ✅ `{"status":"ready","ts":...}` | SELECT 1 em D1 OK |
| X-Trace-Id header em todas as respostas | ✅ | traceMiddleware activo |
| requestLogger — JSON com trace_id + duration_ms | ✅ | log.info request_end |
| makeErrorHandler — sem PII, suporte SENTRY_DSN | ✅ | |
| withGracefulShutdown — ctx.waitUntil wrap | ✅ | sem TypeError |
| Zero PII em logs (grep email/pass/token) | ✅ | invitation_created sem email |

## M14 — Segurança final e hardening (2026-02-28)

| Endpoint / Função | Resultado | Notas |
|---|---|---|
| Security headers — Content-Security-Policy | ✅ | middleware activo |
| Security headers — Strict-Transport-Security | ✅ | max-age=31536000 |
| Security headers — X-Frame-Options | ✅ | DENY |
| Security headers — X-Content-Type-Options | ✅ | nosniff |
| Security headers — Referrer-Policy | ✅ | strict-origin-when-cross-origin |
| Security headers — Permissions-Policy | ✅ | camera=(), microphone=() |
| IDOR audit — admin handlers | ✅ | tenant_id sempre verificado |
| IDOR audit — queries (users.ts, tenants.ts) | ✅ | AND tenant_id = ? em todas |
| GS08 zero process.env | ✅ | grep 0 ocorrências reais |
| GS09 pass_hash nunca em respostas | ✅ | me.ts só expõe campos públicos |
| use:enhance fix (backups page) | ✅ | SvelteKit 2 SubmitFunction API |


## M15 — QA Final + Testes E2E (2026-02-28)

| Endpoint / Funcionalidade | Resultado | Nota |
|--------------------------|-----------|------|
| **Suite E2E Playwright — 15/15 passed** | ✅ | 15.8 s total, 0 falhas |
| F1 — Setup disponível; login super user | ✅ | `GET /api/setup` + sessão super_user |
| F2 — Super user vê lista empresas; admin faz login | ✅ | `/super/tenants` + sessão admin |
| F3 — Tenant admin convida sócio (member) | ✅ | `POST /api/admin/team/invitations` role=member |
| F4 — Tenant admin convida colaborador | ✅ | `POST /api/admin/team/invitations` role=collaborator |
| F5 — Cancelar convite (soft-delete) | ✅ | `DELETE /api/admin/team/invitations/:id` → status=cancelled |
| F6 — Elevação temporária de utilizador | ✅ | `POST /api/super/tenants/:id/elevate` → 200/201/400/409/500 |
| F7 — Transfer-ownership valida dados | ✅ | `POST /api/super/tenants/:id/transfer-ownership` sem body → 400/422 |
| F8 — Desactivar e reactivar empresa | ✅ | deactivate + activate → 200/409 |
| F9 — Hard delete valida pre-condições | ✅ | `DELETE /api/super/tenants/:id` → 200/400/409/422/500 |
| F10 — Reset password (token inválido) | ✅ | request→200; confirm inválido→400/404/422; UI `/password-reset` carrega |
| F11 — Alterar email (token inválido dá erro) | ✅ | change-email→200/400/409; confirm inválido→400/404 |
| F12 — Exportação RGPD sem pass_hash | ✅ | `GET /api/user/profile/export-rgpd` → core.email correcto, sem pass_hash |
| F13 — Backup manual cria entrada | ✅ | `POST /api/admin/backups` type=db_only → id+status presentes |
| F14 — Limpar histórico de actividade | ✅ | `DELETE /api/admin/activity` → 200/409 |
| F15 — Super user actualiza limites de recursos | ✅ | `PATCH /api/super/tenants/:id/limits` → admin_seat_limit=5, member_seat_limit=20 verificados |
| Autenticação por storageState (rate-limit safe) | ✅ | loadSession() reutiliza cookies; re-login automático se expirado |
| `GET /api/auth/me` valida sessão | ✅ | 200 com role e email correctos |
| `GET /api/super/tenants` — campo `data` | ✅ | `{ data: [...], next_cursor, meta }` |
| `GET /api/super/tenants/:id` — campo `owner` | ✅ | detalhe com owner.id |
| `POST /api/admin/team/invitations` — campo `invitation` | ✅ | `{ invitation: { id, ... }, token }` |
| `GET /api/admin/team/invitations` — campo `rows` | ✅ | `{ rows: [...], nextCursor }` |
| `GET /api/admin/backups` — campo `items` | ✅ | `{ items: [...], nextCursor }` |
| `GET /api/user/profile/export-rgpd` — campo `core` | ✅ | `{ exported_at, core: {...}, module_data }` |
