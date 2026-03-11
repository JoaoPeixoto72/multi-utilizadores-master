# BUILD_PLAN.md — cf-base
# Versão: 2.0
# Propósito: especificação técnica de cada milestone — schema, ficheiros a criar, endpoints
# Responde a: o que tenho de implementar exactamente neste milestone?
# NÃO colocar aqui: comandos operacionais (→ KNOWLEDGE.md), bugs (→ LESSONS_LEARNED.md)
# Actualizar: marcar ✅ DONE no checkpoint; ajustes técnicos com [delta-NN]

---

## MAPA DE MILESTONES

```
M0  ✅ DONE — Scaffolding + CI + Infraestrutura base
M1  ✅ DONE — Autenticação (Setup inicial + Login + Sessões + Reset)
M2  ✅ DONE — Multi-tenancy + Super User (empresas, convites owner)
M3  ✅ DONE — Administradores (owner fixo, sócios, convites, equipa)
M4  ✅ DONE — Colaboradores + Permissões de módulos
M5  ✅ DONE — Perfis + Armazenamento (fotos, logótipos, quotas)
M6  ✅ DONE — Notificações
M7  ✅ DONE — Integrações externas (email, SMS, LLM, storage, calendar, payments, PDF)
M8  ✅ DONE — Backups (manual + automático + importação)
M9  ✅ DONE — Histórico de actividade + Audit log + RGPD
M10       — Sistema de módulos (registo + handlers + navegação)
M11       — Tema visual (layouts, paletas, dark mode)
M12       — Internacionalização completa (paridade pt/en)
M13       — Observabilidade + Health probes + Graceful shutdown
M14       — Segurança final + SAST + Hardening
M15       — QA Final + E2E + Lighthouse + Verifier
```

---

## MIGRATIONS APLICADAS (local + remoto)
```
0001_auth.sql                  — M1 ✅
0002_auth_extended.sql         — M1 ✅
0003_core.sql                  — M2 ✅
0004_team.sql                  — M3 ✅
0005_profiles.sql              — M5 ✅
0006_tenant_pending_status.sql — M2/fix ✅
0007_notifications.sql         — M6 ✅
0008_integrations.sql          — M7 ✅
0009_backups.sql               — M8 ✅
0010_logs.sql                  — M9 ✅
```

---

## M0 — SCAFFOLDING + CI + INFRAESTRUTURA BASE ✅ DONE

**Objectivo:** Monorepo funcional, build a passar, CI configurada, design tokens presentes.

### Artefactos criados
- Scaffolding: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.json`
- `vitest.config.ts`, `wrangler.toml`, `.dev.vars.example`, `.gitignore`, `worker-configuration.d.ts`
- `.github/workflows/ci.yml`
- SvelteKit: `svelte.config.js`, `vite.config.ts`, `app.html`, `app.css`, `tokens.css`
- `hooks.server.ts`, `+layout.svelte`, `+layout.server.ts`, `+error.svelte`, `+page.svelte`
- `lib/api/client.ts`
- Hono: `src/index.ts` (AppType), `routes/health.ts`, `lib/logger.ts`, `lib/problem.ts`
- Shared: `schemas/pagination.ts`, `schemas/common.ts`, `types/roles.ts`
- Migration: `migrations/0001_auth.sql` (users + sessions)
- i18n: `messages/pt.json` + `messages/en.json` (50+ chaves)
- `project-docs/design/tokens.css` (371 variáveis, 11 secções)

### Checkpoint M0 ✅
```
G01 ✅  G02 ✅  G06 ✅  G07 ✅  G10 ✅  G12 ✅  G13 ✅
GS05 ✅  GS06 ✅  GS07 ✅  GS09 ✅
```

---

## M1 — AUTENTICAÇÃO ✅ DONE

**Objectivo:** Setup inicial, login, sessões httpOnly, reset de password, rate limiting.

### M1.1 — Schema

```sql
-- migrations/0001_auth.sql (users + sessions — criado em M0)
-- migrations/0002_auth_extended.sql
password_resets: id, user_id, token, created_at, expires_at, used_at
```

### M1.2 — Libs e middleware

**Tarefas:**
1. `apps/api/src/lib/auth.ts` — hashPassword (bcryptjs cost=12), verifyPassword, validatePasswordPolicy
2. `apps/api/src/lib/session.ts` — createSession, getSession, extractSessionToken (decodeURIComponent obrigatório — ver LL-06)
3. `apps/api/src/lib/csrf.ts` — generateToken, validateToken (HMAC-SHA-256, TTL 1h)
4. `apps/api/src/lib/token.ts` — generateSecureToken, hashToken, verifyToken (para password-reset)
5. `apps/api/src/lib/rate-limiter-do.ts` — Durable Object rate limiter (10 req/min login)
6. `apps/api/src/middleware/auth.ts` — requireAuth, requireSuperUser, requireTenantAdmin
7. `apps/api/src/middleware/csrf.ts` — verifyCsrf (POST/PUT/PATCH/DELETE em /api/*)
8. `apps/api/src/middleware/rate-limit.ts` — rateLimitMiddleware via DO

### M1.3 — Rotas API

**Tarefas:**
1. `GET /api/auth/csrf` — devolver CSRF token
2. `GET /api/setup` — `{ available: true }` se zero utilizadores
3. `POST /api/setup` — criar super_user (one-time, bloqueado após 1º utilizador)
4. `POST /api/auth/login` — login (bcryptjs compare, timing-safe, rate limit)
5. `POST /api/auth/logout` — limpar cookie + invalidar sessão D1
6. `GET /api/auth/me` — dados do utilizador autenticado
7. `POST /api/auth/password-reset/request` — criar token + link (adaptador email)
8. `POST /api/auth/password-reset/confirm` — verificar token + actualizar pass_hash

### M1.4 — Páginas UI

**Tarefas:**
1. `/login` — formulário + checklist password + link forgot
2. `/setup` — formulário setup inicial (bloquear se já feito — ver LL-03)
3. `/password-reset` — pedir reset
4. `/password-reset/[token]` — confirmar nova password
5. `lib/components/auth/PasswordChecklist.svelte` — checklist visual de requisitos

**Regras críticas:**
- `redirect()` em SvelteKit lança excepção — ver LL-03
- `enhance` com callback — ver LL-05

### Checkpoint M1 ✅
```
G01 ✅  G02 ✅  G04 ✅ 82/82  G05 ✅ 81.4%  GS01 ✅  GS04 ✅  GS05 ✅  GS06 ✅  GS07 ✅  GS08 ✅  GS09 ✅
Deploy: a84f83a1
```

---

## M2 — MULTI-TENANCY E SUPER USER ✅ DONE

**Objectivo:** Gestão completa de empresas e super user. Convites de owner. Limites e quotas.

### M2.1 — Schema

```sql
-- migrations/0003_core.sql
tenants: id, name, address, email, phone, website, logo_key,
         admin_seat_limit, member_seat_limit, storage_limit_bytes,
         daily_email_limit, allowed_languages, status,
         created_at, updated_at, deleted_at
         -- status: active | pending | inactive | deleted (DEFAULT 'pending' — ver LL-14)

