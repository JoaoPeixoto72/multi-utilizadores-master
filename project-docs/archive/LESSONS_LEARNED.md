# LESSONS_LEARNED.md — cf-base
# Propósito: todos os problemas e bugs encontrados — contexto, causa, solução, regra de prevenção
# NÃO colocar aqui: estado actual (→ KNOWLEDGE.md), artefactos (→ RUNLOG.md), testes (→ TESTS_LOG.md)
# Formato obrigatório: ### LL-NN — [TÍTULO CURTO] — [DATA]
# Actualizar: quando se encontra e resolve qualquer problema, por mais pequeno que seja

---

### LL-01 — Migration ADD COLUMN não actualiza linhas existentes — 2026-02-26

**Milestone:** M1  
**Contexto:** Ao adicionar `role TEXT NOT NULL DEFAULT 'collaborator'` via `ALTER TABLE ... ADD COLUMN`, utilizadores já existentes ficaram com o valor padrão em vez do valor correcto para o seu papel.  
**Sintoma:** Utilizadores antigos com `role = 'collaborator'` mesmo sendo super_user criado antes da coluna existir.  
**Causa Raiz:** `ALTER TABLE ADD COLUMN` com `DEFAULT` apenas aplica o valor a novas linhas. Linhas existentes ficam com o valor padrão da coluna, independentemente do contexto de negócio.  
**Solução Aplicada:** Adicionar `UPDATE users SET role = 'super_user' WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)` imediatamente após o `ADD COLUMN` na migration.  
**Ficheiros afectados:** `migrations/0002_auth_extended.sql`  
**Regra de prevenção:** Toda a migration que adiciona coluna com valor dependente de role/status DEVE incluir `UPDATE` para linhas existentes. O valor de `DEFAULT` é para novas linhas — nunca para dados históricos.

---

### LL-02 — Password de super_user desconhecida após correcção de dados — 2026-02-26

**Milestone:** M2 deploy  
**Contexto:** Após várias iterações de setup e reset durante o desenvolvimento, a password do super_user ficou num estado desconhecido.  
**Sintoma:** `POST /api/auth/login` → 401 Unauthorized mesmo com password que parecia correcta.  
**Causa Raiz:** A coluna `pass_hash` foi populada com um hash de bcrypt inválido durante um teste manual, tornando qualquer tentativa de login impossível sem reset directo à BD.  
**Solução Aplicada:**
1. Gerar hash bcryptjs localmente: `node -e "require('bcryptjs').hash('Teste1234!@', 12).then(console.log)"`
2. Actualizar D1 remoto: `wrangler d1 execute cf-base-db --remote --command="UPDATE users SET pass_hash = '...' WHERE email = 'acemang@gmail.com'"`  
**Ficheiros afectados:** dados na BD remota  
**Regra de prevenção:** Documentar passwords de utilizadores de teste imediatamente no KNOWLEDGE.md §Credenciais de Teste. Ver também LL-20.

---

### LL-03 — `redirect()` do SvelteKit engolido por `try/catch` — 2026-02-27

**Milestone:** M2  
**Contexto:** Em `+page.server.ts` de `/setup` e `/login`, o código de load/actions estava envolto em `try/catch` para capturar erros de API. O `redirect()` do SvelteKit lança internamente uma excepção do tipo `Redirect`.  
**Sintoma:** `/setup` continuava a mostrar o formulário mesmo após setup já concluído. O utilizador ficava em loop.  
**Causa Raiz:** `redirect(302, '/login')` lança uma excepção que é capturada pelo `catch {}` envolvente antes de ser propagada ao runtime do SvelteKit. O SvelteKit nunca recebe a instrução de redirect.  
**Solução Aplicada:**
```typescript
import { isRedirect } from '@sveltejs/kit';
try {
  // lógica
} catch (e) {
  if (isRedirect(e)) throw e;  // ← OBRIGATÓRIO
  // tratar outros erros
}
```
**Ficheiros afectados:** `apps/web/src/routes/(auth)/setup/+page.server.ts`, `(auth)/login/+page.server.ts`  
**Regra de prevenção:** Qualquer `try/catch` em `+page.server.ts` ou `hooks.server.ts` que possa conter `redirect()` ou `error()` DEVE ter `if (isRedirect(e) || isHttpError(e)) throw e` como primeira linha do `catch`.

