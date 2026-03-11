# STACK_LOCK.md
# Versão: 1.1.0
# Gerado por: Architect (FASE 0)
# Criado:     2026-02-26
# Actualizado: 2026-02-26 — tokens.css canónico criado; mockup APROVADO; questionário técnico fechado
# Projecto: cf-base (boilerplate multi-empresa Cloudflare)
# Estado: LOCKED — fonte de verdade para Builder e Verifier
# Fontes: STACK_RUNTIME.md v3.1.0 + STACK_SOFTWARE.md v3.1.0 + design-guidelines.md v2.2.2 + breifing.md v6.5
#
# APROVAÇÕES:
#   APROVADO MOCKUP     → 2026-02-26 (utilizador)
#   Q_COVERAGE=70%      → confirmado 2026-02-26
#   Q_A11Y=AA           → confirmado 2026-02-26
#   Q_COMPLIANCE=OK     → confirmado 2026-02-26
#   Q_OBSERV=opcional   → confirmado 2026-02-26
#   Q_SUPPLYCHAIN=npm   → confirmado 2026-02-26

---

## 1. IDENTIFICAÇÃO DO PROJECTO

```yaml
nome:          cf-base
descricao:     Boilerplate multi-empresa SaaS — Cloudflare Workers + SvelteKit + Hono
stack_id:      sveltekit_hono_cloudflare + cloudflare_workers_d1_r2
tipo:          monorepo pnpm + turborepo
dominio:       single-runtime, single-domain, single-deploy
node_minimo:   24.14.0   # Node 24 LTS — Active LTS até Abril 2028
pnpm_minimo:   10.0.0
workers_plan:  PAID      # obrigatório — bcryptjs cost=12 requer 30000ms CPU/req
```

---

## 2. VERSÕES LOCKED (fonte de verdade absoluta)

### 2.1 Runtime e ferramentas
```yaml
node:          24.14.0   # mínimo obrigatório (LTS)
pnpm:          10.x      # gestor de pacotes obrigatório
wrangler:      4.68.1    # CLI deploy + dev local
miniflare:     4.20260224.0
compatibility_date: "2026-02-26"
compatibility_flags:
  - nodejs_als    # AsyncLocalStorage — obrigatório para SvelteKit no Workers
  - nodejs_compat # node:crypto, bcryptjs, buffer — obrigatório
```

### 2.2 Frontend — apps/web
```yaml
svelte:                         5.53.5
"@sveltejs/kit":                2.53.2
"@sveltejs/adapter-cloudflare": 7.2.8
tailwindcss:                    4.2.1
"@tailwindcss/vite":            4.2.1
bits-ui:                        2.16.2
"@inlang/paraglide-js":         2.12.0
hono:                           4.12.2   # cliente RPC
zod:                            4.3.6
"@lucide/svelte":               latest   # ícones — única biblioteca permitida
# devDependencies
vite:                           7.3.1    # requer Node >= 24.14.0
typescript:                     5.9.3
svelte-check:                   4.4.3
"@types/node":                  22.x
```

### 2.3 API — apps/api
```yaml
hono:                  4.12.2
"@hono/zod-validator": 0.7.6
zod:                   4.3.6
bcryptjs:              2.4.3   # hashing passwords — plano pago obrigatório
# devDependencies
wrangler:              4.69.0
typescript:            5.9.3
"@types/node":         22.x
"@types/bcryptjs":     2.4.6
vitest:                4.0.18
```

### 2.4 packages/shared
```yaml
zod:        4.3.6
typescript: 5.9.3
```

### 2.5 Raiz do monorepo (devDependencies)
```yaml
"@biomejs/biome":   2.4.4
turbo:              2.8.11
typescript:         5.9.3
vitest:             4.0.18
"@playwright/test": 1.58.2
```

---

## 3. BINDINGS CLOUDFLARE ACTIVOS

```yaml
# Resolvidos com base no briefing.md v6.5

bindings_activos:
  ASSETS:         true   # sempre — Workers Static Assets
  DB:             true   # sempre — D1 principal
  RATE_LIMITER:   true   # autenticação pública — Durable Object
  R2_BUCKET:      true   # fotos de perfil, logótipos, backups, PDFs
  BACKUP_QUEUE:   true   # backups assíncronos (>50MB)
  CSRF_SECRET:    true   # autenticação — HMAC-SHA-256, min 64 hex chars
  SESSION_SECRET: true   # sessões — HMAC-SHA-256, min 64 hex chars
  ENCRYPTION_KEY: true   # AES-256-GCM — credenciais de integrações externas
  ALLOWED_ORIGIN: false  # CORS desactivado (single-domain)
  CF_ACCOUNT_ID:  true   # Cloudflare Browser Rendering (PDF)
  CF_API_TOKEN:   true   # Cloudflare Browser Rendering (PDF)
```