-- Extensão de users (ALTER TABLE ADD COLUMN):
tenant_id, role, is_owner, display_name, phone, website, avatar_key,
preferred_language, status, is_temp_owner, temp_owner_expires_at

invitations: id, tenant_id, email, role, invited_by, token,
             module_permissions (JSON), language, status,
             created_at, expires_at, accepted_at, cancelled_at

tenant_module_limits: id, tenant_id, module_id, limit_key, limit_value, created_at, updated_at
tenant_storage_usage: tenant_id PK, bytes_used, updated_at
tenant_daily_email_count: tenant_id, date, count, updated_at
app_config: key PK, value, updated_at

-- migrations/0006_tenant_pending_status.sql (fix: DEFAULT 'pending' — ver LL-14, LL-16)
```

### M2.2 — Queries

**Ficheiros a criar:**
- `apps/api/src/db/queries/tenants.ts` — CRUD tenants, limites, status, listagem com user_count (ver LL-15)
- `apps/api/src/db/queries/invitations.ts` — criar, aceitar, cancelar, expirar, histórico
- `apps/api/src/db/queries/app-config.ts` — ler/escrever configuração global
- `apps/api/src/db/queries/storage.ts` — incrementar/decrementar/verificar quota
- `apps/api/src/db/queries/email-counters.ts` — verificar/incrementar contador diário

### M2.3 — Serviços

**Ficheiros a criar:**
- `apps/api/src/services/tenant.service.ts`:
  - `createTenant()` — cria empresa + convite owner atomicamente; rollback completo se email falhar
- `apps/api/src/services/invitation.service.ts`:
  - `createOwnerInvitation()`, `createAdminInvitation()`, `createCollaboratorInvitation()`
  - `acceptInvitation()` — cria utilizador, aplica permissões, não faz login automático
  - `resendInvitation()` — cancela anterior, novo token
  - `cancelInvitation()`
- `apps/api/src/services/quota.service.ts`:
  - `checkAndDebitStorage(tenantId, bytes)`, `checkDailyEmailLimit(tenantId)`, `releaseStorage()`

### M2.4 — Rotas API — Super User

**Tarefas:**
1. `GET /api/super/tenants` — listar empresas (cursor-based, com user_count real — ver LL-15)
2. `POST /api/super/tenants` — criar empresa + convite owner
3. `GET /api/super/tenants/:id` — detalhe (dados + owner + árvore)
4. `PATCH /api/super/tenants/:id` — editar limites
5. `POST /api/super/tenants/:id/activate` — reactivar empresa
6. `POST /api/super/tenants/:id/deactivate` — desactivar (invalida sessões, cancela convites)
7. `DELETE /api/super/tenants/:id` — hard delete (verifica backup recente, chama onTenantDelete)
8. `POST /api/super/tenants/:id/transfer-ownership` — transferência atómica
9. `POST /api/super/tenants/:id/elevate` — elevar sócio a owner temporário
10. `DELETE /api/super/tenants/:id/elevate` — revogar elevação
11. `GET /api/super/settings` — ler configuração global
12. `PATCH /api/super/settings` — editar configuração global

### M2.5 — Aceitação de convite

**Tarefas:**
1. `GET /api/invitations/:token` — validar token + devolver dados
2. `POST /api/invitations/:token/accept` — aceitar (cria utilizador, aplica permissões, rollback completo)
3. Página `/invite/[token]` — formulário + checklist password

### M2.6 — Páginas UI — Super User

**Tarefas:**
1. `/super/dashboard` — contadores: empresas activas/inactivas
2. `/super/tenants` — tabela cursor-based
3. `/super/tenants/new` — formulário (dados owner + empresa + limites)
4. `/super/tenants/[id]` — read-only + limites editáveis + acções
5. `/super/settings` — configurações globais

### Checkpoint M2 ✅
```
G01 ✅  G02 ✅  G03 ✅  G04 ✅ 145/145  G05 ✅ 75.9%  GS01 ✅
Deploy: cbbb5ca8 → a84f83a1 (hotfixes M2 — ver LL-03, LL-05, LL-06)
Bugs: LL-03, LL-05, LL-06, LL-14, LL-15, LL-16
```

---

## M3 — ADMINISTRADORES (OWNER FIXO, SÓCIOS, EQUIPA) ✅ DONE

**Objectivo:** Gestão completa de equipa. Convites. Roles e hierarquia.

### M3.1 — Schema

```sql
-- migrations/0004_team.sql
ALTER TABLE users ADD COLUMN module_permissions TEXT DEFAULT '{}';
```

### M3.2 — Queries

**Ficheiros a actualizar/criar:**
- `apps/api/src/db/queries/users.ts` — `listUsersByTenant`, `listUsersByTenantWithCursor`, `updateUserRole`, `getPermissionsMatrix`

### M3.3 — Serviço de equipa

**Ficheiro a criar:** `apps/api/src/services/team.service.ts`
- `softDeleteUser(actorId, targetId, tenantId)` — anonimiza (nome→"Removed User", email→`deleted_{id}@removed.invalid`), apaga avatar R2, chama onUserDelete, liberta slot
- `deactivateCollaborator()`, `reactivateCollaborator()`
- `validateHierarchy(actor, target)` — regras absolutas de eliminação (ver breifing.md §2)

### M3.4 — Rotas API

**Tarefas:**
1. `GET /api/admin/team/collaborators` — cursor-based
2. `POST /api/admin/team/collaborators/:id/deactivate`
3. `POST /api/admin/team/collaborators/:id/reactivate`
4. `DELETE /api/admin/team/collaborators/:id` — soft delete
5. `GET /api/admin/team/members`
6. `DELETE /api/admin/team/members/:id` — só owner/owner_temp
7. `GET /api/admin/team/invitations`
8. `POST /api/admin/team/invitations` — criar convite (member ou collaborator)
9. `POST /api/admin/team/invitations/:id/resend`
10. `DELETE /api/admin/team/invitations/:id`
11. `GET /api/admin/team/permissions` — matriz colaborador × módulos
12. `PATCH /api/admin/team/permissions/:userId`

**Regras de autorização:**
- Convidar sócio: só owner fixo + owner temporário
- Convidar colaborador: owner fixo + owner temporário + sócio
- Eliminar sócio: só owner fixo + owner temporário
- Verificação IDOR: `tenant_id` em cada operação

### M3.5 — Páginas UI

**Tarefas:**
1. `/dashboard` — métricas: seats, storage, limites módulos
2. `/team` — 3 tabs (Colaboradores | Convites | Permissões) + modal confirmação
3. Layout administrador com sidebar + header

### Checkpoint M3 ✅
```
G01 ✅  G02 ✅  G04 ✅ 171/171  GS01 ✅  GS05 ✅  GS09 ✅
Build: 11.22s  Deploy: 62ee2bc3
```

---

## M4 — COLABORADORES E PERMISSÕES DE MÓDULOS ✅ DONE (2026-02-27)

**Objectivo:** Dashboard de colaborador, acesso a módulos, auto-eliminação.

### M4.1 — Serviço

**Ficheiro a criar:** `apps/api/src/services/user.service.ts`
- `getUserModules()` — lista módulos disponíveis (stub M4, real em M10)
- `selfDeleteUser()` — soft-delete próprio com regras de hierarquia
- `getUserProfile()` — perfil público sem pass_hash

### M4.2 — Rotas API

**Tarefas:**
1. `GET /api/user/modules` — módulos do utilizador autenticado
2. `DELETE /api/user/me` — auto-eliminação (colaborador: sempre; sócio: só se não elevado)

### M4.3 — Páginas UI

**Tarefas:**
1. `/dashboard` actualizado — colaborador vê módulos disponíveis
2. `/modules/[id]` — placeholder (real em M10)

### Checkpoint M4 ✅ DONE (2026-02-27)
```
G01 ✅  G02 ✅  G04 ✅ 186/186  GS01 ✅  G03 ✅ 11.93s
Deploy: 052b56c0
```

---

## M5 — PERFIS E ARMAZENAMENTO ✅ DONE (2026-02-27)

**Objectivo:** Gestão completa de perfis, fotos, logótipos, quotas de storage, alteração de email.

### M5.1 — Schema

```sql
-- migrations/0005_profiles.sql
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN email_pending TEXT;
ALTER TABLE users ADD COLUMN email_token TEXT;
ALTER TABLE users ADD COLUMN email_token_expires_at INTEGER;
-- NOTA: CREATE UNIQUE INDEX separado (não ADD COLUMN UNIQUE — ver LL bug SQLite)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_token ON users(email_token) WHERE email_token IS NOT NULL;
```

### M5.2 — Storage lib

**Ficheiro a criar:** `apps/api/src/lib/storage.ts`
- `uploadFile(key, buffer, contentType, env)` → R2
- `deleteFile(key, env)` → R2
- `validateWebP(buffer)` — magic bytes WebP
- `validateFileSize(buffer, maxBytes)`, `validateImageDimensions(buffer, maxW, maxH)`
- Keys: `users/{user_id}/avatars/{filename}`, `tenants/{tenant_id}/logos/{filename}`

### M5.3 — Serviço de perfil

**Ficheiro a criar:** `apps/api/src/services/profile.service.ts`
- `getProfile`, `patchProfile`, `uploadAvatar`, `deleteAvatar`
- `requestEmailChange` (envia link), `confirmEmailChangeToken`
- `changePassword` (pede password actual), `exportRgpd`
- `getCompanyProfile`, `patchCompanyProfile`, `uploadCompanyLogo`, `deleteCompanyLogo`

### M5.4 — Rotas API — Perfil

**Tarefas:**
1. `GET /api/user/profile`
2. `PATCH /api/user/profile` — nome, apelido, telefone, website
3. `POST /api/user/profile/avatar` — upload WebP (validação + quota + R2)
4. `DELETE /api/user/profile/avatar`
5. `POST /api/user/profile/change-email`
6. `GET /api/user/confirm-email/:token` (público)
7. `POST /api/user/profile/change-password`
8. `GET /api/user/profile/export-rgpd` — JSON RGPD

### M5.5 — Rotas API — Empresa

**Tarefas:**
1. `GET /api/admin/company`
2. `PATCH /api/admin/company` — só owner fixo + owner temporário
3. `POST /api/admin/company/logo`
4. `DELETE /api/admin/company/logo`

### M5.6 — Páginas UI

**Tarefas:**
1. `/profile` — 2 secções:
   - Todos: dados pessoais, foto, alterar email, alterar password, exportar RGPD, auto-eliminação
   - Owner fixo + temp: dados da empresa, logótipo, pedido de eliminação, pedido de recursos
2. Progress bar de quota de storage

### Checkpoint M5 ✅ DONE (2026-02-27)
```
G01 ✅  G02 ✅  G04 ✅ 208/208  GS01 ✅  G03 ✅ 13.99s
Deploy: 4ab24d8d  |  Migration 0005: local ✅ remoto ✅
Bugs: LL-11 (Hono /profile*), LL-12 (CSRF maxAge timing)
```

---

## M6 — NOTIFICAÇÕES ✅ DONE (2026-02-27)

**Objectivo:** Sistema completo de notificações com badge, routing por role.

### M6.1 — Schema

```sql
-- migrations/0007_notifications.sql
notifications: id, user_id, tenant_id, type, title_key, body_key,
               params (JSON), link, is_read, created_at, read_at, expires_at
