# DEPLOY_HELP.md — Guia de Deploy do cf-base

> **LEITURA OBRIGATORIA** antes de qualquer build ou deploy.
> Este projecto faz deploy para **Cloudflare Workers** (NAO Pages).

---

## Arquitectura do Monorepo

```
webapp/                          <-- ROOT do monorepo (pnpm workspace)
  wrangler.toml                  <-- Config Cloudflare Workers (AQUI, nao em apps/web)
  project.inlang/settings.json   <-- Config i18n (Paraglide)
  messages/pt.json               <-- Traducoes PT (fonte)
  messages/en.json               <-- Traducoes EN
  migrations/                    <-- Migracoes D1
  .svelte-kit/cloudflare/        <-- OUTPUT DO BUILD (gerado aqui no root!)
    _worker.js                   <-- Worker final (gerado pelo adapter + inject-do.mjs)
    _app/                        <-- Assets estaticos
  apps/
    web/                         <-- SvelteKit frontend + SSR
      package.json               <-- Scripts: prebuild, build
      svelte.config.js           <-- adapter-cloudflare (modo Workers)
      vite.config.ts             <-- Vite + Tailwind + SvelteKit
      scripts/
        check-i18n-parity.mjs   <-- Verifica paridade pt/en (falha build se diff)
        inject-do.mjs           <-- Injeta RateLimiter no _worker.js pos-build
      src/lib/paraglide/         <-- Codigo gerado pelo Paraglide (NAO editar)
    api/                         <-- Hono API (so typecheck, nao tem build separado)
  packages/shared/               <-- Codigo partilhado
```

---

## Pontos Criticos

### 1. wrangler.toml esta no ROOT
- O `wrangler.toml` esta em `/home/user/webapp/`, NAO em `apps/web/`.
- O adapter-cloudflare le este ficheiro e ve `main` + `assets` → detecta **Workers** (nao Pages).
- O output vai para `ROOT/.svelte-kit/cloudflare/` (nao para `apps/web/.svelte-kit/cloudflare/`).

### 2. O deploy e' via `wrangler deploy` (NAO `wrangler pages deploy`)
- **CORRECTO**: `cd /home/user/webapp && npx wrangler deploy`
- **ERRADO**: `npx wrangler pages deploy dist`
- **ERRADO**: `cd apps/web && npx wrangler deploy` (caminhos relativos ficam errados)

### 3. Paraglide precisa ser compilado ANTES do vite build
- Quando se adicionam chaves a `messages/pt.json` e `messages/en.json`, o Paraglide
  precisa gerar os ficheiros JS correspondentes em `apps/web/src/lib/paraglide/`.
- O `prebuild` script em `apps/web/package.json` faz isto automaticamente.
- Para compilar manualmente: `cd apps/web && npx paraglide-js compile --project ../../project.inlang --outdir src/lib/paraglide`

### 4. inject-do.mjs injeta o Durable Object
- O adapter-cloudflare gera o `_worker.js` mas NAO inclui o `RateLimiter` (Durable Object).
- O script `apps/web/scripts/inject-do.mjs` adiciona a classe `RateLimiter` ao `_worker.js`.
- Isto e' feito automaticamente pelo build script: `"build": "vite build && node scripts/inject-do.mjs"`.

### 5. OOM durante o build
- O sandbox tem memoria limitada. O `turbo run build` pode causar OOM.
- **Solucao**: fazer build directo do `apps/web` com memoria limitada (ver comandos abaixo).
- Matar processos antes: `pm2 delete all; pkill -f node; sleep 2`

---

## Comandos de Deploy (Copiar e Colar)

### Deploy completo (passo a passo)

