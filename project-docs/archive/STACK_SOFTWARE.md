# STACK_SOFTWARE.md
# Versão: 3.1.0
# Actualizado: 2026-02-26
# Tipo: template de input
# Lido EXCLUSIVAMENTE pelo Architect na FASE 0 e PHASE_00
# Após STACK_LOCK.md gerado e aprovado — este ficheiro é arquivado
# O Builder e o Verifier NUNCA consultam este ficheiro

---

## 1. IDENTIFICAÇÃO

```yaml
stack_id:  sveltekit_hono_cloudflare
frontend:  SvelteKit 2 + Svelte 5
api:       Hono
hosting:   Cloudflare Workers Static Assets
descricao: >
  Monorepo com SvelteKit como entry point do frontend e Hono
  como framework de API. Single-runtime, single-domain.
  A integração entre SvelteKit e Hono é feita via hooks.server.ts
  — definido na secção PADRÕES DE INTEGRAÇÃO.
```

---

## 2. PADRÕES DE INTEGRAÇÃO

O Architect extrai esta secção e popula STACK_LOCK.md
padroes_integracao. O Builder lê os padrões exclusivamente
do STACK_LOCK.md — nunca deste ficheiro.

### Frontend → API (delegação)

O SvelteKit delega todos os pedidos em /api/** para o Hono
através do ficheiro hooks.server.ts do SvelteKit.

```
ficheiro_integracao: apps/web/src/hooks.server.ts
ficheiro_api:        apps/api/src/index.ts
prefixo_delegado:    /api/**
```

Regras absolutas:
- ZERO ficheiros +server.ts para lógica de negócio ou API
- ZERO ficheiros +server.ts como catch-all ou bridge
- Toda a lógica de API vive exclusivamente em apps/api/
- hooks.server.ts é o único ponto de delegação
- Hono recebe Request nativo e devolve Response nativa
- Bindings Cloudflare passados via platform.env

### Frontend → API (cliente, type-safety)

```
tipo_exportado:   AppType (typeof honoApp) de apps/api/src/index.ts
cliente:          hono/client — hc<AppType>(location.origin)
ficheiro_cliente: apps/web/src/lib/api/client.ts
```

### Acesso a bindings Cloudflare

```
hooks.server.ts:  event.platform?.env
Hono (apps/api):  c.env
NUNCA:            process.env em runtime
```

### Entry point e output de build

```
entry_point:    .svelte-kit/cloudflare/_worker.js
build_output:   .svelte-kit/cloudflare
wrangler_main:  .svelte-kit/cloudflare/_worker.js
assets_dir:     .svelte-kit/cloudflare
```

---

## 3. ESTRUTURA DO MONOREPO

```
<nome-projecto>/
├── apps/
│   ├── web/                      ← SvelteKit 2 + Svelte 5
│   │   └── src/
│   │       ├── hooks.server.ts   ← único ponto de delegação para Hono
│   │       ├── routes/           ← apenas páginas UI (.svelte)
│   │       │   └── +error.svelte ← error boundary global
│   │       ├── lib/
│   │       │   └── api/
│   │       │       └── client.ts ← cliente RPC tipado (hono/client)
│   │       └── paraglide/        ← gerado automaticamente (i18n)
│   └── api/                      ← Hono (toda a lógica de API)
│       └── src/
│           ├── index.ts          ← app Hono + export AppType
│           ├── routes/
│           │   ├── auth/         ← login, logout, register
│           │   │   ├── login.ts
│           │   │   ├── logout.ts
│           │   │   └── register.ts
│           │   └── [dominio]/    ← rotas protegidas por domínio
│           ├── middleware/
│           │   ├── auth.ts       ← guard: valida sessão + popula c.var.user
│           │   ├── csrf.ts       ← valida CSRF token em mutações
│           │   └── rate-limit.ts ← Durable Object rate limiter
│           ├── lib/
│           │   ├── auth.ts       ← hashPassword, verifyPassword (bcryptjs)
│           │   ├── session.ts    ← createSession, getSession, deleteSession
│           │   └── csrf.ts       ← generateToken, verifyToken (HMAC)
│           └── db/
│               └── queries/      ← queries centralizadas (zero inline)
│                   ├── users.ts
│                   └── sessions.ts
├── packages/
│   └── shared/                   ← Zod schemas + tipos partilhados
├── migrations/
│   ├── 0001_auth.sql             ← users + sessions (ver STACK_RUNTIME §8)
│   └── ...                       ← SQL forward-only
├── design/
│   └── tokens.css                ← única fonte de verdade visual
├── messages/                     ← ficheiros i18n por língua
│   ├── pt.json
│   └── en.json
├── project.inlang/
│   └── settings.json             ← config i18n (línguas disponíveis)
├── wrangler.toml                 ← único, na raiz
├── turbo.json
├── pnpm-workspace.yaml
└── biome.json
```

---

## 4. DEPENDÊNCIAS — apps/api

### Produção
```yaml
hono:                  4.12.2
"@hono/zod-validator": 0.7.6
zod:                   4.3.6
bcryptjs:              2.4.3   # hashing de passwords — plano pago obrigatório
```

### Desenvolvimento
```yaml
wrangler:       4.68.1
typescript:     5.9.3
"@types/node":  22.x
"@types/bcryptjs": 2.4.6
vitest:         4.0.18
```

### Instalação
```bash
pnpm add hono @hono/zod-validator zod bcryptjs --filter @<nome>/api
pnpm add -D wrangler typescript @types/node @types/bcryptjs vitest \
  --filter @<nome>/api
```

---

## 5. DEPENDÊNCIAS — apps/web

### Produção
```yaml
svelte:                          5.53.5
"@sveltejs/kit":                 2.53.2
"@sveltejs/adapter-cloudflare":  7.2.8
tailwindcss:                     4.2.1
"@tailwindcss/vite":             4.2.1
bits-ui:                         2.16.2
"@inlang/paraglide-js":          2.12.0
hono:                            4.12.2
zod:                             4.3.6
```

### Desenvolvimento
```yaml
typescript:     5.9.3
svelte-check:   4.4.3
vite:           7.3.1       # requer Node.js >= 24.14.0
"@types/node":  22.x
```

### Instalação
```bash
pnpm add svelte @sveltejs/kit @sveltejs/adapter-cloudflare \
  tailwindcss @tailwindcss/vite bits-ui @inlang/paraglide-js \
  hono zod --filter @<nome>/web

pnpm add -D typescript svelte-check vite @types/node \
  --filter @<nome>/web
```

---

## 6. DEPENDÊNCIAS — packages/shared

### Produção
```yaml
zod: 4.3.6
```

### Desenvolvimento
```yaml
typescript: 5.9.3
```

---

## 7. DEPENDÊNCIAS — raiz do monorepo

### Desenvolvimento
```yaml
"@biomejs/biome":   2.4.4
turbo:              2.8.11
typescript:         5.9.3
vitest:             4.0.18
"@playwright/test": 1.58.2
```

### Instalação
```bash
pnpm add -D @biomejs/biome turbo typescript vitest \
  @playwright/test -w
```

---

## 8. FICHEIROS DE CONFIGURAÇÃO

### package.json (raiz) — engines obrigatório
```json
{
  "engines": {
    "node": ">=24.14.0",
    "pnpm": ">=10.0.0"
  }
}
```

Node 24 LTS — Active LTS até Abril 2028.
Node 25.x não é LTS (suporte termina Junho 2026) — não usar em produção.

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

### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".svelte-kit/**", "dist/**"]
    },
    "check":  { "dependsOn": ["^build"] },
    "lint":   {},
    "test":   { "dependsOn": ["^build"] },
    "dev":    { "cache": false, "persistent": true }
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
      "correctness": {
        "noFloatingPromises": "error"
      },
      "security": {
        "noGlobalEval": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

Nota: svelte-check corre separadamente para validação de
componentes Svelte. Biome não substitui svelte-check.

---

## 9. POLÍTICAS DE ESTILOS (token-first)

Tailwind 4 instalado via plugin Vite.
NUNCA via PostCSS standalone.

Política obrigatória:
- Tailwind usado APENAS para layout e estrutura
- PROIBIDO em componentes:
  bg-*, text-*, font-*, border-*, shadow-*,
  rounded-*, opacity-*, ring-*, divide-*
- Todos os valores visuais via design/tokens.css
  com CSS custom properties

---

## 10. POLÍTICAS DE i18n

Usar EXCLUSIVAMENTE @inlang/paraglide-js.
PROIBIDO: @inlang/paraglide-sveltekit (deprecated).

```
config:        project.inlang/settings.json
mensagens:     messages/{lingua}.json
codigo_gerado: apps/web/src/paraglide/ (auto-gerado — não editar)
```

Adicionar língua:
1. Editar project.inlang/settings.json
2. Criar messages/{nova-lingua}.json
3. ZERO alterações em componentes

---

## 11. GATES ESPECÍFICOS DESTA STACK

O Architect inclui estes gates em STACK_LOCK.md
gates_especificos. São executados pelo Verifier
a seguir aos gates universais G01–G20.

```yaml
gates_especificos:
  - id: GS01
    descricao: svelte-check sem erros
    comando: pnpm svelte-check

  - id: GS02
    descricao: wrangler types sincronizado com wrangler.toml
    comando: pnpm wrangler types --check

  - id: GS03
    descricao: zero classes Tailwind de cor/tipografia/forma
    comando: rg "(bg|text|font|border|shadow|rounded|opacity|ring|divide)-"
             src/routes src/lib --include="*.svelte"

  - id: GS04
    descricao: zero imports de @inlang/paraglide-sveltekit
    comando: rg "@inlang/paraglide-sveltekit" apps/

  - id: GS05
    descricao: zero ficheiros +server.ts em apps/api/
    comando: find apps/api -name "+server.ts"

  - id: GS06
    descricao: AppType exportado de apps/api/src/index.ts
    comando: rg "export type AppType" apps/api/src/index.ts

  - id: GS07
    descricao: zero imports de packages de crypto proibidos
    comando: rg "(\"bcrypt\"|\"argon2\"|\"scrypt-js\"|\"crypto-js\"|\"jsonwebtoken\")"
             apps/ packages/ --include="*.ts"

  - id: GS08
    descricao: zero process.env em apps/ e packages/
    comando: rg "process\.env" apps/ packages/ --include="*.ts"

  - id: GS09
    descricao: pass_hash nunca em respostas JSON
    comando: rg "pass_hash" apps/api/src/routes/ --include="*.ts"
             # verificar manualmente que nenhuma resposta expõe pass_hash
```

---

## 12. PROIBIÇÕES ABSOLUTAS

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
- "argon2-wasm-edge"                     # package abandonado — não usar
- "scrypt-js"                            # usar node:crypto nativo com nodejs_compat
- "crypto-js"                            # usar SubtleCrypto nativo
- "jsonwebtoken"                         # depende de Node crypto — não funciona
- "express-session"                      # não aplicável ao Workers runtime
- "passport"                             # não aplicável ao Workers runtime
```

### Práticas proibidas
```yaml
- "+server.ts para lógica de API"        # usar Hono em apps/api/
- "+server.ts como bridge/catch-all"     # usar hooks.server.ts
- "process.env em runtime"               # usar c.env ou platform.env
- "SDKs npm para APIs externas"          # usar fetch directo
- "tipos runtime escritos à mão"         # usar wrangler types
- "queries inline em handlers"           # centralizar em db/queries/
- "PostCSS standalone com Tailwind 4"    # usar @tailwindcss/vite
- "pass_hash em respostas JSON"          # nunca expor hashes
- "passwords em logs"                    # nunca logar passwords
- "sessões em KV"                        # usar D1 (sessions table)
- "JWT stateless sem revogação"          # usar sessões com D1
- "comparação de hashes com ==="         # bcryptjs.compare() é timing-safe
- "Node.js 25.x em produção"            # não é LTS — suporte termina Junho 2026
```

### Gestor de pacotes
```yaml
obrigatorio: pnpm
proibido:
  - bun
  - npm
  - yarn
```

---

## 13. VERSÕES — verificadas em 2026-02-26

| Package                        | Versão    | Estado    |
|--------------------------------|-----------|-----------|
| svelte                         | 5.53.5    | ✅ actual  |
| @sveltejs/kit                  | 2.53.2    | ✅ actual  |
| @sveltejs/adapter-cloudflare   | 7.2.8     | ✅ actual  |
| hono                           | 4.12.2    | ✅ actual  |
| zod                            | 4.3.6     | ✅ actual  |
| bcryptjs                       | 2.4.3     | ✅ actual  |
| bits-ui                        | 2.16.2    | ✅ actual  |
| tailwindcss / @tailwindcss/vite| 4.2.1     | ✅ actual  |
| @inlang/paraglide-js           | 2.12.0    | ✅ actual  |
| wrangler                       | 4.68.1    | ✅ actual  |
| vite                           | 7.3.1     | ✅ actual  |
| svelte-check                   | 4.4.3     | ✅ actual  |
| @biomejs/biome                 | 2.4.4     | ✅ actual  |
| turbo                          | 2.8.11    | ✅ actual  |
| vitest                         | 4.0.18    | ✅ actual  |
| @playwright/test               | 1.58.2    | ✅ actual  |
| Node.js (mínimo)               | 24.14.0   | ✅ LTS     |

Nota vite 7: suportado pelo SvelteKit desde kit@2.22.0 (Julho 2025).
Requer Node.js >= 24.14.0.

O Architect valida cada versão no registry npm antes de usar.
Após validação e aprovação humana, o STACK_LOCK.md passa a ser
a fonte de verdade das versões para este projecto.
Este ficheiro não é consultado após o STACK_LOCK.md estar gerado.