```

### M6.2 — Serviço

**Ficheiro a criar:** `apps/api/src/services/notification.service.ts`
- `createNotification(userId, type, params, link)`
- `notifyAdmins(tenantId, type, params)` — envia para todos os admins da empresa
- `notifyOwners(tenantId, type, params)` — envia para owner fixo + owner temporário

### M6.3 — Rotas API

**Tarefas:**
1. `GET /api/user/notifications` — cursor-based, 20 por página
2. `PATCH /api/user/notifications/:id/read`
3. `POST /api/user/notifications/read-all`
4. `GET /api/user/notifications/unread-count` — para badge

### M6.4 — Integração nos fluxos existentes

**Tarefas:**
1. Convite aceite → notificar admins da empresa
2. Elevação concedida/expirada/revogada → notificar sócio
3. Activar empresa (super) → notificar owner
4. Pedido de eliminação → notificar super user
5. Backup falhado → notificar super user (M8)
6. Escalação de recursos → notificar admin → super user (M10)

### M6.5 — Páginas UI

**Tarefas:**
1. `NotificationBell.svelte` no header admin — badge com contagem (polling ou refresh manual)
2. `/notifications` — lista cursor-based + "Marcar todas como lidas"
3. Clicar notificação → marca como lida + navega para link

### Checkpoint M6 ✅ DONE (2026-02-27)
```
G02 ✅  G04 ✅ 208/208  GS01 ✅  G03 ✅ 13.58s
Deploy: 1a406c42  |  Migration 0007: local ✅ remoto ✅
```

---

## M7 — INTEGRAÇÕES EXTERNAS ✅ DONE (2026-02-27)

**Objectivo:** Sistema de integrações por categoria. Email funcional. Credenciais cifradas. Circuit breakers.

### M7.1 — Schema

```sql
-- migrations/0008_integrations.sql
integrations: id, category, provider, credentials_encrypted (TEXT, AES-256-GCM base64url),
              is_active, tested_at, created_at, updated_at
              -- category: email|sms|llm|cloud_storage|calendar|payments|invoicing|pdf
              -- trigger auto-update de updated_at
              -- índices: (category, is_active), provider