---

## 4. PADRÕES DE INTEGRAÇÃO (extraídos de STACK_SOFTWARE.md)

```yaml
integracao_sveltekit_hono:
  ficheiro:            apps/web/src/hooks.server.ts
  ficheiro_api:        apps/api/src/index.ts
  prefixo:             /api/**
  regras:
    - ZERO +server.ts para lógica de negócio
    - ZERO +server.ts como bridge/catch-all
    - Toda a lógica API em apps/api/ exclusivamente
    - hooks.server.ts é o único ponto de delegação
    - Hono recebe Request nativo, devolve Response nativa
    - Bindings passados via platform.env

cliente_rpc:
  tipo_exportado:  AppType (typeof honoApp)
  ficheiro:        apps/api/src/index.ts
  cliente:         hc<AppType>(location.origin)
  ficheiro_cliente: apps/web/src/lib/api/client.ts

acesso_bindings:
  api:      c.env               # contexto Hono
  frontend: event.platform?.env # hooks.server.ts
  nunca:    process.env         # proibido em runtime

entry_points:
  wrangler_main:  .svelte-kit/cloudflare/_worker.js
  assets_dir:     .svelte-kit/cloudflare
  build_output:   .svelte-kit/cloudflare
```

---

## 5. ARQUITECTURA DA API (4 CAMADAS — OBRIGATÓRIA)

```
routes/ → handlers/ → services/ → db/queries/
```

```yaml
routes:     endpoints + middleware (auth, csrf, rate-limit)
handlers:   validação Zod + autorização por rota + IDOR check
services:   lógica de negócio pura — sem acesso directo a DB
db/queries: único local de SQL — prepared statements — zero inline
```

### Estrutura de ficheiros apps/api/src/
```
apps/api/src/
├── index.ts              # app Hono + export AppType
├── routes/
│   ├── auth/
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── register.ts   # apenas para convites
│   └── [dominio]/        # rotas protegidas por domínio
├── middleware/
│   ├── auth.ts           # guard: valida sessão + popula c.var.user
│   ├── csrf.ts           # valida CSRF token em mutações
│   └── rate-limit.ts     # Durable Object rate limiter
├── lib/
│   ├── auth.ts           # hashPassword, verifyPassword (bcryptjs)
│   ├── session.ts        # createSession, getSession, deleteSession
│   └── csrf.ts           # generateToken, verifyToken (HMAC-SHA-256)
└── db/
    └── queries/
        ├── users.ts
        ├── sessions.ts
        └── [dominio].ts
```

---

## 6. AUTENTICAÇÃO E SEGURANÇA

```yaml
passwords:
  algoritmo:    bcryptjs
  cost_factor:  12
  package:      bcryptjs@2.4.3
  workers_plan: PAID obrigatório (30 000ms CPU/req)
  proibido:
    - bcrypt            # bindings C++ — não funciona
    - argon2            # bindings C++ — não funciona
    - "@node-rs/argon2" # bindings Rust — não funciona
    - argon2-wasm-edge  # abandonado
    - jsonwebtoken      # não funciona no Workers

sessoes:
  tipo:        cookie httpOnly
  armazenamento: D1 (tabela sessions)
  signing:     HMAC-SHA-256 via SESSION_SECRET
  uma_por_user: true  # novo login invalida sessão anterior
  proibido:
    - JWT stateless sem revogação
    - sessões em KV
    - localStorage/sessionStorage

cookies:
  httpOnly:  true
  secure:    true
  sameSite:  "Strict"

tokens_expiracao:
  access_session:    configurável (padrão: sessão do browser)
  password_reset:    1 hora
  convite:           24 horas (configurável)
  email_change:      24 horas
  break_glass:       15 minutos
  owner_temporario:  24 horas (configurável)

csrf:
  algoritmo:  HMAC-SHA-256
  secret:     CSRF_SECRET (min 64 hex chars)
  aplicado:   todas as mutações (POST/PUT/PATCH/DELETE)

rate_limiting:
  mecanismo:  Durable Object (RATE_LIMITER)
  proibido:   KV para rate limiting

bcrypt_generation:
  csrf_secret:    openssl rand -hex 32
  session_secret: openssl rand -hex 32

erros_auth:
  regra: sempre genéricos — nunca revelar se email existe,
         se password está errada, se conta está desactivada
```

