# Guia Definitivo: Localhost em Monorepo SvelteKit + Cloudflare Workers (Hono)

> [!IMPORTANT]
> Este documento descreve como configurar o ambiente de desenvolvimento local para um monorepo com SvelteKit (frontend) + Hono API (Cloudflare Workers). Segue este guia antes de qualquer tentativa de `pnpm run dev`.

## Arquitectura do Monorepo

```
raiz/
├── wrangler.toml          ← Config Cloudflare (partilhada)
├── .dev.vars              ← Segredos locais (CSRF_SECRET, etc.)
├── migrations/            ← SQL migrations D1
├── .wrangler/state/       ← DB raiz (usada pelo `wrangler` CLI na raiz)
├── apps/
│   ├── api/               ← Hono API (Cloudflare Worker)
│   │   ├── src/index.ts
│   │   └── package.json   ← "dev": "wrangler dev src/index.ts"
│   └── web/               ← SvelteKit frontend (adapter-cloudflare)
│       ├── src/
│       │   └── hooks.server.ts  ← Delega /api/* para Hono inline
│       ├── .wrangler/state/     ← DB LOCAL DO WEB (separada!)
│       └── package.json
└── packages/shared/
```

## Problema #1: Duas Bases de Dados D1 Locais

> [!CAUTION]
> O `adapter-cloudflare` do SvelteKit cria a sua **própria instância D1 local** em `apps/web/.wrangler/state/`. Esta é **diferente** da DB em `.wrangler/state/` na raiz. As migrações precisam de ser aplicadas a **ambas**.

### Solução: Aplicar migrações à DB do Web

```bash
cd apps/web
npx wrangler d1 migrations apply cf-base-db --local --persist-to=.wrangler/state
```

E à DB da raiz (usada pelo `turbo run dev`):
```bash
cd raiz-do-projeto
npx wrangler d1 migrations apply cf-base-db --local
```

### Seed de utilizador de teste

Criar ficheiro `apps/api/seed.sql`:
```sql
INSERT INTO users (id, email, pass_hash, role) 
VALUES ('user-admin-123', 'admin@example.com', '<bcrypt_hash>', 'super_user');
```

Gerar o hash bcrypt:
```bash
cd apps/api
node -e "require('bcryptjs').hash('SenhaForte123!', 10).then(h => console.log(h))"
```

Aplicar seed a **ambas** as DBs:
```bash
# DB do web
npx wrangler d1 execute cf-base-db --local --persist-to=apps/web/.wrangler/state --file=apps/api/seed.sql

# DB da raiz
npx wrangler d1 execute cf-base-db --local --file=apps/api/seed.sql
```

## Problema #2: Segredos (CSRF_SECRET, SESSION_SECRET, ENCRYPTION_KEY)

> [!CAUTION]
> Sem `.dev.vars`, o Hono falha com `DataError: Zero-length key is not supported` no endpoint `/api/auth/csrf`.

### Solução: Criar `.dev.vars` na raiz do projecto

```bash
# Na raiz do monorepo (NÃO dentro de apps/)
cat > .dev.vars << 'EOF'
CSRF_SECRET="43657274616d656e74656f717565657374616368617665656d7569746f736567"
SESSION_SECRET="43657274616d656e74656f717565657374616368617665656d7569746f736567"
ENCRYPTION_KEY="43657274616d656e74656f717565657374616368617665656d7569746f736567"
EOF
```

> [!NOTE]
> O ficheiro `.dev.vars` é lido pelo Wrangler da raiz do projecto (onde está o `wrangler.toml`). Tanto o `apps/web` como o `apps/api` referenciam-no via path relativo `../../.dev.vars`.

## Problema #3: SvelteKit `hooks.server.ts` e delegação de API

O `hooks.server.ts` delega pedidos `/api/*` para o Hono inline (não via proxy HTTP). Em produção (Cloudflare), `event.platform.env` contém os bindings D1, R2, etc. Em dev local, o `adapter-cloudflare` simula estes bindings usando miniflare.

```typescript
// hooks.server.ts — NÃO usar proxy, usar inline Hono
export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/api/")) {
    const app = createHonoApp();
    const env = (event.platform as any)?.env;
    return app.fetch(event.request, env);
  }
  // ... resto do handle
};
```

> [!WARNING]
> NUNCA usar proxy HTTP (`fetch("http://127.0.0.1:8787/...")`) no hooks.server.ts. O adaptador Cloudflare já fornece `platform.env` localmente via miniflare. Usar proxy só funciona se o `wrangler dev` da API estiver simultaneamente a correr (e cria conflitos de DB).

## Problema #4: Svelte 5 e `$page` vs `page`

> No Svelte 5, `import { page } from "$app/state"` NÃO usa prefixo `$`. Usar `page.url` directamente, nunca `$page.url`.

```svelte
<!-- CORRECTO Svelte 5 -->
<script>
  import { page } from "$app/state";
</script>
{#if page.url.searchParams.has("reset")}
```

## Problema #5: `wrangler.toml` `main` aponta para SvelteKit

O `wrangler.toml` na raiz tem `main = ".svelte-kit/cloudflare/_worker.js"`.
Quando o `wrangler dev` da API corre, tenta usar este ficheiro que não existe no contexto da API.

### Solução: Override no script dev da API

```json
// apps/api/package.json
{
  "scripts": {
    "dev": "wrangler dev src/index.ts --persist-to=../../.wrangler/state"
  }
}
```

## Checklist Rápido (Copiar-Colar)

```bash
# 1. Criar .dev.vars na raiz
echo 'CSRF_SECRET="<64-char-hex>"' > .dev.vars
echo 'SESSION_SECRET="<64-char-hex>"' >> .dev.vars
echo 'ENCRYPTION_KEY="<64-char-hex>"' >> .dev.vars

# 2. Aplicar migrações à DB do web
npx wrangler d1 migrations apply <DB_NAME> --local --persist-to=apps/web/.wrangler/state

# 3. Aplicar migrações à DB raiz
npx wrangler d1 migrations apply <DB_NAME> --local

# 4. Seed de utilizador (ambas DBs)
npx wrangler d1 execute <DB_NAME> --local --persist-to=apps/web/.wrangler/state --file=apps/api/seed.sql
npx wrangler d1 execute <DB_NAME> --local --file=apps/api/seed.sql

# 5. Arrancar (qualquer opção)
npm run dev              # da raiz (turbo: web + api)
cd apps/web && npm run dev  # só frontend (API inline via Hono)
```

## Modo de Execução Recomendado

| Comando | De onde | O que faz |
|---------|---------|-----------|
| `npm run dev` | Raiz | Turbo arranca `web` + `api` em paralelo |
| `npm run dev` | `apps/web` | Só frontend, API inline via Hono usando `platform.env` do adaptador CF |
| `npm run dev` | `apps/api` | Só API standalone na porta 8787 |

> Para desenvolvimento frontend, basta correr de `apps/web`. O adaptador Cloudflare já simula todos os bindings D1/R2/secrets localmente. Não precisas de correr a API separadamente.