```

### M7.2 — Arquitectura

**Ficheiros a criar:**
1. `apps/api/src/lib/encryption.ts` — AES-256-GCM via `ENCRYPTION_KEY` (env)
2. `apps/api/src/lib/circuit-breaker.ts` — `withCircuitBreaker(fn, opts)`: timeout ≤ 5s, 3 retries, backoff exponencial
3. `apps/api/src/lib/integrations/adapter.interface.ts` — `EmailAdapter`, `SmsAdapter`, `LlmAdapter`
4. `apps/api/src/lib/integrations/email/resend.ts` — `ResendEmailAdapter` (fetch directo, zero SDK)
5. `apps/api/src/lib/integrations/email/templates/index.ts` — HTML + texto puro para: convite owner/sócio/colaborador, reset password, confirmação email

**Regras de arquitectura:**
- Módulos NUNCA chamam fornecedores directamente — tudo via `getActiveEmailAdapter()`
- `withCircuitBreaker` obrigatório em TODAS as chamadas externas
- `ENCRYPTION_KEY` nunca em `process.env` — sempre `c.env.ENCRYPTION_KEY`

### M7.3 — Serviço

**Ficheiro a criar:** `apps/api/src/services/integration.service.ts`
- `getAllIntegrations()` — lista com credentials mascaradas (`***`)
- `createIntegration(category, provider, credentials, env)` — cifrar + guardar
- `updateCredentials(id, credentials, env)` — desactiva automaticamente
- `testIntegration(id, env)` — circuit breaker + ping ao fornecedor
- `activateIntegrationById(id, env)` — só após teste bem-sucedido
- `deactivateIntegrationById(id, env)`
- `removeIntegration(id, env)`
- `getActiveEmailAdapter(env)` — retorna adaptador activo ou erro
- `sendEmail(to, template, vars, env)` — verifica daily limit, usa adaptador, circuit breaker

### M7.4 — Queries

**Ficheiro a criar:** `apps/api/src/db/queries/integrations.ts`
- `listIntegrations`, `getIntegrationById`, `getActiveIntegrationByCategory`
- `insertIntegration`, `updateIntegrationCredentials`, `setIntegrationTested`
- `activateIntegration`, `deactivateIntegration`, `deleteIntegration`

### M7.5 — Rotas API

**Tarefas:**
1. `GET /api/super/integrations` — listar por categoria
2. `POST /api/super/integrations` — criar (cifrar credenciais)
3. `PATCH /api/super/integrations/:id` — actualizar credenciais (desactiva)
4. `POST /api/super/integrations/:id/test`
5. `POST /api/super/integrations/:id/activate`
6. `POST /api/super/integrations/:id/deactivate`
7. `DELETE /api/super/integrations/:id`

**Nota de registo no index.ts (ver LL-17):**
```typescript
// CORRECTO: montar no prefixo pai, rotas internas com segmento completo
app.route("/api/super", superIntegrationsRouter);
// rotas internas: /integrations, /integrations/:id, /integrations/:id/test, etc.
```

### M7.6 — Páginas UI

**Tarefas:**
1. `/super/integrations` — lista por categoria, formulário JSON, badges active/inactive
2. Acções: test, activate, deactivate, delete por integração
3. Link "⚡ Integrações" no sidebar do layout super
4. `CREDS_PLACEHOLDERS` — exemplos JSON por provider (resend, sendgrid, twilio, openai, etc.)

### Checkpoint M7 ✅ DONE (2026-02-27)
```
G01 ✅  G02 ✅  G04 ✅ 208/208  GS01 ✅  G03 ✅ 14.63s
Deploy: 43fa99f5 → 51c82b5f (docs fix)  |  Migration 0008: local ✅ remoto ✅
Bugs: LL-17 (Hono sub-router), LL-18 (Turbo cache), LL-19 (Zod record), LL-20 (password não documentada)
```

---

## M8 — BACKUPS

**Objectivo:** Backups manuais e automáticos por empresa. Importação. Integridade garantida.

### M8.1 — Schema

```sql
-- migrations/0009_backups.sql
backups: id, tenant_id, type (db_only|full), status (pending|running|done|failed),
         size_bytes, r2_key, download_expires_at, created_by, created_at, completed_at
