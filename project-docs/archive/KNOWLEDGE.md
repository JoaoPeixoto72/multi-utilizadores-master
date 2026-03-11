# KNOWLEDGE.md — cf-base
# Propósito: estado actual + comandos operacionais + regras + endpoints
# Responde a: onde estou? como opero? o que NÃO fazer?
# NÃO colocar aqui: plano de tarefas (→ BUILD_PLAN.md), bugs (→ LESSONS_LEARNED.md), histórico (→ RUNLOG.md)
# Actualizar quando: milestone muda, versão deploy muda, credencial muda, nova regra crítica descoberta

---

## 1. IDENTIDADE DO PROJECTO

```
Nome:      cf-base
Local:     /home/user/webapp/
Stack:     SvelteKit 2 + Svelte 5 + Hono + Cloudflare Workers Static Assets + D1 SQLite
Runtime:   Cloudflare Workers (plano PAGO — bcryptjs cost=12)
Monorepo:  pnpm + turborepo
URL prod:  https://cf-base.acemang-jedi.workers.dev
GitHub:    https://github.com/JoaoPeixoto72/multi-utilizadores (branch: genspark_ai_developer)
```

---

## 2. ESTADO ACTUAL

```
M0  ✅ DONE — Scaffolding, CI, infraestrutura
M1  ✅ DONE — Autenticação (setup, login, sessões, reset)
M2  ✅ DONE — Multi-tenancy + Super User (empresas, convites owner)
M3  ✅ DONE — Administradores + Equipa (team management, convites, permissões)
M4  ✅ DONE — Colaboradores + Permissões de módulo (dashboard, self-delete, módulos stub)
M5  ✅ DONE — Perfis + Armazenamento (fotos, logótipos, quotas, email change, RGPD export)
M6  ✅ DONE — Notificações (badge, lista cursor-based, mark read, integração em fluxos)
M7  ✅ DONE — Integrações externas (encryption AES-256-GCM, circuit-breaker, Resend, UI super)
M8  ✅ DONE — Backups (manual + automático + importação)
M9  ✅ DONE — Histórico de actividade + Audit log + RGPD
M10 ✅ DONE — Sistema de módulos (registry, limites, nav dinâmica)
M11 ✅ DONE — Tema visual (layouts, paletas, dark mode, ThemeSwitcher)
M12 ✅ DONE — Internacionalização completa (395 chaves pt+en, email i18n, G03 build guard)
M13 ✅ DONE — Observabilidade (trace_id, request logger, error handler, graceful shutdown)
M14 ✅ DONE — Segurança final (CSP/HSTS/headers, IDOR audit, G14 audit, GS01 fix)
M15 ✅ DONE — QA Final + E2E Playwright (15/15 F1-F15 pass)

PROJECTO COMPLETO — todos os milestones M0-M15 concluídos
```

### Deploy actual
```
Versão:      M15-E2E (2026-02-28) — Version ID: 5631253e-5822-42f1-bc45-a2c6a60a82dc
Worker:      cf-base
URL:         https://cf-base.acemang-jedi.workers.dev
Wrangler:    4.69.0  (usar SEMPRE o local: apps/api/node_modules/.bin/wrangler)
D1:          cf-base-db / 8777b126-7409-4dee-bf99-e9f27ce624ec
Migrations:  0001–0010 aplicadas (local + remoto) — sem novas migrations em M12–M14
Testes:      277/277 unitários passam (19 ficheiros) + 15/15 E2E Playwright
Branch:      genspark_ai_developer
```

### Credenciais de teste
```
Super user:   acemang@gmail.com  |  role=super_user  |  Password: SuperAdmin2026!
Tenant admin: joaopeixoto@hotmail.com  |  role=tenant_admin, is_owner=1
              tenant_id: 0468cfb5a1ef6d3204dcbf1afcb1b4b1  |  Password: Teste1234!@
```

---

## 3. INFRA CLOUDFLARE

| Recurso     | Nome / ID                                          | Estado  |
|-------------|----------------------------------------------------|---------|
| D1 Database | cf-base-db / 8777b126-7409-4dee-bf99-e9f27ce624ec  | ✅      |
| R2 Bucket   | cf-base-storage                                    | ✅      |
| Queue       | cf-base-backup-queue                               | ❌ (M8) |
| Worker      | cf-base                                            | ✅      |
| Secrets     | CSRF_SECRET, SESSION_SECRET, ENCRYPTION_KEY, CF_ACCOUNT_ID, CF_API_TOKEN | ✅ |

```
Account: acemang.jedi@gmail.com
Account ID: 3b4357658ea7f411e51c3d344c677cc4
```