---

### LL-04 — wrangler.toml com configurações de Pages em projecto Workers — 2026-02-26

**Milestone:** M1 deploy  
**Contexto:** O `wrangler.toml` inicial foi gerado com `pages_build_output_dir` e sintaxe de Durable Objects de versões antigas, compatíveis apenas com Cloudflare Pages.  
**Sintoma:** `wrangler deploy` falhava com erros de campo inválido; deploy ia para o projecto errado.  
**Causa Raiz:** `pages_build_output_dir` é um campo exclusivo do modelo de Pages. Em Workers Static Assets, o output é definido pela configuração `[assets]`. A sintaxe `[[durable_objects.migrations]]` também é antiga.  
**Solução Aplicada:** Remover `pages_build_output_dir`, usar `[assets] directory = ".svelte-kit/cloudflare"`, corrigir Durable Objects para `[[durable_objects.bindings]]` + `[[migrations]]`.  
**Ficheiros afectados:** `wrangler.toml`  
**Regra de prevenção:** Ver KNOWLEDGE.md §11 para campos válidos. NUNCA usar `wrangler pages deploy`. SEMPRE `wrangler deploy` na raiz do monorepo.

---

### LL-05 — `enhance` com `update()` não processa redirects — 2026-02-27

**Milestone:** M2  
**Contexto:** Formulários de login, setup e convite usavam `use:enhance` com o callback padrão que chama `update()`. Após submissão bem-sucedida com redirect de servidor, a página não navegava.  
**Sintoma:** Formulário submetia (POST 303), mas o browser ficava na mesma página sem navegar.  
**Causa Raiz:** `update()` dentro do callback de `enhance` re-executa o load da página actual, mas não processa redirects. Para navegar para outro URL, é necessário interceptar o resultado e chamar `goto()` manualmente.  
**Solução Aplicada:**
```typescript
use:enhance={async ({ formData }) => {
  return async ({ result }) => {
    if (result.type === 'redirect') {
      await goto(result.location);
    } else {
      await update();
    }
  };
}}
```
**Ficheiros afectados:** `apps/web/src/routes/(auth)/login/+page.svelte`, `setup/+page.svelte`, `invite/[token]/+page.svelte`, `(super)/super/tenants/new/+page.svelte`  
**Regra de prevenção:** Em qualquer formulário com `use:enhance` que possa receber redirect do servidor, SEMPRE usar `{ result }` + `goto(result.location)`.

---

### LL-06 — SvelteKit `cookies.set()` URL-encoda o valor do cookie — 2026-02-27

**Milestone:** M2  
**Contexto:** A sessão é guardada num cookie com valor contendo `:` (separador `sessionId:userId`). O SvelteKit ao fazer `cookies.set()` URL-encoda automaticamente o valor, transformando `:` em `%3A`.  
**Sintoma:** `GET /api/auth/me` retornava 401 imediatamente após login bem-sucedido. O cookie estava presente mas o token extraído era inválido.  
**Causa Raiz:** Hono lia o cookie com `c.req.header('cookie')` e fazia `split('=')[1]`, obtendo o valor URL-encoded. Ao comparar com o token em D1 (não encoded), a verificação falhava sempre.  
**Solução Aplicada:** Adicionar `decodeURIComponent()` na função `extractSessionToken()` em `apps/api/src/lib/session.ts`.  
**Ficheiros afectados:** `apps/api/src/lib/session.ts`, `apps/api/src/tests/session.test.ts`  
**Regra de prevenção:** `extractSessionToken()` DEVE sempre fazer `decodeURIComponent` antes de usar o valor do cookie. Nunca remover esta linha.

---

### LL-07 — Chaves i18n em `messages.js` não reflectem ficheiro fonte — 2026-02-27