---

## 7. BASE DE DADOS (D1)

```yaml
binding:     DB
migrations:  migrations/*.sql — forward-only, raiz do repo
queries:     apps/api/src/db/queries/ — único local SQL
tipos:       gerados por wrangler types — nunca escritos à mão
tenant_key:  sempre primeiro parâmetro em queries multi-tenant
```

### Schema base (migrations/0001_auth.sql)
```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email       TEXT NOT NULL UNIQUE,
  pass_hash   TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signed_token TEXT NOT NULL UNIQUE,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token   ON sessions(signed_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### Regras de schema
```yaml
ids:           TEXT — lower(hex(randomblob(16)))
timestamps:    INTEGER — unixepoch() — sem TZ em DB
fk_on_delete:  explícito em todas as FKs (CASCADE ou RESTRICT ou SET NULL)
indices_fk:    índice por cada foreign key — obrigatório
sql_location:  APENAS em db/queries/ — zero inline em handlers/services
prepared:      prepared statements — sempre
idor:          owner_id/tenant_id verificado antes de qualquer mutação
migrations:    forward-only — destrutivas requerem aprovação humana
```

---

## 8. STORAGE (R2)

```yaml
binding:    R2_BUCKET
keys:       namespaceadas por tenant/user
            ex: tenants/{tenant_id}/logos/{filename}
                users/{user_id}/avatars/{filename}
                tenants/{tenant_id}/backups/{filename}
uploads:    presigned URLs
limites:    size e type enforçados na aplicação
            foto_perfil: WebP, max 200KB, max 512x512
            logo_empresa: WebP, max 200KB, max 512x512
            backup: ZIP
```

---

## 9. QUEUES (Cloudflare Queues)

```yaml
binding:           BACKUP_QUEUE
dead_letter_queue: obrigatória
threshold_sync:    50MB (abaixo = síncrono, acima = assíncrono)
notificacao:       ao utilizador quando pronto
link_validade:     24 horas
```

---

## 10. CRON (Workers Cron Triggers)

```yaml
schedule:     configurável pelo super user (defeito: meia-noite Europe/Lisbon)
idempotencia: obrigatória
log:          job_id em cada execução
handlers:
  - apagar convites expirados
  - apagar reservas email expiradas
  - apagar tokens expirados não usados
  - apagar notificações lidas > 30 dias
  - reverter elevações temporárias expiradas
  - apagar contadores rate limiting obsoletos
  - apagar contadores diários email antigos
  - disparar backup automático se activo
  - executar onCronMaintenance de cada módulo
tolerancia: falha de um módulo → regista no audit log → continua
```

---

## 11. WRANGLER.TOML (template do projecto)

```toml
name = "cf-base"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2026-02-26"
compatibility_flags = ["nodejs_als", "nodejs_compat"]

[assets]
binding   = "ASSETS"
directory = ".svelte-kit/cloudflare"

[observability]
enabled = true
[observability.logs]
head_sampling_rate = 1

[[d1_databases]]
binding       = "DB"
database_name = "cf-base-db"
database_id   = "PLACEHOLDER_SUBSTITUIR_APOS_wrangler_d1_create"

[[durable_objects.bindings]]
name       = "RATE_LIMITER"
class_name = "RateLimiter"

[[durable_objects.migrations]]
tag                = "v1"
new_sqlite_classes = ["RateLimiter"]

[[r2_buckets]]
binding     = "R2_BUCKET"
bucket_name = "cf-base-storage"

[[queues.producers]]
binding = "BACKUP_QUEUE"
queue   = "cf-base-backup-queue"

[[queues.consumers]]
queue             = "cf-base-backup-queue"
max_batch_size    = 10
max_batch_timeout = 30

[triggers]
crons = ["0 0 * * *"]

[vars]
APP_ENV = "production"