### Tabelas D1 activas
```
users, sessions, password_resets, tenants, invitations,
tenant_module_limits, tenant_storage_usage, tenant_daily_email_count,
app_config, notifications, integrations,
backups, backup_auto_config,
activity_log, audit_log, break_glass_log
```

---

## 4. COMANDOS OPERACIONAIS

### Build + Deploy
```bash
cd /home/user/webapp/apps/web && NODE_OPTIONS="--max-old-space-size=512" pnpm run build
cd /home/user/webapp && apps/api/node_modules/.bin/wrangler deploy
```

### Gates de qualidade (executar nesta ordem no fim de milestone)
```bash
# 1. Auto-fix
cd /home/user/webapp/apps/api && pnpm exec biome check --write --unsafe src/
# 2. Lint
cd /home/user/webapp/apps/api && pnpm exec biome check src/
# 3. TypeScript
cd /home/user/webapp/apps/api && pnpm exec tsc --noEmit
# 4. Testes
cd /home/user/webapp/apps/api && pnpm test
# 5. Svelte check
cd /home/user/webapp/apps/web && pnpm exec svelte-check --tsconfig ./tsconfig.json
# 6. Build
cd /home/user/webapp/apps/web && NODE_OPTIONS="--max-old-space-size=512" pnpm run build
# 7. Deploy
cd /home/user/webapp && apps/api/node_modules/.bin/wrangler deploy
# 8. Health check
curl https://cf-base.acemang-jedi.workers.dev/api/health/live
```

### Migrations D1
```bash
# Local:
apps/api/node_modules/.bin/wrangler d1 migrations apply cf-base-db --local
# Produção:
apps/api/node_modules/.bin/wrangler d1 migrations apply cf-base-db --remote
# Consulta directa:
apps/api/node_modules/.bin/wrangler d1 execute cf-base-db --remote --command="SELECT * FROM users"
```

### Reset de password de emergência
```bash
node -e "const b=require('/home/user/webapp/apps/api/node_modules/bcryptjs'); b.hash('NovaPwd@123!',12).then(h=>console.log(h));"
apps/api/node_modules/.bin/wrangler d1 execute cf-base-db --remote \
  --command="UPDATE users SET pass_hash = '\$HASH' WHERE email = 'EMAIL';"
```

### Secrets
```bash
apps/api/node_modules/.bin/wrangler secret put CSRF_SECRET
apps/api/node_modules/.bin/wrangler secret put SESSION_SECRET
apps/api/node_modules/.bin/wrangler secret put ENCRYPTION_KEY
```

### Git + GitHub
```bash
cd /home/user/webapp
git add -A && git commit -m "feat(MX): descrição"
git push origin genspark_ai_developer
```

---

## 5. ESTRUTURA DO MONOREPO

```
/home/user/webapp/
├── wrangler.toml               ← config Workers (único ficheiro wrangler)
├── apps/
│   ├── web/                    ← SvelteKit → .svelte-kit/cloudflare/ (build output)
│   └── api/                    ← Hono → integrado via apps/web/src/hooks.server.ts
├── packages/shared/            ← Zod schemas partilhados (roles, pagination, common)
├── migrations/                 ← SQL forward-only: 0001–0010 aplicadas; 0011+ pendentes
├── messages/                   ← i18n: pt.json (source) + en.json
└── project-docs/
    ├── README.txt              ← lê primeiro em nova conversa (estável)
    ├── KNOWLEDGE.md            ← este ficheiro
    ├── BUILD_PLAN.md           ← especificação de milestones (plano puro)
    ├── RUNLOG.md               ← artefactos + gates + deploy por milestone
    ├── LESSONS_LEARNED.md      ← bugs e problemas resolvidos (LL-01..LL-23)
    ├── TESTS_LOG.md            ← smoke tests por milestone
    ├── breifing.md             ← produto, hierarquias, regras negócio (LOCKED)
    ├── design/tokens.css       ← tokens CSS canónico (LOCKED)
    └── archive/                ← STACK_LOCK, STACK_RUNTIME, design-guidelines (referência)
```

---

## 6. PADRÃO DE INTEGRAÇÃO SVELTEKIT + HONO

```
Browser → SvelteKit (+page.server.ts) → hooks.server.ts → Hono (apps/api/src/index.ts)
                                              ↑
                                   /api/** delegado para Hono
                                   tudo o resto resolvido pelo SvelteKit
```

- `hooks.server.ts` é o ÚNICO ponto de delegação (GS05)
- Bindings em Hono: `c.env.DB`, `c.env.SESSION_SECRET`, etc.
- Bindings em SvelteKit: `event.platform?.env`
- NUNCA `process.env` em runtime

---

## 7. ROTAS WEB (SvelteKit)