**Milestone:** M3  
**Contexto:** Adicionadas novas chaves a `messages/pt.json` para M3, mas `src/lib/paraglide/messages.js` (ficheiro compilado) não foi regenerado.  
**Sintoma:** Runtime error ao tentar usar `m.nova_chave` — função não existia em `messages.js`.  
**Causa Raiz:** `@inlang/paraglide-js` compila as chaves de `messages/*.json` para `src/lib/paraglide/messages.js`. Este processo só corre automaticamente no `prebuild` — não em desenvolvimento incremental.  
**Solução Aplicada:** Adicionar script `prebuild` em `apps/web/package.json`: `"prebuild": "paraglide-js compile --project ./project.inlang"`. Adicionado stub manual para desenvolvimento imediato.  
**Ficheiros afectados:** `apps/web/package.json`, `apps/web/src/lib/paraglide/messages.js`  
**Regra de prevenção:** Após qualquer adição a `messages/pt.json` ou `messages/en.json`, executar `paraglide-js compile` antes de usar as novas chaves. O `prebuild` garante que o build de produção nunca falha.

---

### LL-08 — Svelte 5: valores reactivos fora de contexto `$derived` geram warnings — 2026-02-27

**Milestone:** M3  
**Contexto:** Em Svelte 5, variáveis declaradas com `let` que dependem de `$state` ou `data` do load não são reactivas automaticamente — geram warnings em runtime.  
**Sintoma:** Warning no browser: "state_referenced_locally" — variável perde sincronização com o estado pai.  
**Causa Raiz:** Em Svelte 5, o compilador exige que dependências reactivas sejam explicitamente declaradas com `$derived(...)`. `let x = data.user` cria uma cópia snapshot, não um valor reactivo.  
**Solução Aplicada:** Substituir `let x = data.user` por `const x = $derived(data.user)` em todos os componentes afectados.  
**Ficheiros afectados:** `apps/web/src/routes/(admin)/+layout.svelte`, `team/+page.svelte`  
**Regra de prevenção:** Em Svelte 5, qualquer variável que dependa de `$state`, `$props()`, ou `data` do load deve ser declarada com `$derived(...)`.

---

### LL-09 — `+page.svelte` raiz acede a `data.user` mas load retorna `never` — 2026-02-27

**Milestone:** M3  
**Contexto:** O `+page.svelte` raiz (`/`) apenas faz redirect via load (`throw redirect(...)`), nunca retorna dados. O componente tentava aceder a `data.user`.  
**Sintoma:** TypeScript error: "Property 'user' does not exist on type 'never'".  
**Causa Raiz:** Quando um `+page.server.ts` sempre faz `throw redirect()`, o tipo de retorno inferido pelo SvelteKit é `never`. O `+page.svelte` associado não deve aceder a `data`.  
**Solução Aplicada:** Remover toda a referência a `data` no `+page.svelte` raiz (a página nunca chega a renderizar — é sempre redirect).  
**Ficheiros afectados:** `apps/web/src/routes/+page.svelte`  
**Regra de prevenção:** Se um `+page.server.ts` só contém redirects, o `+page.svelte` correspondente não deve referenciar `data`. Usar `export let data: PageData` só quando existe conteúdo a renderizar.

---

### LL-10 — Import não usado detectado pelo Biome como erro bloqueador — 2026-02-27

**Milestone:** M3/M4  
**Contexto:** Durante desenvolvimento incremental, imports de tipos e funções foram adicionados ao ficheiro mas não usados na versão final. O Biome classifica isso como erro (não warning).  
**Sintoma:** Gate G01 falhava com "noUnusedImports" mesmo sem erros funcionais.  
**Causa Raiz:** A configuração do Biome em `biome.json` trata `noUnusedImports` como error severity, bloqueando o gate.  
**Solução Aplicada:** `pnpm exec biome check --write --unsafe src/` — remove automaticamente imports não usados e corrige formatação.  
**Ficheiros afectados:** Vários ficheiros durante M3/M4  
**Regra de prevenção:** Antes de qualquer commit, correr sempre `biome check --write --unsafe src/` para auto-correcção. Nunca commitar sem passar G01.

