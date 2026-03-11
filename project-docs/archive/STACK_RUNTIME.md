# STACK_RUNTIME.md
# Versão: 3.1.0
# Actualizado: 2026-02-26
# Tipo: template de input
# Lido EXCLUSIVAMENTE pelo Architect na FASE 0 e PHASE_00
# Após STACK_LOCK.md gerado e aprovado — este ficheiro é arquivado
# O Builder e o Verifier NUNCA consultam este ficheiro

---

## 1. IDENTIFICAÇÃO

```yaml
stack_id:      cloudflare_workers_d1_r2
hosting:       Cloudflare Workers Static Assets
base_dados:    Cloudflare D1
storage:       Cloudflare R2
rate_limiting: Durable Objects
cron:          Workers Cron Triggers
queues:        Cloudflare Queues
```

Nota: Cloudflare Pages está a ser descontinuado para novos
projectos. Todo o investimento e features novas estão no Workers.
Este stack usa Workers Static Assets para servir frontend e API
num único runtime, num único deploy, num único domínio.

---

## 2. MODELO DE AMBIENTE

```yaml
runtime_config:
  proibido:    process.env em runtime (apps/, packages/)
  permitido:   process.env apenas em scripts/ e .github/

acesso_config:
  api:         c.env (contexto do framework de API)
  frontend:    event.platform.env ou locals.env nos hooks
  nunca:       process.env em runtime

secrets:
  local:       .dev.vars (nunca commitado)
  template:    .dev.vars.example (commitado, sem valores reais)
  producao:    wrangler secret put (input interactivo do humano)
```

---

## 3. FERRAMENTAS DE RUNTIME

```yaml
wrangler:   4.68.1        # CLI de deploy e desenvolvimento local
miniflare:  4.20260224.0  # emulação local do Workers runtime
```

### Tipos de runtime

NÃO usar @cloudflare/workers-types como dependência.
Usar `wrangler types` para gerar tipos automaticamente.

Procedimento obrigatório na PHASE_00 e sempre que
wrangler.toml mudar:
```bash
pnpm wrangler types
# → gera worker-configuration.d.ts
# → adicionar ao tsconfig.json compilerOptions.types
# → commitar o ficheiro gerado
```

---

## 4. BINDINGS DISPONÍVEIS

O Architect resolve quais bindings incluir com base no
questionario.yaml preenchido. Apenas os bindings activos
entram no STACK_LOCK.md e no wrangler.toml.

| Binding        | Tipo   | Condição (campo questionario.yaml)              |
|----------------|--------|-------------------------------------------------|
| ASSETS         | Assets | sempre                                          |
| DB             | D1     | sempre                                          |
| RATE_LIMITER   | DO     | audiencia != interna OU autenticacao.requer_auth = true |
| R2_BUCKET      | R2     | modulos.storage_ficheiros = true                |
| BACKUP_QUEUE   | Queue  | modulos.backups = true                          |
| CSRF_SECRET    | Secret | autenticacao.requer_auth = true                 |
| SESSION_SECRET | Secret | autenticacao.requer_auth = true                 |
| ENCRYPTION_KEY | Secret | modulos.integracoes_externas = true             |
| ALLOWED_ORIGIN | Secret | modulos.cors = true                             |
| CF_ACCOUNT_ID  | Secret | modulos.pdf = true                              |
| CF_API_TOKEN   | Secret | modulos.pdf = true                              |

### Notas por binding

**ASSETS**
Obrigatório para Workers Static Assets.
Serve os ficheiros estáticos gerados pelo build do frontend.
Declarado no wrangler.toml como [assets] com binding e directory.