backup_auto_config: tenant_id PK, enabled, frequency (daily|weekly|monthly),
                    day_of_week, retention_days, created_at, updated_at
```

### M8.2 — Serviço de backups

**Ficheiro a criar:** `apps/api/src/services/backup.service.ts`
- `generateBackup(tenantId, type, requestedBy)` — síncrono (<50MB) ou assíncrono via Queue (>50MB)
- `assembleBackupZip(tenantId, type)` — SQL dump + ficheiros R2 + manifesto JSON com versões módulos
- `importBackup(zipBuffer, tenantId)` — restaurar dados
- `processQueueMessage(message)` — consumidor Queue com dead letter
- `scheduleAutoBackup()` — chamado pelo cron (`0 0 * * *`)
- Notificação ao utilizador quando backup assíncrono pronto

### M8.3 — Rotas API

**Tarefas:**
1. `GET /api/admin/backups` — listar backups da empresa
2. `POST /api/admin/backups` — criar backup manual
3. `GET /api/admin/backups/:id/download` — URL presigned R2 (válida 24h)
4. `DELETE /api/admin/backups/:id` — eliminar backup
5. `GET /api/super/backups` — listar todos os backups (super user)
6. `POST /api/super/backups/import` — importar backup
7. `GET/PATCH /api/super/backups/config` — config automático

### M8.4 — Páginas UI

**Tarefas:**
1. `/backups` — lista de backups da empresa (admin/owner)
2. Criar backup manual + barra de progresso
3. Download com link válido 24h
4. (owner) Configuração de backup automático

### Checkpoint M8 ✅ DONE (2026-02-28)
```
G01 ✅  G02 ✅  G04 ✅ 220/220  GS01 ✅  G03 ✅
Deploy: a95f01f7-f7f8-4760-b98f-39ff49ef031d
Migration 0009: aplicada (local + remoto)
```

---

## M9 — HISTÓRICO DE ACTIVIDADE, AUDIT LOG E RGPD

**Objectivo:** Registos de auditoria completos. Exportação RGPD. Break-glass.

### M9.1 — Schema

```sql
-- migrations/0010_logs.sql
activity_log: id, tenant_id, actor_id, actor_name, action,
              target_type, target_id, target_name, metadata (JSON),
              was_temp_owner, created_at