---

### LL-11 — Hono `use("/profile*")` não faz match de `/profile` exacto — 2026-02-27

**Milestone:** M5  
**Contexto:** O middleware de autenticação foi registado com `app.use("/profile*", authMiddleware)` para cobrir todos os endpoints de perfil.  
**Sintoma:** `GET /api/user/profile` (sem o `*`) não passava pelo middleware — retornava 200 sem verificar sessão.  
**Causa Raiz:** Em Hono, `"/profile*"` faz match de `/profile/algo` mas NÃO de `/profile` exacto (sem trailing slash ou segmento extra).  
**Solução Aplicada:**
```typescript
app.use("/profile", authMiddleware);
app.use("/profile/*", authMiddleware);
```
**Ficheiros afectados:** `apps/api/src/routes/user/index.ts`  
**Regra de prevenção:** Para proteger um path exacto E os seus sub-paths em Hono, registar o middleware duas vezes: uma para o path exacto e outra com `*`.

---

### LL-12 — CSRF `maxAge=0` com `>` em vez de `>=` — 2026-02-27

**Milestone:** M5  
**Contexto:** O token CSRF gerado com `maxAge=0` (para testes) falhava a validação imediatamente após geração.  
**Sintoma:** Token CSRF válido retornava erro "token expired" mesmo milissegundos após ser gerado.  
**Causa Raiz:** A condição de expiração usava `Date.now() - tokenTs > maxAge * 1000`. Com `maxAge=0`, `Date.now() - tokenTs > 0` é `false` no mesmo milissegundo mas `true` 1ms depois. A condição correcta para TTL inclusivo é `>=`.  
**Solução Aplicada:** Alterar `>` para `>=` na comparação de expiração: `if (elapsed >= maxAgeMs)`.  
**Ficheiros afectados:** `apps/api/src/lib/csrf.ts`  
**Regra de prevenção:** Comparações de expiração por tempo (TTL, maxAge, expires_at): usar `>=` para boundary inclusivo, nunca `>`.

---

### LL-13 — GET /logout não existia: link `<a href="/logout">` dava 404 — 2026-02-27

**Milestone:** M5  
**Contexto:** O sidebar do layout admin tinha um link `<a href="/logout">` que esperava uma rota SvelteKit para fazer logout.  
**Sintoma:** Clicar em "Logout" dava 404 Not Found.  
**Causa Raiz:** `/logout` não é uma rota SvelteKit — a lógica de logout é uma action de form POST para `/api/auth/logout`. Não existe (nem deve existir) uma página GET `/logout`.  
**Solução Aplicada:** Substituir o link `<a>` por um formulário com `action="/api/auth/logout"` e `method="post"` com token CSRF.  
**Ficheiros afectados:** `apps/web/src/routes/(admin)/+layout.svelte`  
**Regra de prevenção:** Qualquer `<a href="/X">` ou `<button>` de navegação deve ter a rota SvelteKit verificada antes de deploy. Actions destrutivas (logout, delete) devem ser sempre `POST` com CSRF.

---

### LL-14 — `DEFAULT 'active'` em migration cria tenant já activo sem confirmação — 2026-02-27

**Milestone:** M2 fix  
**Contexto:** A tabela `tenants` foi criada com `status TEXT DEFAULT 'active'`. Novos tenants criados pelo super user apareciam imediatamente como activos.  
**Sintoma:** Tenant criado via `POST /api/super/tenants` ficava `active` em vez de `pending` (aguardando email de confirmação do owner).  
**Causa Raiz:** O INSERT não especificava a coluna `status`, usando o DEFAULT da tabela. O DEFAULT devia ser `'pending'` para reflectir o fluxo de negócio correcto.  
**Solução Aplicada:** Migration `0006_tenant_pending_status.sql` com `DEFAULT 'pending'`. `createTenant()` actualizado para definir `status` explicitamente.  
**Ficheiros afectados:** `migrations/0006_tenant_pending_status.sql`, `apps/api/src/db/queries/tenants.ts`  
**Regra de prevenção:** O valor de `DEFAULT` de uma coluna de estado deve reflectir o PRIMEIRO estado do fluxo de negócio. INSERTs em código devem SEMPRE definir `status` explicitamente.