| URL | Descrição | Guard |
|-----|-----------|-------|
| `/` | Redirect por role | auth |
| `/login` | Login | público |
| `/setup` | Setup inicial | público (one-time) |
| `/password-reset` | Pedir reset | público |
| `/password-reset/[token]` | Confirmar nova password | público |
| `/invite/[token]` | Aceitar convite | público |
| `/super/dashboard` | Dashboard super user | super_user |
| `/super/tenants` | Lista de empresas | super_user |
| `/super/tenants/new` | Criar empresa | super_user |
| `/super/tenants/[id]` | Detalhe de empresa | super_user |
| `/super/integrations` | Gestão de integrações (M7) | super_user |
| `/dashboard` | Dashboard empresa | tenant_admin/member/collaborator |
| `/team` | Gestão de equipa (M3) | tenant_admin/member/collaborator |
| `/notifications` | Lista de notificações (M6) | tenant_admin/member/collaborator |
| `/profile` | Perfil pessoal + empresa (M5) | tenant_admin/member/collaborator |
| `/modules/[id]` | Módulo específico (stub M4, real M10) | tenant_admin/member/collaborator |

### Redirects por role
```
super_user   → /super/dashboard
tenant_admin → /dashboard
member       → /dashboard
collaborator → /dashboard
não auth     → /login → (sem utilizadores) → /setup
```

---

## 8. ENDPOINTS API

### Públicos
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/health/live` | GET | Health probe |
| `/api/health/ready` | GET | Readiness probe |
| `/api/auth/csrf` | GET | CSRF token |
| `/api/setup` | GET/POST | Setup super_user (one-time) |
| `/api/auth/login` | POST | Login |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/password-reset/request` | POST | Pedir reset |
| `/api/auth/password-reset/confirm` | POST | Confirmar reset |
| `/api/invitations/:token` | GET | Validar token convite |
| `/api/invitations/:token/accept` | POST | Aceitar convite |
| `/api/user/confirm-email/:token` | GET | Confirmar alteração email (M5) |

### Autenticados
| Endpoint | Método | Guard | Descrição |
|----------|--------|-------|-----------|
| `/api/auth/me` | GET | auth | Dados do utilizador autenticado |
| `/api/super/tenants` | GET | super_user | Listar empresas |
| `/api/super/tenants` | POST | super_user | Criar empresa + convite owner |
| `/api/super/tenants/:id` | GET/PATCH | super_user | Detalhe / actualizar limites |
| `/api/super/tenants/:id/activate` | POST | super_user | Activar empresa |
| `/api/super/tenants/:id/deactivate` | POST | super_user | Desactivar empresa |
| `/api/super/tenants/:id/transfer-ownership` | POST | super_user | Transferir ownership |
| `/api/super/tenants/:id/elevate` | POST/DELETE | super_user | Elevação temporária |
| `/api/super/settings` | GET/PATCH | super_user | Configurações globais |
| `/api/super/integrations` | GET/POST | super_user | Listar / criar integração (M7) |
| `/api/super/integrations/:id` | PATCH/DELETE | super_user | Actualizar / remover (M7) |
| `/api/super/integrations/:id/test` | POST | super_user | Testar (M7) |
| `/api/super/integrations/:id/activate` | POST | super_user | Activar (M7) |
| `/api/super/integrations/:id/deactivate` | POST | super_user | Desactivar (M7) |
| `/api/admin/team/collaborators` | GET | admin | Listar colaboradores |
| `/api/admin/team/collaborators/:id/deactivate` | POST | admin | Desactivar |
| `/api/admin/team/collaborators/:id/reactivate` | POST | admin | Reactivar |
| `/api/admin/team/collaborators/:id` | DELETE | admin | Eliminar (soft) |
| `/api/admin/team/members` | GET | admin | Listar sócios |
| `/api/admin/team/members/:id` | DELETE | admin | Eliminar sócio (soft) |
| `/api/admin/team/invitations` | GET/POST | admin | Listar / criar convite |
| `/api/admin/team/invitations/:id/resend` | POST | admin | Reenviar convite |
| `/api/admin/team/invitations/:id` | DELETE | admin | Cancelar convite |
| `/api/admin/team/permissions` | GET | admin | Matriz de permissões |
| `/api/admin/team/permissions/:userId` | PATCH | admin | Actualizar permissões |
| `/api/admin/company` | GET | auth (tenant) | Dados da empresa (M5) |
| `/api/admin/company` | PATCH | owner/temp_owner | Editar empresa (M5) |
| `/api/admin/company/logo` | POST/DELETE | owner/temp_owner | Logo empresa (M5) |
| `/api/user/modules` | GET | auth | Módulos disponíveis |
| `/api/user/profile` | GET/PATCH | auth | Perfil pessoal (M5) |
| `/api/user/profile/avatar` | POST/DELETE | auth | Foto de perfil (M5) |
| `/api/user/profile/change-email` | POST | auth | Pedir alteração email (M5) |
| `/api/user/profile/change-password` | POST | auth | Alterar password (M5) |
| `/api/user/profile/export-rgpd` | GET | auth | Export RGPD JSON (M5) |
| `/api/user/me` | DELETE | auth | Auto-eliminação (soft delete) |
| `/api/user/notifications` | GET | auth | Listar notificações (M6) |
| `/api/user/notifications/unread-count` | GET | auth | Contagem não lidas (M6) |
| `/api/user/notifications/:id/read` | PATCH | auth | Marcar como lida (M6) |
| `/api/user/notifications/read-all` | POST | auth | Marcar todas como lidas (M6) |