```bash
# 0. Limpar processos para libertar memoria
pm2 delete all 2>/dev/null; pkill -f node 2>/dev/null; sleep 2

# 1. Compilar Paraglide (necessario apos alterar messages/*.json)
cd /home/user/webapp/apps/web && npx paraglide-js compile --project ../../project.inlang --outdir src/lib/paraglide

# 2. Limpar output anterior
rm -rf /home/user/webapp/.svelte-kit/cloudflare /home/user/webapp/.svelte-kit/cloudflare-tmp /home/user/webapp/apps/web/.svelte-kit/cloudflare-tmp

# 3. Build (vite + adapter-cloudflare)
cd /home/user/webapp/apps/web && NODE_OPTIONS="--max-old-space-size=450" npx vite build

# 4. Injectar Durable Object (RateLimiter)
cd /home/user/webapp && node apps/web/scripts/inject-do.mjs

# 5. Deploy para Cloudflare Workers
cd /home/user/webapp && npx wrangler deploy
```

### Deploy rapido (1 comando)

```bash
pm2 delete all 2>/dev/null; pkill -f node 2>/dev/null; sleep 2 && \
cd /home/user/webapp/apps/web && npx paraglide-js compile --project ../../project.inlang --outdir src/lib/paraglide && \
rm -rf /home/user/webapp/.svelte-kit/cloudflare /home/user/webapp/.svelte-kit/cloudflare-tmp && \
NODE_OPTIONS="--max-old-space-size=450" npx vite build && \
cd /home/user/webapp && node apps/web/scripts/inject-do.mjs && \
npx wrangler deploy
```

---

## Checklist Pre-Deploy

- [ ] `messages/pt.json` e `messages/en.json` tem as mesmas chaves (o prebuild verifica)
- [ ] Nenhuma chave i18n nova sem `paraglide-js compile` executado
- [ ] Codigo compila sem erros TypeScript
- [ ] Nao ha emojis nos ficheiros de traducao
- [ ] `wrangler.toml` esta no root e aponta para `.svelte-kit/cloudflare/_worker.js`

---

## Erros Comuns

| Erro | Causa | Solucao |
|------|-------|---------|
| `"xxx" is not exported by messages.js` | Paraglide nao foi recompilado apos adicionar chave | `cd apps/web && npx paraglide-js compile --project ../../project.inlang --outdir src/lib/paraglide` |
| `ENOENT .svelte-kit/cloudflare/_worker.js` | Build nao correu ou correu no directorio errado | Fazer build a partir de `apps/web`, verificar que output vai para root |
| `RateLimiter is not exported` | `inject-do.mjs` nao correu apos o build | `cd /home/user/webapp && node apps/web/scripts/inject-do.mjs` |
| Exit code 137 (OOM) | Pouca memoria no sandbox | Matar processos: `pm2 delete all; pkill -f node`, usar `--max-old-space-size=450` |
| `wrangler pages deploy` falha | Este projecto usa Workers, nao Pages | Usar `npx wrangler deploy` a partir do ROOT |
| Cookie de tema nao persiste | Mismatch nomes de cookie | Client usa `cf_layout/cf_theme/cf_palette`, server deve ler os mesmos |
| Build OK mas `cloudflare/` vazio | adapter nao encontrou wrangler.toml | Verificar que wrangler.toml esta no root e tem `main` + `[assets]` |

---

## Bindings em Producao

| Binding | Tipo | Nome |
|---------|------|------|
| `DB` | D1 Database | `cf-base-db` |
| `R2_BUCKET` | R2 Bucket | `cf-base-storage` |
| `RATE_LIMITER` | Durable Object | `RateLimiter` |
| `ASSETS` | Static Assets | `.svelte-kit/cloudflare` |
| `APP_ENV` | Env Var | `"production"` |
| `APP_URL` | Env Var | `https://cf-base.acemang-jedi.workers.dev` |

### Secrets (via `wrangler secret put`)
- `CSRF_SECRET` — `openssl rand -hex 32`
- `SESSION_SECRET` — `openssl rand -hex 32`
- `ENCRYPTION_KEY` — AES-256-GCM (32 bytes hex)

---

## URL de Producao

**https://cf-base.acemang-jedi.workers.dev**