---

### LL-15 — Coluna "Admin / Sócios" mostrava limites da licença, não utilizadores reais — 2026-02-27

**Milestone:** M2 fix  
**Contexto:** A listagem de empresas no dashboard super user mostrava a coluna "Utilizadores" com o valor `admin_seat_limit` em vez do número real de utilizadores activos.  
**Sintoma:** Empresa com 0 utilizadores reais mostrava "3" (o limite da licença).  
**Causa Raiz:** A query `listTenants()` retornava os campos `admin_seat_limit` e `member_seat_limit` mas não fazia JOIN com a tabela `users` para contar utilizadores reais.  
**Solução Aplicada:** Adicionar subquery ao `listTenants()`: `(SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND status != 'deleted') AS user_count`.  
**Ficheiros afectados:** `apps/api/src/db/queries/tenants.ts`, `apps/web/src/routes/(super)/super/tenants/+page.svelte`, `+page.server.ts`  
**Regra de prevenção:** Colunas de contagem de entidades DEVEM usar JOIN/subquery na BD. NUNCA usar campos de limite/capacidade para mostrar contagens reais no frontend.

---

### LL-16 — Migration DROP+RENAME de tabela zerou FK em tabela filho — 2026-02-27

**Milestone:** M5 fix  
**Contexto:** A migration `0006_tenant_pending_status.sql` usou o padrão SQLite de recriar tabela: `CREATE TABLE tenants_new`, copiar dados, `DROP TABLE tenants`, `ALTER TABLE tenants_new RENAME TO tenants`. Com `PRAGMA foreign_keys = OFF`.  
**Sintoma:** Após aplicar, o utilizador `joaopeixoto@hotmail.com` passou a ter `tenant_id = null`. O `user_count` da empresa ficou 0.  
**Causa Raiz:** A execução remota via `wrangler d1 migrations apply --remote` com `PRAGMA foreign_keys = OFF` + DROP+RENAME provocou re-processamento interno que zerou `tenant_id` do utilizador inserido manualmente fora das migrations.  
**Solução Aplicada:** `UPDATE users SET tenant_id = '0468...' WHERE email = 'joaopeixoto@hotmail.com'`  
**Ficheiros afectados:** dados na BD remota  
**Regra de prevenção:** Após migration com DROP+RENAME, verificar imediatamente integridade referencial: `SELECT COUNT(*) FROM users WHERE tenant_id IS NULL AND role != 'super_user'`. Preferir `ALTER TABLE ... ADD COLUMN` sempre que possível.

---

### LL-17 — Hono sub-router registado no caminho completo em vez do prefixo pai — 2026-02-27

**Milestone:** M7  
**Contexto:** O `superIntegrationsRouter` foi registado com `app.route("/api/super/integrations", superIntegrationsRouter)`. As rotas internas do router eram `/integrations`, `/integrations/:id`, etc.  
**Sintoma:** `GET /api/super/integrations` retornava `404 Route not found` em produção.  
**Causa Raiz:** Quando um sub-router Hono é montado em `/api/super/integrations` e define rotas como `/integrations`, o path resultante é `/api/super/integrations/integrations` — duplicado. O padrão correcto é montar no prefixo pai com rotas internas que incluem o segmento completo.  
**Solução Aplicada:** Montar em `/api/super` (prefixo pai), rotas internas definidas como `/integrations`, `/integrations/:id`, `/integrations/:id/test`, etc. — igual ao `superTenantsRouter`.  
**Ficheiros afectados:** `apps/api/src/routes/super/integrations.ts`, `apps/api/src/index.ts`  
**Regra de prevenção:** Sub-routers Hono SEMPRE montados no prefixo pai. Rotas internas definem o segmento completo a partir do prefixo. Ver padrão do `superTenantsRouter` como referência.