### CSRF
```
Middleware em /api/* para POST/PUT/PATCH/DELETE
Header obrigatório: x-csrf-token: <token de /api/auth/csrf>
Token: HMAC-SHA-256, expira 1h
```

---

---

## 10. PROIBIÇÕES ABSOLUTAS

```
wrangler pages deploy            → usar: wrangler deploy
pages_build_output_dir           → campo de Pages, inválido em Workers
@cloudflare/workers-types        → usar: wrangler types
process.env em runtime           → usar: c.env (Hono) | event.platform?.env (SvelteKit)
+server.ts para lógica API       → usar: Hono routes via hooks.server.ts
bcrypt / argon2 / jsonwebtoken   → usar: bcryptjs 2.4.3
localStorage / sessionStorage    → usar: cookies httpOnly + D1
fetch() directo no frontend      → usar: server actions (+page.server.ts)
SQL inline nos handlers          → centralizar em: apps/api/src/db/queries/
bun / npm / yarn                 → usar: pnpm
tailwindcss < 4                  → usar: 4.x
@inlang/paraglide-sveltekit      → usar: @inlang/paraglide-js
Qualquer SDK npm para APIs ext.  → usar: fetch directo (Resend, Twilio, etc.)
```

---

## 11. WRANGLER.TOML — CAMPOS VÁLIDOS

```toml
# ✅ VÁLIDOS para Workers Static Assets:
name, main, compatibility_date, compatibility_flags
[assets] binding, directory
[observability] enabled
[[d1_databases]] binding, database_name, database_id, migrations_dir
[[durable_objects.bindings]] name, class_name
[[migrations]] tag, new_sqlite_classes
[[r2_buckets]] binding, bucket_name
[triggers] crons
[vars] KEY = "value"

# ❌ PROIBIDOS:
pages_build_output_dir       # campo de Pages
[[durable_objects.migrations]] # sintaxe antiga
```

---

## 12. VERSÕES LOCKED

| Package | Versão |
|---------|--------|
| wrangler | **4.69.0** |
| node (mínimo) | 24.14.0 |
| pnpm | 10.x |
| svelte | 5.53.5 |
| @sveltejs/kit | 2.53.2 |
| @sveltejs/adapter-cloudflare | 7.2.8 |
| hono | 4.12.2 |
| zod | 4.3.6 |
| bcryptjs | 2.4.3 |
| tailwindcss + @tailwindcss/vite | 4.2.1 |
| @inlang/paraglide-js | 2.12.0 |
| bits-ui | 2.16.2 |
| vite | 7.3.1 |
| typescript | 5.9.3 |
| @biomejs/biome | 2.4.4 |
| turbo | 2.8.11 |
| vitest | 4.0.18 |

**Pacotes PROIBIDOS:** `bcrypt`, `argon2`, `@node-rs/argon2`, `jsonwebtoken`, `@inlang/paraglide-sveltekit`

---

## 13. DESIGN

```
Tokens CSS:  project-docs/design/tokens.css (371 variáveis, 11 secções) — fonte de verdade
Copiado em:  apps/web/src/styles/tokens.css
Ícones:      @lucide/svelte (único permitido)
Fontes:      Inter (sans) + JetBrains Mono (mono)
Estética:    CLEAN_MINIMAL — sem decoração excessiva
NUNCA:       classes Tailwind para cor/espaçamento/tipografia — usar tokens CSS
```

---

## 14. DIAGNÓSTICO RÁPIDO

| Sintoma | Ver |
|---------|-----|
| 403 "Cross-site POST" em curl | Adicionar `-H "Origin: https://cf-base.acemang-jedi.workers.dev"` |
| Build OOM no sandbox | `NODE_OPTIONS="--max-old-space-size=512"` |
| Qualquer outro sintoma de runtime | LESSONS_LEARNED.md (índice no topo do ficheiro) |

---

*Actualizado: 2026-02-28 — M15 DONE (15/15 E2E), projecto completo M0-M15*