**DB**
Base de dados D1 principal.
Migrations em migrations/*.sql — forward-only.
Queries centralizadas — nunca inline nos handlers.

**RATE_LIMITER**
Durable Object para rate limiting.
Activo quando a app é pública ou tem autenticação.
Nunca usar KV para rate limiting.
Requer secção [[migrations]] no wrangler.toml para SQLite DO.

**R2_BUCKET**
Storage de ficheiros.
Keys namespaceadas por tenant/user.
Uploads via presigned URLs.
Limites de size e type enforçados na aplicação.

**BACKUP_QUEUE**
Queue para backups assíncronos.
Dead letter queue obrigatória.
Backups >50MB processados em background.
Notificação ao utilizador quando pronto.
Link válido por 24 horas.

**CSRF_SECRET**
Signing do CSRF token (HMAC-SHA-256).
Necessário quando há autenticação.
Mínimo 64 hex chars — gerar com: openssl rand -hex 32

**SESSION_SECRET**
Signing do cookie de sessão (HMAC-SHA-256).
Necessário quando há autenticação.
Mínimo 64 hex chars — gerar com: openssl rand -hex 32

**ENCRYPTION_KEY**
AES-256-GCM para cifrar credenciais externas em DB.
Um único binding cifra todas as credenciais externas.
Necessário quando existem integrações externas.

**ALLOWED_ORIGIN**
Origem permitida para CORS.
OFF por defeito — só activo se modulos.cors = true.
Valor diferente por ambiente (dev, staging, prod).
Lido via mecanismo de config do runtime — nunca hardcoded.

**CF_ACCOUNT_ID e CF_API_TOKEN**
Cloudflare Account ID e API Token para Browser Render (PDF).
Se ausentes, endpoint PDF devolve PDF_NOT_CONFIGURED.
A aplicação continua a funcionar normalmente sem eles.

---

## 5. TEMPLATE WRANGLER.TOML

O Architect gera o wrangler.toml do projecto na PHASE_00
com base nos bindings activos resolvidos do questionario.yaml.
Incluir APENAS as secções dos bindings activos.

```toml
name = "[nome-do-projecto]"
main = "[entry point definido pelo framework — ver STACK_SOFTWARE]"
compatibility_date = "2026-02-26"
compatibility_flags = ["nodejs_als", "nodejs_compat"]

[assets]
binding   = "ASSETS"
directory = "[directório de output do build — ver STACK_SOFTWARE]"

[observability]
enabled = true
[observability.logs]
head_sampling_rate = 1

# --- SEMPRE PRESENTE ---

[[d1_databases]]
binding       = "DB"
database_name = "[nome-da-db]"
database_id   = "[id-da-db]"

# --- CONDICIONAL: audiencia != interna OU requer_auth = true ---

[[durable_objects.bindings]]
name       = "RATE_LIMITER"
class_name = "RateLimiter"

[[durable_objects.migrations]]
tag                = "v1"
new_sqlite_classes = ["RateLimiter"]

# --- CONDICIONAL: modulos.storage_ficheiros = true ---

[[r2_buckets]]
binding     = "R2_BUCKET"
bucket_name = "[nome-do-bucket]"

# --- CONDICIONAL: modulos.backups = true ---

[[queues.producers]]
binding = "BACKUP_QUEUE"
queue   = "[nome-da-queue]"

[[queues.consumers]]
queue             = "[nome-da-queue]"
max_batch_size    = 10
max_batch_timeout = 30

# --- CONDICIONAL: modulos.cron = true ---

[triggers]
crons = ["0 2 * * *"]

# --- VARIÁVEIS NÃO-SECRETAS ---
[vars]
# adicionar variáveis não-secretas por ambiente aqui

# --- SECRETS (nunca no wrangler.toml — via wrangler secret put) ---
# CSRF_SECRET      — se requer_auth = true  (openssl rand -hex 32)
# SESSION_SECRET   — se requer_auth = true  (openssl rand -hex 32)
# ENCRYPTION_KEY   — se integracoes_externas = true
# ALLOWED_ORIGIN   — se modulos.cors = true
# CF_ACCOUNT_ID    — se modulos.pdf = true
# CF_API_TOKEN     — se modulos.pdf = true
```

---

## 6. COMPATIBILITY FLAGS

`nodejs_als`
Node.js AsyncLocalStorage.
Necessário para o framework frontend funcionar correctamente
no Workers runtime.

`nodejs_compat`
Módulos Node.js (crypto, buffer, stream, etc.).
Necessário para libraries que dependem de APIs Node.js.
Necessário para bcryptjs e node:crypto (scrypt).

Ambos são necessários em conjunto para esta stack.

---

## 7. CRON

Regras para jobs cron:
- Idempotência obrigatória
- Log com job_id em cada execução
- Stagger por shard se múltiplos tenants
- Só incluir [triggers] se modulos.cron = true

---

## 8. D1

```yaml
migrations:  migrations/*.sql — forward-only, na raiz do repo
queries:     directório definido no STACK_SOFTWARE — único local SQL
binding:     DB
tipos:       gerados por wrangler types — nunca escritos à mão
```

tenant_key é sempre o primeiro parâmetro em queries multi-tenant.
Migrations destrutivas requerem aprovação explícita do humano.

### Schema de autenticação (quando requer_auth = true)

```sql
-- migrations/0001_auth.sql

CREATE TABLE users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email       TEXT NOT NULL UNIQUE,
  -- hash bcryptjs: "$2b$12$..." — inclui salt e cost factor automaticamente
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

---

## 9. R2

```yaml
binding:   R2_BUCKET
keys:      namespaceadas por tenant/user
uploads:   presigned URLs
limites:   size e type enforçados na aplicação
activo:    apenas se modulos.storage_ficheiros = true
           ou modulos.backups = true
```

---

## 10. QUEUES

```yaml
binding:           BACKUP_QUEUE
dead_letter_queue: obrigatória
processamento:     backups em background
notificacao:       ao utilizador quando pronto
link_validade:     24 horas
activo:            apenas se modulos.backups = true
```

---

## 11. PASSWORD HASHING NO WORKERS RUNTIME

Verificado em 2026-02-26.

```yaml
plano_free:  10ms CPU por request    — hashing seguro impossível
plano_pago:  30 000ms CPU por request — hashing seguro funciona
```

| Algoritmo            | Plano free | Plano pago | Notas                             |
|----------------------|------------|------------|-----------------------------------|
| bcryptjs (pure JS)   | ❌         | ✅         | Recomendado — usar este           |
| scrypt (node:crypto) | ❌         | ✅         | Alternativa válida                |
| argon2 (npm)         | ❌         | ❌         | Bindings C++ — nunca funciona     |
| argon2 (WASM)        | ❌         | ⚠️         | Package abandonado — não usar     |
| PBKDF2 (SubtleCrypto)| ❌         | ✅         | Apenas para FIPS-140 compliance   |

Algoritmo recomendado: **bcryptjs com cost factor 12**.
Autenticação segura requer **Workers Paid plan** obrigatoriamente.
Ver AUTH_GUIDE.md para implementação completa.

---

## 12. NOTAS GERAIS

**Versões**
PHASE_00 valida versões no npm registry.
Pode propor upgrades — aguarda aprovação antes de actualizar.
Após PHASE_00, o STACK_LOCK.md é a fonte de verdade de versões.

**Node.js**
Versão mínima: 24.14.0 (Node 24 LTS — Active LTS até Abril 2028).
Node 25.x não é LTS (suporte termina Junho 2026) — não usar em produção.
Verificar com: node --version

**Workers Sites (deprecado)**
Não usar @sveltejs/adapter-cloudflare-workers.
Usar o adapter definido no STACK_SOFTWARE com Workers Static Assets.

**SDKs externos**
Todos os fornecedores externos via fetch directo.
Zero SDKs npm para integrações externas.