---

### LL-18 — Turbo cache impediu alterações em apps/api de chegar ao `_worker.js` — 2026-02-27

**Milestone:** M7  
**Contexto:** Após corrigir o registo das rotas de integrações em `apps/api`, vários deploys consecutivos continuaram a retornar 404. O código corrigido não aparecia no worker.  
**Sintoma:** `GET /api/super/integrations` → 404 após deploy. `grep "integrations" _worker.js` → zero matches.  
**Causa Raiz:** Turbo usa hash de inputs para cache. Alterações em `apps/api/src/routes/super/integrations.ts` (importado em `hooks.server.ts` via `createHonoApp()`) não foram detectadas como input do task `build` de `apps/web`. O `_worker.js` era gerado a partir da cache anterior.  
**Solução Aplicada:** `rm -rf .svelte-kit` + build directo em `apps/web` (sem Turbo) + `wrangler deploy`.  
**Ficheiros afectados:** `.svelte-kit/cloudflare/_worker.js` (output)  
**Regra de prevenção:** Após alterar código em `apps/api` importado por `hooks.server.ts`, sempre executar `rm -rf .svelte-kit` antes do build para forçar cache miss no Turbo.

---

### LL-19 — Zod v3: `z.record()` requer dois argumentos para `Record<string,string>` — 2026-02-27

**Milestone:** M7  
**Contexto:** Schemas de criação/actualização de integrações usavam `z.record(z.string())` para representar credenciais `Record<string, string>`.  
**Sintoma:** TypeScript error TS2554: "Expected 2-3 arguments, got 1".  
**Causa Raiz:** Em Zod v3, `z.record(z.string())` infere `ZodRecord<ZodString, ZodUnknown>` → `Record<string, unknown>`. Para `Record<string, string>` é obrigatório passar dois argumentos: chave e valor.  
**Solução Aplicada:** `z.record(z.string(), z.string())` — dois argumentos explícitos.  
**Ficheiros afectados:** `apps/api/src/routes/super/integrations.ts`  
**Regra de prevenção:** Em Zod v3, `z.record(valueSchema)` → `Record<string, unknown>`. Para dicionários de strings usar SEMPRE `z.record(z.string(), z.string())`.

---

### LL-20 — Password de super_user não documentada durante testes de M7 — 2026-02-27

**Milestone:** M7  
**Contexto:** Durante os smoke tests de M7, a password do super_user foi rejeitada com 401. Não havia registo actualizado da password no KNOWLEDGE.md.  
**Sintoma:** `POST /api/auth/login` → 401. Password correcta desconhecida.  
**Causa Raiz:** A password foi definida numa sessão de debugging anterior sem ser documentada no KNOWLEDGE.md conforme a regra de LL-02.  
**Solução Aplicada:** Reset via bcryptjs local + `wrangler d1 execute --remote`. Nova password documentada em KNOWLEDGE.md §2.  
**Ficheiros afectados:** BD remota + `project-docs/KNOWLEDGE.md`  
**Regra de prevenção:** Imediatamente após qualquer criação ou reset de password de utilizadores de teste, documentar no KNOWLEDGE.md §Credenciais de Teste. Não avançar sem documentar.

---

### LL-21 — SvelteKit 2: `use:enhance` callback não tem `.result` nem `.update` — 2026-02-28

**Milestone:** M14 (detectado durante GS01)  
**Contexto:** Em `apps/web/src/routes/(admin)/backups/+page.svelte`, o callback do `use:enhance` usava `{ result, update }` — padrão válido em SvelteKit 1.  
**Sintoma:** `svelte-check` reportou `TS2339: Property 'result' does not exist on type` e `Property 'update' does not exist on type` nas linhas 78 e 171.  
**Causa Raiz:** Em SvelteKit 2, o callback do `use:enhance` é uma `SubmitFunction` cujo argumento tem a forma `{ action, formData, formElement, controller, submitter, cancel }` (fase de submissão). O resultado chega no callback de retorno: `return async ({ result, update }) => { ... }`.  
**Solução Aplicada:** Reestruturar para o padrão correcto:
```svelte
use:enhance={() => async ({ result, update }) => {
  if (result.type === 'success') { ... }
  else { await update(); }
}}
```
**Ficheiros afectados:** `apps/web/src/routes/(admin)/backups/+page.svelte` (linhas 78 e 171)  
**Regra de prevenção:** Em SvelteKit 2, `use:enhance` SEMPRE usa o padrão de dois níveis: `() => async ({ result, update }) => {}`. O primeiro nível é a fase de submissão (acesso a `cancel`, `formData`); o segundo é a fase de resposta (acesso a `result`, `update`).