audit_log: id, event_type, actor_id, tenant_id, target_type, target_id,
           bytes_affected, count_affected, metadata (JSON), created_at
           -- append-only, sem dados pessoais, retenção 365 dias
```

### M9.2 — Serviços

**Ficheiros a criar:**
- `apps/api/src/services/activity-log.service.ts`:
  - `logAction(tenantId, actorId, action, target, metadata)`
  - `cleanHistory(tenantId, actorId)` — verifica backup < 60 min
  - `exportHistory(tenantId)` → ZIP CSV
- `apps/api/src/services/audit-log.service.ts`:
  - `logAuditEvent(eventType, actorId, tenantId, metadata)` — nunca dados pessoais (IDs e contagens apenas)
- `apps/api/src/services/rgpd.service.ts`:
  - `exportUserData(userId, tenantId)` — agrega núcleo + módulos via `onRgpdExport`

### M9.3 — Break-glass

**Tarefas:**
1. `GET /api/super/break-glass` — ficheiro dinâmico (URL app + nome DB + token emergência 15min)
2. Notificação ao super user se > 30 dias sem download

### M9.4 — Rotas API

**Tarefas:**
1. `GET /api/admin/activity` — cursor-based, filtros por actor e action
2. `DELETE /api/admin/activity` — limpar histórico (exige backup < 60 min)
3. `GET /api/super/audit` — audit log (cursor-based, 365 dias)
4. `GET /api/super/break-glass` — ficheiro de emergência

### M9.5 — Páginas UI

**Tarefas:**
1. `/activity` — lista actividades da empresa com filtros
2. "Limpar histórico" — modal com verificação de backup

### Checkpoint M9 ✅ DONE (2026-02-28)
```
G01 ✅  G02 ✅  G04 ✅ 238/238  GS01 ✅  G03 ✅
Zero PII no audit log: verificado ✅
Deploy: 7e917653-0877-4957-b5a9-f5ea31ada30c  |  Migration 0010: aplicada (local + remoto)
```

---

## M10 — SISTEMA DE MÓDULOS

**Objectivo:** Registo de módulos, handlers de ciclo de vida, navegação dinâmica, permissões granulares.

### M10.1 — Registo central

**Ficheiros a criar:**
- `apps/api/src/modules.config.ts` — array de módulos com: id, name, icon, integrations_required, permissions, limits_schema, handlers
- `apps/api/src/lib/module-registry.ts`:
  - `getRegisteredModules()`, `getModuleById(id)`
  - `callOnUserDelete(userId, tenantId, db, r2)` — chama todos os módulos, tolera falhas
  - `callOnTenantDelete(tenantId, db, r2)` — idem
  - `callOnCronMaintenance(db, r2, env)` — idem (regista no audit log)
  - `callOnRgpdExport(userId, tenantId, db)` → agrega payloads

### M10.2 — Auto-criação de limites

**Tarefas:**
1. Ao criar empresa → criar registos `tenant_module_limits` com defaults de cada módulo
2. Ao registar novo módulo → criar limites para empresas existentes

### M10.3 — Navegação dinâmica

**Tarefas:**
1. `GET /api/user/nav` — itens de navegação filtrados por role + permissões
2. Módulos sem integração configurada: aparecem com indicação visual
3. `Navigation.svelte` — dinâmico, cursor-based na carga

### Checkpoint M10 ✅ DONE (2026-02-28)
```
[ ] G01  [ ] G02  [ ] G04 208+  [ ] GS01  [ ] G03
Deploy: pendente
```

---

## M11 — TEMA VISUAL (LAYOUTS, PALETAS, DARK MODE)

**Objectivo:** 3 layouts, 6 paletas, 2 temas. Persistência por cookie. Zero hex/px soltos.

### M11.1 — Store de preferências

**Ficheiros a criar:**
- `apps/web/src/lib/stores/theme.svelte.ts`:
  - Lê layout/palette/theme de cookies na inicialização
  - Actualiza `data-layout`, `data-theme`, `.palette-*` no `<body>`
  - Persiste mudanças em cookies (nunca localStorage)
  - Troca não causa re-render — apenas atributos no root

### M11.2 — Componentes

**Tarefas:**
1. `Sidebar.svelte` — 224px, nav items, logo zone, user zone
2. `TopNav.svelte` — primary bar + sub-bar
3. `CompactSidebar.svelte` — 60px, icon-only, tooltips
4. `Header.svelte` — height 56px, search, sino, perfil, logout (partilhado)
5. Mobile off-canvas drawer (breakpoint 1024px)
6. `ThemeSwitcher.svelte` — selector no perfil ou header

**Regra:** Todos via tokens CSS — zero hex/px soltos (GS03: `rg "(bg|text|border)-" apps/web/src/` → zero)

### Checkpoint M11 ✅ DONE (2026-02-28)
```
[x] G01 ✅  [x] GS01 ✅ 23.39s  [x] GS03 ✅ zero Tailwind
Deploy: ab2fe545 (2026-02-28)
```

---

## M12 — INTERNACIONALIZAÇÃO COMPLETA ✅ DONE

**Objectivo:** Paridade total pt/en. Zero texto hardcoded. Emails i18n. Build falha se chave em falta.

### M12.1 — Artefactos criados/modificados

1. ✅ Auditoria completa de todos os componentes — zero texto hardcoded
2. ✅ `messages/pt.json` e `messages/en.json` com 395 chaves cada (paridade total)
3. ✅ Email templates refactorados com suporte i18n (`lang?: "pt" | "en"`) — `templates/index.ts`
4. ✅ Script `apps/web/scripts/check-i18n-parity.mjs` integrado no `prebuild` — build falha se chave em falta
5. ✅ Ficheiros paraglide gerados com 395 mensagens compiladas

### Checkpoint M12
```
G01 ✅  G02 ✅  G03 ✅ (build falha se chave em falta)  G04 ✅ 262/262  GS01 ✅  GS04 ✅
Deploy: pendente
```

---

## M13 — OBSERVABILIDADE, HEALTH PROBES E GRACEFUL SHUTDOWN ✅ DONE

**Objectivo:** Endpoints de saúde, shutdown gracioso, logs estruturados.

### M13.1 — Artefactos criados/modificados

1. ✅ `GET /api/health/live` — liveness probe (200 + timestamp) — `routes/health.ts`
2. ✅ `GET /api/health/ready` — readiness probe (verifica D1 `SELECT 1`) — `routes/health.ts`
3. ✅ Graceful shutdown: `withGracefulShutdown()` via `ctx.waitUntil()` — `middleware/observability.ts`
4. ✅ `errorHandler` global: captura excepções, regista sem PII, envia para Sentry se `SENTRY_DSN` presente
5. ✅ `traceMiddleware`: propaga `X-Trace-Id` em todos os pedidos/respostas
6. ✅ `requestLogger`: log JSON estruturado `request_start` + `request_end` com `duration_ms`
7. ✅ Zero PII em logs: removido `email` de log em `team.ts`; `redactPii()` no error handler
8. ✅ 8 novos testes em `tests/observability.test.ts` (270 total)

### Checkpoint M13
```
G01 ✅  G02 ✅  G03 ✅  G04 ✅ 270/270  GS01 ✅
/api/health/live → 200 ✅  /api/health/ready → 200 ✅
Deploy: pendente
```

---

## M14 — SEGURANÇA FINAL E HARDENING ✅ DONE

**Objectivo:** SAST completo, security headers, IDOR final, supply chain.

### M14.1 — Artefactos criados/modificados

1. ✅ Security headers via `middleware/security-headers.ts`:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Content-Security-Policy` (default-src 'self', frame-ancestors 'none', upgrade-insecure-requests)
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy` (camera, mic, geo, payment desabilitados)
2. ✅ IDOR auditado: todas as queries filtram por `tenant_id` do utilizador autenticado
3. ✅ GS08: zero `process.env` no código de produção
4. ✅ GS09: `pass_hash` nunca incluído em respostas JSON
5. ✅ G14: `pnpm audit` — zero HIGH/CRITICAL (2 low apenas)
6. ✅ 7 novos testes em `tests/security-headers.test.ts` (277 total)

### Checkpoint M14
```
G01 ✅  G02 ✅  G03 ✅  G04 ✅ 277/277  GS01 ✅  GS08 ✅  GS09 ✅
G14 ✅ (zero high/critical)  G20 ✅ (security headers)
Deploy: pendente
```

---

## M15 — QA FINAL, E2E E VERIFIER

**Objectivo:** Todos os gates G01–G20 + GS01–GS09 a PASS. Playwright E2E. Aprovação final.

### M15.1 — Fluxos E2E obrigatórios (Playwright)

```
F1  — Setup inicial + login super user
F2  — Criar empresa + convite owner + aceitar + login owner
F3  — Convidar sócio + aceitar + login sócio
F4  — Convidar colaborador + aceitar + login colaborador
F5  — Soft delete utilizador (anonimização irreversível)
F6  — Elevação temporária (concessão + expiração + revogação)
F7  — Transferência atómica de ownership
F8  — Desactivar/reactivar empresa
F9  — Hard delete empresa (backup < 60 min + confirmação forte)
F10 — Reset de password (token uso único)
F11 — Alterar email (confirmação)
F12 — Exportação RGPD
F13 — Backup manual (síncrono)
F14 — Limpar histórico (backup prévio obrigatório)
F15 — Escalação de recursos (3 níveis)
```

### M15.2 — Lighthouse CI

```
LCP < 2500ms  |  INP < 200ms  |  CLS < 0.1  (G19)
```

### M15.3 — Verifier Report Final

```
VERIFIER REPORT — M15 (FINAL)
══════════════════════════════════════════
GATES AUTOMÁTICOS : G01–G20 PASS
GATES ESPECÍFICOS : GS01–GS09 PASS
VERIFICAÇÕES E2E  : F1–F15 PASS
──────────────────────────────────────────
BLOQUEANTES: [nenhum]
VEREDICTO: APROVADO
══════════════════════════════════════════
```

### Checkpoint M15
```
[ ] Todos os gates  [ ] E2E F1–F15  [ ] Lighthouse G19
Deploy: pendente
```

---

## GATES DE QUALIDADE (referência)

| Gate | Descrição | Bloqueante |
|------|-----------|-----------|
| G01 | Biome lint 0 errors | ✅ sempre |
| G02 | TypeScript 0 errors | ✅ sempre |
| G03 | pnpm build OK | ✅ sempre |
| G04 | Testes passam | ✅ sempre |
| G05 | Cobertura ≥ 70% | M1–M2 |
| GS01 | svelte-check 0 errors/warnings | ✅ sempre |
| GS05 | zero +server.ts em apps/api/ | ✅ sempre |
| GS08 | zero process.env em apps/ | ✅ sempre |
| GS09 | pass_hash nunca em respostas | ✅ sempre |

---

## REGRAS DE AVANÇO ENTRE MILESTONES

```
1. Milestone só conclui com CHECKPOINT: todos os gates exit 0 + deploy OK
2. Visual checkpoints de frontend → aprovação humana obrigatória
3. Nunca avançar sem APROVADO M[N] explícito
4. Qualquer falha de gate → milestone permanece IN_PROGRESS
5. Migrations destrutivas requerem aprovação humana
```

---

## FORA DE ÂMBITO (PERMANENTE)

```
- Módulos de negócio específicos (cf-base é o núcleo, não o módulo)
- Auto-registo de utilizadores
- OAuth2 flow interno
- WebSockets / tempo real
- Analytics ou tracking
- Webhooks outbound
- Feature flags
- Push notifications nativas
```

---

*BUILD_PLAN.md v2.0 — cf-base | Gerado 2026-02-26 | Actualizado 2026-02-27*