# SECRETS — nunca no wrangler.toml — via wrangler secret put
# CSRF_SECRET      (openssl rand -hex 32)
# SESSION_SECRET   (openssl rand -hex 32)
# ENCRYPTION_KEY   (AES-256-GCM key)
# CF_ACCOUNT_ID
# CF_API_TOKEN
```

---

## 12. ESTRUTURA DO MONOREPO

```
cf-base/
├── apps/
│   ├── web/                      ← SvelteKit 2 + Svelte 5
│   │   └── src/
│   │       ├── hooks.server.ts   ← único ponto de delegação para Hono
│   │       ├── app.html          ← template HTML global
│   │       ├── app.css           ← import tokens.css + reset global
│   │       ├── routes/           ← apenas páginas UI (.svelte)
│   │       │   └── +error.svelte ← error boundary global
│   │       ├── lib/
│   │       │   ├── api/
│   │       │   │   └── client.ts ← cliente RPC tipado (hono/client)
│   │       │   └── components/   ← componentes UI reutilizáveis
│   │       ├── styles/
│   │       │   └── tokens.css    ← design tokens (ver Secção 14)
│   │       └── paraglide/        ← gerado automaticamente (i18n)
│   └── api/                      ← Hono (toda a lógica de API)
│       └── src/
│           ├── index.ts          ← app Hono + export AppType
│           ├── routes/
│           ├── middleware/
│           ├── lib/
│           └── db/
│               └── queries/
├── packages/
│   └── shared/                   ← Zod schemas + tipos partilhados
├── migrations/
│   ├── 0001_auth.sql
│   └── ...
├── messages/
│   ├── pt.json                   ← Português Europeu (idioma default)
│   └── en.json                   ← Inglês
├── project.inlang/
│   └── settings.json
├── wrangler.toml
├── turbo.json
├── pnpm-workspace.yaml
├── biome.json
├── package.json                  ← engines: node>=24.14.0, pnpm>=10
└── worker-configuration.d.ts    ← gerado por wrangler types (commitar)
```

---

## 13. CONFIGURAÇÃO DE FICHEIROS

### package.json (raiz)
```json
{
  "engines": {
    "node": ">=24.14.0",
    "pnpm": ">=10.0.0"
  }
}
```

### svelte.config.js
```js
import adapter from '@sveltejs/adapter-cloudflare'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
}
```

### vite.config.ts (apps/web)
```ts
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
})
```

### tsconfig.json — regra global
```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noFloatingPromises": "error" },
      "security":    { "noGlobalEval": "error" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".svelte-kit/**", "dist/**"] },
    "check": { "dependsOn": ["^build"] },
    "lint":  {},
    "test":  { "dependsOn": ["^build"] },
    "dev":   { "cache": false, "persistent": true }
  }
}
```

### project.inlang/settings.json
```json
{
  "sourceLanguageTag": "pt",
  "languageTags": ["pt", "en"],
  "modules": ["@inlang/paraglide-js/compiler"]
}
```

---

## 14. DESIGN TOKENS (extraídos de design-guidelines.md v2.2.2)

```yaml
status:          LOCKED
aesthetic:       CLEAN_MINIMAL
design_source:   design-guidelines.md v2.2.2 (aprovado 2026-02-21)
mockup_aprovado: 2026-02-26 (APROVADO MOCKUP — utilizador confirmou)
tokens_path:     apps/web/src/styles/tokens.css
tokens_source:   project-docs/design/tokens.css  (canónico gerado pelo Architect)
icon_library:    "@lucide/svelte"
font:            Inter (Google Fonts)
font_mono:       JetBrains Mono / Fira Code
```

### Layouts, Paletas e Temas
```yaml
layouts:          [SIDEBAR, TOPNAV, COMPACT]
palettes:         [INDIGO, EMERALD, ROSE, AMBER, SLATE, OCEAN]
themes:           [LIGHT, DARK]
default_layout:   SIDEBAR
default_palette:  INDIGO
default_theme:    LIGHT
user_switches:    layout=true, palette=true, theme=true
persistencia:     cookies (NUNCA localStorage/sessionStorage)
root_attrs:       data-layout, data-theme, .palette-{name} em <body>
mobile_breakpoint: 1024px (excepção permitida — não tokenizável em media queries)
```

### Secções do tokens.css canónico
```yaml
§1  — Superfícies e Texto (Light — :root)
§2  — Dark Mode Overrides ([data-theme="dark"])
§3  — Paletas de Marca (6 × .palette-{name})
§4  — Paletas em Dark Mode (6 × [data-theme="dark"].palette-{name})
§5  — Tipografia (:root)
§6  — Espaçamento (:root)
§7  — Radius (:root)
§8  — Sizes — Layout, Controls, Content (:root)
§9  — Elevação / Sombras (:root)
§10 — Motion (:root)
§11 — Z-Index (:root)
```

### Inventário completo de variáveis CSS (fonte da verdade)
```css
/* §1 — Superfícies (LIGHT) */
--bg-page, --bg-surface, --bg-surface-hover, --bg-surface-subtle, --bg-overlay