---

### LL-22 — Hono `app.fetch` pode retornar `Response` síncrono — `.catch` causa TypeError — 2026-02-28

**Milestone:** M13  
**Contexto:** O middleware `withGracefulShutdown` em `observability.ts` invocava `app.fetch(...).catch(...)` para interceptar erros e registar no graceful shutdown.  
**Sintoma:** Teste `observability.test.ts` falhou com `TypeError: responsePromise.catch is not a function`.  
**Causa Raiz:** O tipo de retorno de `app.fetch` em Hono é `Response | Promise<Response>`. Para rotas síncronas, retorna `Response` directamente (não uma Promise), pelo que `.catch` não existe.  
**Solução Aplicada:** Envolver sempre em `Promise.resolve()`:
```typescript
const responsePromise = Promise.resolve(app.fetch(req, env, ctx));
responsePromise.catch(err => { /* graceful shutdown */ });
```
**Ficheiros afectados:** `apps/api/src/middleware/observability.ts`  
**Regra de prevenção:** Ao chamar `app.fetch()` de Hono em qualquer wrapper/middleware, SEMPRE envolver em `Promise.resolve(app.fetch(...))` antes de usar `.then`/`.catch`. Nunca assumir que o retorno é sempre uma Promise.

---

### LL-23 — Paraglide-JS não tem strict mode nativo para chaves em falta — 2026-02-28

**Milestone:** M12  
**Contexto:** O gate G03 do BUILD_PLAN requeria "build falha se chave em falta". Após investigação da API do Paraglide-JS, concluiu-se que não existe opção de strict mode para abortar build em caso de chave ausente.  
**Sintoma:** Build completava com sucesso mesmo quando `en.json` tinha menos chaves que `pt.json`.  
**Causa Raiz:** O compilador Paraglide-JS usa a língua base (pt) como fonte de verdade e gera funções com fallback silencioso para línguas secundárias. Não expõe flag `--strict` ou equivalente.  
**Solução Aplicada:** Criar script externo `apps/web/scripts/check-i18n-parity.mjs` que:
1. Lê `messages/pt.json` e `messages/en.json`
2. Compara as chaves dos dois ficheiros
3. Faz `process.exit(1)` se houver divergência
4. Integrado em `prebuild` do `apps/web/package.json` (corre antes de `paraglide-js compile`)

**Ficheiros afectados:** `apps/web/scripts/check-i18n-parity.mjs` (novo), `apps/web/package.json`  
**Regra de prevenção:** Após adicionar qualquer chave a `messages/pt.json`, adicionar IMEDIATAMENTE a chave equivalente a `messages/en.json`. O script de parity falha o build em CI se houver divergência. Nunca adicionar chaves a um só ficheiro.

---

### LL-24 — Shape real da API difere do esperado nos testes E2E — 2026-02-28

**Milestone:** M15  
**Contexto:** A suite E2E foi escrita com base no que a API "devia" retornar segundo o BUILD_PLAN, sem verificação prévia das shapes reais em produção.  
**Sintoma:** Vários testes falhavam com `expect(found).toBeTruthy()` (received `undefined`) ou `expect(patchResp.ok()).toBeTruthy()` (received `false`). Erros não óbvios — o endpoint existia e retornava 200.  
**Causa Raiz:** Quatro shapes incorrectas nos testes:
- `GET /api/super/tenants` retorna `{ data: [...], next_cursor, meta }` — testes assumiam `{ tenants: [...] }`
- `POST /api/admin/team/invitations` retorna `{ invitation: { id, ... }, token }` — testes assumiam `{ id, token }`
- `GET /api/admin/team/invitations` retorna `{ rows: [...], nextCursor }` — testes assumiam `{ invitations: [...] }`
- `PATCH /api/super/tenants/:id/limits` — testes usavam `PATCH /api/super/tenants/:id` (sem `/limits`)  
**Solução Aplicada:** Antes de escrever cada assertion, verificar a shape real via `Object.keys(body)` em Playwright. Corrigir todos os field names e o path do endpoint. Usar `listBody.rows ?? listBody.invitations ?? []` como fallback defensivo onde apropriado.  
**Ficheiros afectados:** `apps/web/e2e/f1-f4.spec.ts`, `f5-f8.spec.ts`, `f9-f15.spec.ts`  
**Regra de prevenção:** Antes de escrever testes E2E, sempre validar a shape real de cada endpoint com uma chamada de diagnóstico (`console.log(Object.keys(body))`). Nunca assumir shapes de API sem verificação — BUILD_PLAN descreve intenção, não garante implementação exacta.

---

### LL-25 — Cloudflare Durable Object rate limiter bloqueia curl do sandbox mas não Playwright — 2026-02-28

**Milestone:** M15  
**Contexto:** Durante o desenvolvimento da suite E2E, os comandos `curl` do sandbox para `POST /api/auth/login` retornavam erro 1102 ("Worker exceeded resource limits") ou 503.  
**Sintoma:** Script de global-setup (`node global-setup.js`) falhava com `Login falhou (503)`. Curl directo retornava HTML de erro Cloudflare.  
**Causa Raiz:** O rate limiter (Durable Object) conta tentativas por IP com `maxAttempts=5` por 60 segundos. O IP do sandbox foi bloqueado por múltiplas tentativas de login consecutivas durante o desenvolvimento. O Playwright usa um contexto de browser Chromium com User-Agent diferente, o que resulta num IP de saída diferente ou num path de routing diferente no Cloudflare — não é bloqueado.  
**Solução Aplicada:** Usar `storageState` do Playwright para fazer login uma única vez (global-setup) e reutilizar os cookies em todos os testes. `helpers.ts` implementa `loadSession()` que verifica sessão existente antes de tentar novo login. Se sessão expirada, renova automaticamente. Taxa total de logins: 2 por sessão de testes (super + admin).  
**Ficheiros afectados:** `apps/web/e2e/helpers.ts`, `apps/web/e2e/global-setup.ts`, `apps/web/playwright.config.ts`  
**Regra de prevenção:** Em qualquer projecto com rate limiting por IP, a suite E2E DEVE reutilizar sessões via `storageState`. Nunca fazer login em cada teste individualmente. O global-setup deve executar os logins uma única vez antes de todos os testes.

---

### LL-26 — `__dirname` não existe em módulos ES — erro em helpers.ts com Playwright — 2026-02-28

**Milestone:** M15  
**Contexto:** O `helpers.ts` da suite E2E usava `__dirname` para calcular o path dos ficheiros `.auth/`. O `playwright.config.ts` compilava os testes como ES Modules.  
**Sintoma:** Todos os 15 testes falhavam imediatamente com `ReferenceError: __dirname is not defined`.  
**Causa Raiz:** `__dirname` é uma variável global do sistema de módulos CommonJS (Node.js). Em ES Modules (ESM), não existe. O `tsconfig.json` do projecto usa `"module": "ESNext"` que compila para ESM.  
**Solução Aplicada:**
```typescript
import * as url from 'url';
import * as path from 'path';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
```
**Ficheiros afectados:** `apps/web/e2e/helpers.ts`  
**Regra de prevenção:** Em qualquer ficheiro TypeScript/JavaScript que use `"module": "ESNext"` ou `"moduleResolution": "bundler"`, NUNCA usar `__dirname` ou `__filename` directamente. Usar sempre o equivalente ESM: `url.fileURLToPath(import.meta.url)`.