/* §1 — Bordas (LIGHT) */
--border-base, --border-subtle, --border-input, --border-input-hover

/* §1 — Texto (LIGHT) */
--text-primary, --text-secondary, --text-muted, --text-xmuted, --text-inverse

/* §1 — Status */
--status-active-dot, --status-pending-dot, --status-inactive-dot
--status-active-text, --status-pending-text, --status-inactive-text

/* §1 — Badge de alerta */
--badge-alert-bg, --badge-alert-text

/* §1 — Tabelas */
--bg-table-header

/* §1 — Métricas (semântica fixa) */
--metric-admin-bg, --metric-admin-icon
--metric-members-bg, --metric-members-icon
--metric-storage-bg, --metric-storage-icon
--metric-emails-bg, --metric-emails-icon

/* §2 — Dark Mode overrides */
/* (redefinições de: --bg-*, --border-*, --text-*, --bg-table-header) */

/* §3 — Paletas (por cada uma: indigo, emerald, rose, amber, slate, ocean) */
--brand-50, --brand-100, --brand-200, --brand-500, --brand-600, --brand-700, --brand-800
--badge-role-bg, --badge-role-text
--nav-active-bg, --nav-active-text
--avatar-bg, --avatar-text
--ring-color

/* §4 — Paletas Dark Mode overrides */
/* (redefinições de: --nav-active-*, --badge-role-*, --avatar-*, --ring-color) */

/* §5 — Tipografia */
--font-sans, --font-mono
--text-2xs(10px), --text-xs(12px), --text-sm(13px), --text-base(14px)
--text-lg(16px), --text-xl(20px), --text-metric(24px)
--weight-normal(400), --weight-medium(500), --weight-semibold(600), --weight-bold(700)
--leading-tight(1.2), --leading-normal(1.5), --leading-loose(1.75)
--tracking-normal(0em), --tracking-wide(0.04em), --tracking-wider(0.06em), --tracking-widest(0.08em)

/* §6 — Espaçamento */
--space-1(4px), --space-2(8px), --space-3(10px), --space-4(12px)
--space-5(16px), --space-6(20px), --space-7(24px), --space-8(32px)
--space-nav-y(7px), --space-status-gap(5px), --space-btn-icon-gap(6px), --space-compact-nav(9px)

/* §7 — Radius */
--radius-sm(6px), --radius-md(8px), --radius-lg(12px), --radius-xl(16px), --radius-full(9999px)

/* §8 — Sizes */
--border-w-1(1px)
--size-header-h(56px), --size-subbar-h(44px), --size-sidebar-w(224px)
--size-sidebar-compact-w(60px), --size-logo-zone-h(56px)
--pad-page-main, --pad-header-x
--size-control-h(36px), --size-icon-btn(32px), --size-pagination-btn(28px)
--size-icon-inline(14px), --size-icon-ui(16px), --size-icon-empty(48px)
--size-status-dot(6px)
--size-metric-icon-box(32px), --size-metric-icon(14px)
--size-search-w(200px), --pad-search-left, --offset-search-icon-left
--offset-select-icon-right
--size-modal-w(420px), --size-modal-w-wide(560px), --size-modal-w-compact(320px)
--pad-modal-viewport, --pad-modal-x(22px), --pad-modal-header-top(18px)
--pad-modal-header-bottom(16px), --pad-modal-body-y, --pad-modal-footer-y(14px)
--pad-table-x, --pad-th-y, --pad-td-y
--pad-empty-y(48px), --pad-empty-x
--pad-btn-primary-x(14px), --pad-btn-secondary-x(13px)
--pad-badge-y(2px), --pad-badge-x(9px), --pad-badge-count-y(1px), --pad-badge-count-x(6px)
--size-progress-h(4px)
--size-auth-card-w(380px), --size-toast-w(320px), --size-drawer-w(480px)
--size-settings-tabs-w(200px)
--size-error-code(80px), --size-error-maxw(400px)
--size-avatar-sm(30px), --size-avatar-md(40px), --text-avatar-sm(11px), --text-avatar-md(14px)

/* §9 — Sombras */
--shadow-none, --shadow-modal, --shadow-popover, --shadow-focus

/* §10 — Motion */
--duration-fast(100ms), --duration-normal(150ms), --duration-slow(200ms)
--ease-default, --ease-in-out

/* §11 — Z-Index */
--z-base(0), --z-raised(10), --z-sticky(40), --z-overlay(50)
--z-modal(100), --z-toast(200), --z-tooltip(300)
```

### Anti-patterns proibidos (design)
```yaml
- cores hardcoded (#..., rgb(...), bg-indigo-600)
- valores px soltos em componentes
- box-shadow em cards/tabelas (excepto --shadow-focus)
- modais sobre modais
- texto inline em componentes (viola i18n)
- localStorage/sessionStorage
- gradientes decorativos
- mistura de bibliotecas de ícones
- outline:none sem substituto
- {@html} (XSS)
- tabela/lista sem empty state
- acção destrutiva sem confirmação modal
```

---

## 15. i18n

```yaml
package:       "@inlang/paraglide-js"
proibido:      "@inlang/paraglide-sveltekit" (deprecated)
config:        project.inlang/settings.json
mensagens:     messages/{lang}.json
codigo_gerado: apps/web/src/paraglide/ (auto-gerado — não editar)
importacao:    import * as m from '$lib/paraglide/messages.js'
idiomas:       pt (source, default), en
paridade:      obrigatória — build falha se faltar chave
modulos:       locales/{lang}/module_{module_id}.json
emails:        via chaves i18n — zero texto hardcoded
```

---

## 16. QUALIDADE E GATES

### Quality Gates — universais (G01–G20)
```yaml
G01: pnpm lint                         → exit 0 (Biome)
G02: pnpm typecheck                    → exit 0 (tsc strict)
G03: pnpm build                        → exit 0
G04: pnpm test (unit + E2E Playwright) → exit 0
G05: pnpm test:coverage                → >= 70% (threshold)
G06: grep console.log apps/ --include="*.ts" | grep -v test → zero
G07: grep process.env apps/ --include="*.ts" | grep -v config → zero
G08: gitleaks detect --source=. --no-git --redact → zero
G09: grep ".then(" src/ | grep -v ".catch|await" → zero
G10: grep -rE "SELECT|INSERT|UPDATE|DELETE" apps/api/src/ --include="*.ts" | grep -v queries/ → zero
G11: grep -rn "statusCode|\"message\":" apps/api/src/handlers/ → zero (usa problemResponse)
G12: grep -rn "OFFSET" apps/ --include="*.ts" → zero
G13: grep -r '"strict"' tsconfig*.json → "strict": true presente
G14: npm audit --audit-level=high → exit 0
G15: pnpm build output < 300KB gzip
G16: semgrep --config=auto --error --json → zero HIGH/CRITICAL
G17: gitleaks detect --source=. --redact → zero (histórico)
G18: npm audit signatures → zero invalid
G19: pnpm lighthouse → LCP<2500 INP<200 CLS<0.1
G20: curl headers → CSP·HSTS·X-Frame·X-CTO·RP·PP
```

### Gates específicos desta stack (GS01–GS09)
```yaml
GS01: pnpm svelte-check → 0 errors, 0 warnings
GS02: pnpm wrangler types --check → sincronizado com wrangler.toml
GS03: zero classes Tailwind de cor/tipografia/forma em *.svelte
      rg "(bg|text|font|border|shadow|rounded|opacity|ring|divide)-" apps/web/src/
GS04: zero imports @inlang/paraglide-sveltekit
      rg "@inlang/paraglide-sveltekit" apps/
GS05: zero +server.ts em apps/api/
      find apps/api -name "+server.ts"
GS06: AppType exportado de apps/api/src/index.ts
      rg "export type AppType" apps/api/src/index.ts
GS07: zero packages de crypto proibidos
      rg "(\"bcrypt\"|\"argon2\"|\"scrypt-js\"|\"crypto-js\"|\"jsonwebtoken\")" apps/ packages/
GS08: zero process.env em apps/ e packages/
      rg "process\.env" apps/ packages/ --include="*.ts"
GS09: pass_hash nunca em respostas JSON (verificação manual)
      rg "pass_hash" apps/api/src/routes/ --include="*.ts"
```

### Verificações manuais (M01–M15)
```yaml
M01: Regras de negócio implementadas e testadas
M02: Auth verificada por handler (não só middleware global)
M03: Todas as FKs têm ON DELETE explícito
M04: Índice por cada FK
M05: 4 estados UI (loading·error·empty·populated) em todos os componentes de dados
M06: A11y manual (tab order, labels, modais, contraste WCAG AA)
M07: Zero texto hardcoded na UI
M08: Zero fetch() directo no frontend (tudo via api/client.ts)
M09: 4 camadas respeitadas + circuit breakers em chamadas externas
M10: Zero PII em logs
M11: Zero valores CSS hardcoded (hex, px avulso)
M12: /health/live + /health/ready respondem 200
M13: SIGTERM → exit ≤ 10s (graceful shutdown)
M14: SDK de monitorização inicializado com DSN via env var
M15: IDOR — ownership verificado antes de mutações
```

### Thresholds
```yaml
coverage:          70% mínimo
bundle_inicial:    < 300 KB gzip
lcp:               < 2500 ms
inp:               < 200 ms
cls:               < 0.1
wcag:              AA (bloqueante)
```

---

## 17. OBSERVABILIDADE

```yaml
workers:
  - observability.enabled: true (wrangler.toml)
  - head_sampling_rate: 1

app:
  - health: GET /health/live + GET /health/ready (M_penúltimo)
  - shutdown: SIGTERM → drena conexões → exit ≤ 10s
  - sentry_dsn: via env var SENTRY_DSN (opcional — activa SDK se presente)
  - unhandled: captura unhandledRejection via SDK

logs:
  - JSON estruturado com trace_id
  - zero PII em logs
  - zero console.log (usar logger estruturado)
```

---

## 18. COMPLIANCE E SUPPLY CHAIN

```yaml
compliance:
  rgpd:          true — exportação RGPD por utilizador (onRgpdExport)
  pii_logs:      zero — auditado pelo gate G10 + M10
  audit_log:     365 dias, append-only, sem dados pessoais
  retention:     activity_log 1 ano, notificações lidas 30 dias

supply_chain:
  registry:      registry npm público
  npmrc:         sem customização
  audit:         npm audit --audit-level=high após cada install
  signatures:    npm audit signatures após cada install
  sast:          semgrep --config=auto (G16)
  secrets_scan:  gitleaks detect (G08 + G17)
```

---

## 19. PROIBIÇÕES ABSOLUTAS (consolidadas)

### Packages proibidos
```yaml
- "@cloudflare/workers-types"            # usar wrangler types
- "@inlang/paraglide-sveltekit"          # deprecated
- "@sveltejs/adapter-cloudflare-workers" # deprecated
- "tailwindcss <4"                       # versão antiga
- "bits-ui 1.x"                          # sem suporte Svelte 5
- "eslint"                               # substituído por Biome
- "prettier"                             # substituído por Biome
- "bcrypt"                               # bindings C++ — não funciona no Workers
- "argon2"                               # bindings C++ — não funciona no Workers
- "@node-rs/argon2"                      # bindings Rust — não funciona no Workers
- "argon2-wasm-edge"                     # package abandonado
- "scrypt-js"                            # usar node:crypto nativo
- "crypto-js"                            # usar SubtleCrypto nativo
- "jsonwebtoken"                         # não funciona no Workers
- "express-session"                      # não aplicável ao Workers
- "passport"                             # não aplicável ao Workers
```

### Práticas proibidas
```yaml
- "+server.ts para lógica de API"         # usar Hono em apps/api/
- "+server.ts como bridge/catch-all"      # usar hooks.server.ts
- "process.env em runtime"                # usar c.env ou platform.env
- "SDKs npm para APIs externas"           # usar fetch directo
- "tipos runtime escritos à mão"          # usar wrangler types
- "queries inline em handlers/services"   # centralizar em db/queries/
- "PostCSS standalone com Tailwind 4"     # usar @tailwindcss/vite
- "pass_hash em respostas JSON"           # nunca expor hashes
- "passwords em logs"                     # nunca logar passwords
- "sessões em KV"                         # usar D1 (sessions table)
- "JWT stateless sem revogação"           # usar sessões com D1
- "comparação de hashes com ==="          # usar bcryptjs.compare() (timing-safe)
- "localStorage/sessionStorage"           # usar cookies httpOnly
- "Node.js 25.x em produção"             # não é LTS
- "OFFSET em paginação"                   # cursor-based obrigatório
- "any em TypeScript"                     # strict:true, sem any
- "console.log"                           # usar logger JSON + trace_id
- "hardcode de segredos"                  # via env vars / wrangler secrets
- "texto hardcoded na UI"                 # via messages/{lang}.json
- "hex/rgb hardcoded em componentes"      # via tokens CSS
- "fetch() directo no frontend"           # via api/client.ts
```

---

## 20. GIT STRATEGY

```yaml
branches:
  main:      produção (PRs obrigatórios, code review)
  develop:   integração contínua
  feature/*: novas funcionalidades
  fix/*:     correcções

commits:
  formato:   Conventional Commits
  tipos:     feat, fix, chore, docs, test, refactor, ci
  sem:       mensagens opacas

PRs:
  base:      main
  review:    obrigatório antes de merge
  squash:    recomendado
```

---

## 21. MÓDULOS — SISTEMA E CONTRATOS

```yaml
registo:      ficheiro de configuração central (modules.config.ts)
tabelas:      module_{module_id}_{table_name}
              primeiro campo: tenant_id (indexado)
rotas_api:    /api/modules/{module_id}/...
i18n:         messages/{lang}/module_{module_id}.json
handlers:
  - onUserDelete(userId, tenantId, db, r2)
  - onTenantDelete(tenantId, db, r2)
  - onBackup(tenantId, db) → BackupPayload
  - onRestore(tenantId, payload, db)
  - onRgpdExport(userId, tenantId, db) → RgpdPayload
  - onCronMaintenance(db, r2, env) → void (tolerante a falhas)

permissoes:
  admins:    acesso total a todos os módulos
  colaboradores: toggle por módulo (binário default) ou granular
  sem_permissao: módulo não aparece na navegação

limites:
  tenant_module_limits: criados automaticamente com defaults
  editáveis: super user na ficha da empresa
```

---

## 22. NOTAS CRÍTICAS DE IMPLEMENTAÇÃO

```yaml
nota_1_workers_paid:
  desc:  bcryptjs cost=12 requer Workers Paid plan
  razao: 30 000ms CPU/req (free plan = 10ms — hashing impossível)
  acao:  configurar plano pago antes de deploy em produção

nota_2_wrangler_types:
  desc:  executar pnpm wrangler types na PHASE_00 e após cada mudança no wrangler.toml
  razao: gera worker-configuration.d.ts com tipos correctos dos bindings
  acao:  commitar worker-configuration.d.ts — adicionar ao tsconfig compilerOptions.types

nota_3_svelte_check:
  desc:  svelte-check corre separadamente (Biome não valida .svelte)
  acao:  gate GS01 obrigatório em todos os milestones de frontend

nota_4_tokens_css:
  desc:  tokens.css é a fonte de verdade visual — zero hex/px em componentes
  path:  apps/web/src/styles/tokens.css
  acao:  gate GS03 verifica zero classes Tailwind visuais

nota_5_hono_delegation:
  desc:  ZERO +server.ts — toda a API em apps/api/ via hooks.server.ts
  acao:  gate GS05 verifica ausência de +server.ts em apps/api/

nota_6_migrations_dir:
  desc:  migrations_dir no wrangler.toml obrigatório se existirem Durable Objects
  acao:  verificar wrangler d1 migrations apply funciona sem conflito

nota_7_d1_id:
  desc:  database_id em wrangler.toml é PLACEHOLDER até wrangler d1 create ser executado
  acao:  substituir PLACEHOLDER_SUBSTITUIR_APOS_wrangler_d1_create na PHASE_00

nota_8_csrf_session_secrets:
  desc:  gerar com openssl rand -hex 32 (mínimo 64 hex chars)
  acao:  nunca commitar .dev.vars — usar .dev.vars.example com placeholders

nota_9_paraglide_path:
  desc:  código gerado em apps/web/src/paraglide/ — não editar manualmente
  importacao: import * as m from '$lib/paraglide/messages.js'
  proibido: @inlang/paraglide-sveltekit (deprecated)

nota_10_vite7_node24:
  desc:  vite 7.3.1 requer Node.js >= 24.14.0
  acao:  verificar node --version antes de pnpm install
```

---

*Fim do STACK_LOCK.md v1.1.0*
*Gerado pelo Architect em 2026-02-26*
*Actualizado 2026-02-26: tokens.css canónico (§14 expandido), mockup APROVADO, questionário técnico fechado*
*Próxima consulta: BUILD_PLAN.md para milestones*
