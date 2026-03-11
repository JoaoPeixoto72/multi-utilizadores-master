# BRIEFING V2 — cf-base: Boilerplate Multi-Empresa SaaS

> **Objectivo deste documento:** Especificacao completa e exaustiva da aplicacao cf-base para que outra IA consiga reconstrui-la na integra usando qualquer stack. TUDO o que esta descrito aqui esta implementado e funcional. O que NAO estiver aqui NAO existe.

---

## 1. VISAO GERAL

### 1.1 O que e
- **Nome:** cf-base
- **Tipo:** Boilerplate SaaS multi-tenant (multi-empresa)
- **URL producao:** `https://cf-base.acemang-jedi.workers.dev`
- **Conceito:** Plataforma onde um Super Utilizador cria e gere empresas (tenants). Cada empresa tem o seu owner, socios, colaboradores e clientes. Sistema modular preparado para adicionar funcionalidades de negocio.

### 1.2 Stack Original (para referencia — pode ser substituida)
- **Backend API:** Hono (framework leve) em TypeScript
- **Frontend:** SvelteKit 5 (Svelte 5 com runes, $state, $derived, $effect)
- **Base de dados:** Cloudflare D1 (SQLite distribuido)
- **Armazenamento ficheiros:** Cloudflare R2 (compativel S3)
- **Rate limiting:** Cloudflare Durable Objects
- **i18n:** Paraglide (@inlang/paraglide-js) — 2 idiomas: PT e EN
- **Validacao:** Zod
- **CSS:** Design tokens proprios (variaveis CSS) + Tailwind CSS 4 (apenas utilitarios de layout)
- **Deploy:** Cloudflare Workers (nao Pages)
- **Monorepo:** Turborepo + PNPM workspaces

### 1.3 Arquitectura de 4 Camadas
```
Routes -> Handlers -> Services -> DB Queries
```
- **Routes:** Definem endpoints HTTP, aplicam middleware, delegam para handlers
- **Handlers:** Logica de request/response, validacao de input (Zod)
- **Services:** Logica de negocio pura, sem dependencia de HTTP
- **DB Queries:** Prepared statements SQL, zero SQL inline nos services

### 1.4 Integracao Frontend-Backend
- O frontend (SvelteKit) delega TODOS os pedidos `/api/**` para o backend (Hono) via `hooks.server.ts`
- Zero ficheiros `+server.ts` para logica de API — toda a API vive no Hono
- Formularios usam SvelteKit `enhance()` com chamadas `fetch()` para a API Hono
- Existe um cliente RPC tipado (`hc<AppType>`) mas a maioria das paginas usa `fetch()` directo nos `+page.server.ts`

---

## 2. HIERARQUIA DE ROLES E PERMISSOES

### 2.1 Roles (por ordem de privilegio)
| Role DB | Nivel | tenant_id | Label UI | Descricao |
|---------|-------|-----------|----------|-----------|
| `super_user` | 100 | `null` | Super User | Administrador da plataforma. Gere todas as empresas. Sem tenant. |
| `tenant_admin` + `is_owner=1` | 80 | obrigatorio | Owner | Owner fixo da empresa. Controlo total. |
| `member` + `is_temp_owner=1` | 70 | obrigatorio | Owner Temp. | Owner temporario (elevado pelo super_user, expira). |
| `member` | 50 | obrigatorio | Socio | Socio da empresa. Acesso a equipa, backups, actividade. |
| `collaborator` | 10 | obrigatorio | Colaborador | Colaborador externo. Acesso limitado a modulos autorizados. |
| `client` | 5 | obrigatorio | Cliente | Cliente da empresa. Acesso minimo. |

**IMPORTANTE:** O default da coluna `role` na DB e `'collaborator'` (NAO `'member'`).

**NOTA sobre `packages/shared/src/types/roles.ts`:** Este ficheiro define roles com nomes diferentes (owner_fixo, owner_temporario, partner) mas NAO e importado por nenhum codigo na API nem no Web. E codigo morto/legado. Os roles reais sao os da tabela acima.

### 2.2 Flags Importantes
- `is_owner` (0/1) — Owner fixo permanente da empresa
- `is_temp_owner` (0/1) — Owner temporario (com `temp_owner_expires_at` timestamp)
- Um membro so pode ser owner temporario se `role = 'member'`
- O owner fixo tem `role = 'tenant_admin'` + `is_owner = 1`

### 2.3 Regras de Acesso por Area

**Painel Super (`/super/*`):**
- Apenas `role = 'super_user'`

**Painel Admin/Empresa (`/dashboard`, `/team`, `/backups`, `/activity`, `/profile`):**
- `tenant_admin`, `member`, `collaborator`, `client` — todos com `tenant_id`
- Se `super_user` tenta aceder → redireccionado para `/super/dashboard`
- Se nao autenticado → redireccionado para `/login`

**Quem ve o que no dashboard da empresa:**
- Admin/Owner: ve stats grid (socios, colaboradores, clientes, total) + accoes rapidas
- Colaborador: ve apenas grid de modulos ou estado vazio

**Equipa (`/team`):**
- Visivel para admin, owner e member
- Colaboradores nao veem a pagina de equipa

**Backups, Actividade:**
- Admin e owner podem ver
- Criar/eliminar backups: apenas owner (fixo ou temp) e tenant_admin
- Limpar historico de actividade: apenas owner (exige backup < 60 min)

---

## 3. MODELO DE DADOS COMPLETO

### 3.1 Tabela `tenants` (Empresas)
```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  address TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  website TEXT,
  logo_key TEXT,                                     -- chave R2 do logotipo
  admin_seat_limit INTEGER NOT NULL DEFAULT 3,      -- limite de socios (min 1)
  member_seat_limit INTEGER NOT NULL DEFAULT 10,    -- limite de colaboradores
  client_seat_limit INTEGER NOT NULL DEFAULT 0,     -- limite de clientes (adicionado em 0011)
  storage_limit_bytes INTEGER NOT NULL DEFAULT 1073741824,  -- 1 GB
  daily_email_limit INTEGER NOT NULL DEFAULT 100,
  allowed_languages TEXT NOT NULL DEFAULT '["pt","en"]',  -- JSON array de idiomas permitidos
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','active','inactive','deleted')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER
);
```

**NOTA:** O tracking de armazenamento usado esta numa tabela separada `tenant_storage_usage` (ver 3.13).

### 3.2 Tabela `users` (Utilizadores)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  tenant_id TEXT REFERENCES tenants(id),             -- null para super_user
  role TEXT NOT NULL DEFAULT 'collaborator'
    CHECK(role IN ('super_user','tenant_admin','member','collaborator','client')),
  is_owner INTEGER NOT NULL DEFAULT 0,
  is_temp_owner INTEGER NOT NULL DEFAULT 0,
  temp_owner_expires_at INTEGER,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  website TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'pt',
  avatar_key TEXT,                                    -- chave R2 do avatar
  email_pending TEXT,                                -- novo email aguardando confirmacao
  email_token TEXT,                                  -- token de confirmacao (UNIQUE via indice)
  email_token_expires_at INTEGER,                    -- unixepoch de expiracao
  module_permissions TEXT NOT NULL DEFAULT '{}',     -- JSON: permissoes por modulo
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','inactive','deleted')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 3.3 Tabela `sessions`
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signed_token TEXT NOT NULL UNIQUE,                 -- HMAC-SHA-256 signed token
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 3.4 Tabela `password_resets`
```sql
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,                   -- SHA-256 do token raw
  used_at INTEGER,                                   -- NULL = nao usado; timestamp quando usado
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 3.5 Tabela `invitations` (Convites)
```sql
CREATE TABLE invitations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,  -- sem NOT NULL
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('tenant_admin','member','collaborator','client')),
  is_owner INTEGER NOT NULL DEFAULT 0 CHECK(is_owner IN (0,1)),
  invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  module_permissions TEXT NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'pt',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','accepted','cancelled','expired')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,                       -- 24h
  accepted_at INTEGER,
  cancelled_at INTEGER
);
```

### 3.6 Tabela `notifications`
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,                               -- UUID gerado na aplicacao (NAO randomblob)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title_key TEXT NOT NULL,                           -- chave i18n
  body_key TEXT NOT NULL,                            -- chave i18n
  params TEXT,                                       -- JSON com parametros para interpolacao
  link TEXT,                                         -- URL relativo
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),  -- ISO timestamp
  read_at TEXT,                                      -- ISO timestamp
  expires_at TEXT                                    -- ISO timestamp, NULL = nao expira
);
```

**NOTA:** Timestamps sao TEXT em formato ISO (nao INTEGER epoch) nesta tabela.

### 3.7 Tabela `integrations` (Integracoes Externas)
```sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,                               -- UUID gerado na aplicacao (NAO randomblob)
  category TEXT NOT NULL CHECK(category IN (
    'email','sms','llm','cloud_storage','calendar','payments','invoicing','pdf'
  )),
  provider TEXT NOT NULL,                            -- resend, twilio, openai, etc.
  credentials_encrypted TEXT NOT NULL,               -- AES-256-GCM encrypted JSON
  is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
  tested_at TEXT,                                    -- ISO timestamp da ultima vez testada
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Trigger: updated_at automatico
CREATE TRIGGER trg_integrations_updated_at
  AFTER UPDATE ON integrations FOR EACH ROW
BEGIN
  UPDATE integrations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
```

**NOTA:** Timestamps sao TEXT em formato ISO nesta tabela. Trigger actualiza `updated_at` automaticamente.

### 3.8 Tabela `backups`
```sql
CREATE TABLE backups (
  id TEXT PRIMARY KEY,                               -- UUID gerado na aplicacao
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'db_only',              -- db_only | full
  status TEXT NOT NULL DEFAULT 'pending',            -- pending | running | done | failed
  size_bytes INTEGER,
  r2_key TEXT,                                       -- chave R2 do ficheiro
  download_expires_at INTEGER,                       -- epoch ms
  error_msg TEXT,                                    -- preenchido se status = failed
  created_by TEXT NOT NULL,                          -- user_id que pediu o backup
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),  -- ATENCAO: milissegundos!
  completed_at INTEGER
);
```

**NOTA CRITICA:** `created_at` desta tabela usa MILISSEGUNDOS (epoch * 1000), ao contrario das outras tabelas que usam segundos.

### 3.9 Tabela `backup_auto_config`
```sql
CREATE TABLE backup_auto_config (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,                -- 0 = false, 1 = true
  frequency TEXT NOT NULL DEFAULT 'weekly',          -- daily | weekly | monthly (default WEEKLY)
  day_of_week INTEGER DEFAULT 0,                     -- 0=Dom...6=Sab
  retention_days INTEGER NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),  -- milissegundos
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)   -- milissegundos
);
```

### 3.10 Tabela `activity_log` (por empresa)
```sql
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,                            -- user_id
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,                              -- ex: user.invite, backup.create
  target_type TEXT,                                  -- ex: user, backup, company
  target_id TEXT,
  target_name TEXT,
  metadata TEXT DEFAULT '{}',                        -- JSON extra (NAO "details"!)
  was_temp_owner INTEGER DEFAULT 0,                  -- 1 se actor era owner temporario
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 3.11 Tabela `audit_log` (global — super user)
```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,                          -- ex: tenant.created, tenant.deleted
  actor_id TEXT NOT NULL,
  tenant_id TEXT,
  target_type TEXT,
  target_id TEXT,
  bytes_affected INTEGER DEFAULT 0,                  -- bytes afectados pela operacao
  count_affected INTEGER DEFAULT 0,                  -- registos afectados
  metadata TEXT DEFAULT '{}',                        -- JSON sem dados pessoais (NAO "details"!)
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**NOTA:** NAO existe coluna `ip_address` nem `details`. Os campos extra sao `bytes_affected`, `count_affected` e `metadata`.

### 3.12 Tabela `break_glass_log`
```sql
CREATE TABLE break_glass_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,                            -- user_id (NAO "super_user_id")
  downloaded_at INTEGER NOT NULL DEFAULT (unixepoch())  -- (NAO "generated_at")
);
```

**NOTA:** NAO existe coluna `ip_address`. Coluna e `actor_id` (nao `super_user_id`) e `downloaded_at` (nao `generated_at`).

### 3.13 Tabelas auxiliares
- `app_config(key TEXT PK, value TEXT NOT NULL, updated_at INTEGER)` — configuracoes globais
- `tenant_daily_email_count(tenant_id TEXT, date TEXT, count INTEGER, updated_at)` — contagem de emails diarios (PK composta: tenant_id + date)
- `tenant_module_limits(id TEXT PK, tenant_id, module_id, limit_key, limit_value, created_at, updated_at)` — limites por modulo (UNIQUE: tenant_id + module_id + limit_key)
- `tenant_storage_usage(tenant_id TEXT PK, bytes_used INTEGER DEFAULT 0, updated_at)` — tracking de armazenamento usado por empresa (tabela separada do tenants)

---

## 4. API COMPLETA — TODOS OS ENDPOINTS

### 4.1 Health
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/health/live` | Nao | Liveness probe: `{ status: "ok" }` |
| GET | `/api/health/ready` | Nao | Readiness probe: testa conexao DB |

### 4.2 Setup Inicial
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/setup` | Nao | Verifica se setup disponivel (`{ available: true/false }`) |
| POST | `/api/setup` | Nao | Cria primeiro super_user. Body: `{ email, password }`. Password min 12 chars, 1 maiuscula, 1 minuscula, 1 especial. So funciona se 0 users existem. Retorna 404 apos execucao. |

### 4.3 Autenticacao
| Metodo | Rota | Auth | Rate Limit | Descricao |
|--------|------|------|------------|-----------|
| GET | `/api/auth/csrf` | Nao | — | Devolve CSRF token `{ token }` |
| POST | `/api/auth/login` | Nao | 5 req/60s/IP | Login. Body: `{ email, password }`. Erros sempre genericos (nunca revelar se email existe). Cookie httpOnly session. Resposta: `{ id, email, role, tenant_id }` (SEM is_owner). |
| POST | `/api/auth/logout` | Nao* | — | Invalida sessao + limpa cookie. Isento de CSRF. |
| GET | `/api/auth/me` | Sim | — | Dados do user autenticado: `{ id, email, role, tenant_id, is_owner, is_temp_owner, status }` |
| POST | `/api/auth/password-reset/request` | Nao | 3 req/300s/IP | Pede reset de password. Body: `{ email }`. Resposta sempre neutra. Token enviado por email (1h validade). |
| POST | `/api/auth/password-reset/confirm` | Nao | — | Confirma reset. Body: `{ token, password }`. Invalida todas as sessoes. |

### 4.4 Convites
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/invitations/:token` | Nao | Valida token de convite. Devolve `{ email, role, is_owner, language, expires_at }` |
| POST | `/api/invitations/:token/accept` | Nao | Aceita convite: cria user. Body: `{ password, display_name? }`. Se is_owner=1 → activa o tenant. Notifica admins. |

### 4.5 Super User — Empresas
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/super/tenants` | super_user | Lista empresas. Query: `cursor`, `status`, `limit`. Cursor-based pagination. Meta inclui contagens por status. |
| POST | `/api/super/tenants` | super_user | Cria empresa + convite owner. Body: `{ name, email, owner_email, address?, phone?, website?, admin_seat_limit, member_seat_limit, client_seat_limit, storage_limit_bytes, daily_email_limit, owner_language }` |
| GET | `/api/super/tenants/:id` | super_user | Detalhe: tenant + owner + seat counts (admins, members, collaborators, clients, total) |
| GET | `/api/super/tenants/:id/users` | super_user | Lista users: owner, temp_owners, members, collaborators (com count), clients (com count) |
| PATCH | `/api/super/tenants/:id/limits` | super_user | Actualiza limites: `{ admin_seat_limit?, member_seat_limit?, client_seat_limit?, storage_limit_bytes?, daily_email_limit? }` |
| POST | `/api/super/tenants/:id/activate` | super_user | Activa empresa pending. Notifica owners. |
| POST | `/api/super/tenants/:id/deactivate` | super_user | Desactiva empresa. Invalida todas as sessoes dos users. |
| POST | `/api/super/tenants/:id/soft-delete` | super_user | Marca como eliminada (soft delete). |
| DELETE | `/api/super/tenants/:id` | super_user | Hard delete (elimina fisicamente empresa + users + convites). |
| POST | `/api/super/tenants/:id/transfer-ownership` | super_user | Body: `{ new_owner_user_id }`. Transfere ownership para um membro. Irreversivel. |
| POST | `/api/super/tenants/:id/elevate` | super_user | Body: `{ user_id, duration? }`. Eleva membro a owner temporario (default 24h, max 7 dias). |
| DELETE | `/api/super/tenants/:id/elevate` | super_user | Revoga elevacao temporaria. |

### 4.6 Super User — Integracoes
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/super/integrations` | super_user | Lista todas (credenciais mascaradas). |
| POST | `/api/super/integrations` | super_user | Cria. Body: `{ category, provider, credentials }`. Categorias: email, sms, llm, cloud_storage, calendar, payments, invoicing, pdf. Credenciais encriptadas com AES-256-GCM. |
| PATCH | `/api/super/integrations/:id` | super_user | Actualiza credenciais. Body: `{ credentials }` |
| POST | `/api/super/integrations/:id/test` | super_user | Testa conectividade. Devolve `{ ok, message }`. |
| POST | `/api/super/integrations/:id/activate` | super_user | Activa (exige teste previo). So 1 activa por categoria. |
| POST | `/api/super/integrations/:id/deactivate` | super_user | Desactiva. |
| DELETE | `/api/super/integrations/:id` | super_user | Elimina. |
| POST | `/api/super/integrations/verify-email` | super_user | Envia email de verificacao real. Body: `{ id, email }`. O email contem link de confirmacao para activacao automatica. |

### 4.7 Super User — Audit & Break-Glass
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/super/audit` | super_user | Audit log global (cursor-based). Query: `cursor`, `event_type`, `tenant_id`. |
| GET | `/api/super/break-glass` | super_user | Gera ficheiro JSON de emergencia com token de reset (valido 15 min). Registado no audit log. |

### 4.8 Super User — Backups
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/super/backups` | super_user | Lista todos os backups de todas as empresas. |
| POST | `/api/super/backups/import` | super_user | Importa backup. Body: `{ r2_key, target_tenant_id }`. |

### 4.9 Super User — Configuracoes
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/super/settings` | super_user | Devolve todas as config de `app_config`. |
| PATCH | `/api/super/settings` | super_user | Actualiza multiplas chaves. Body: `{ key1: value1, ... }` |

### 4.10 Admin — Equipa
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/admin/team/stats` | auth (admin) | Stats: `{ members: {count, limit}, collaborators: {count, limit}, clients: {count, limit}, total: {count, limit} }` |
| GET | `/api/admin/team/members` | auth (admin) | Lista socios (role=member) da empresa. Cursor-based. |
| GET | `/api/admin/team/collaborators` | auth (admin) | Lista colaboradores da empresa. Cursor-based. |
| GET | `/api/admin/team/clients` | auth (admin) | Lista clientes da empresa. Cursor-based. |
| POST | `/api/admin/team/collaborators/:id/deactivate` | auth (admin) | Desactiva colaborador. |
| POST | `/api/admin/team/collaborators/:id/reactivate` | auth (admin) | Reactiva colaborador. |
| DELETE | `/api/admin/team/collaborators/:id` | auth (admin) | Elimina colaborador. |
| DELETE | `/api/admin/team/members/:id` | auth (admin) | Elimina membro. |
| DELETE | `/api/admin/team/clients/:id` | auth (admin) | Elimina cliente. |
| GET | `/api/admin/team/invitations` | auth (admin) | Lista convites pendentes. Query: `limit`, `cursor`, `status`. |
| POST | `/api/admin/team/invitations` | auth (admin) | Cria convite. Body: `{ email, role, language?, module_permissions? }`. Roles: member, collaborator, client. Socios so podem ser convidados por owners. |
| POST | `/api/admin/team/invitations/:id/resend` | auth (admin) | Reenvia convite (cancela antigo, cria novo). |
| DELETE | `/api/admin/team/invitations/:id` | auth (admin) | Cancela convite. |
| GET | `/api/admin/team/permissions` | auth (admin) | Lista colaboradores com permissoes de modulos. |
| PATCH | `/api/admin/team/permissions/:userId` | auth (admin) | Actualiza permissoes de modulos de um user. |

### 4.11 Admin — Empresa
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/admin/company` | auth (com tenant) | Dados da empresa. |
| PATCH | `/api/admin/company` | auth (owner) | Edita: `{ name?, address?, phone?, website? }` |
| POST | `/api/admin/company/logo` | auth (owner) | Upload logotipo. multipart/form-data, campo "file". WebP, max 200KB, max 512x512. |
| DELETE | `/api/admin/company/logo` | auth (owner) | Remove logotipo. |

### 4.12 Admin — Actividade
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/admin/activity` | auth (admin) | Lista actividades (cursor-based). Query: `cursor`, `actor_id`, `action`. |
| DELETE | `/api/admin/activity` | auth (owner) | Limpa historico. Pre-condicao: backup < 60 min. |
| GET | `/api/admin/activity/export` | auth (admin) | Exporta CSV. |

### 4.13 Admin — Backups
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/admin/backups` | auth (com tenant) | Lista backups da empresa. |
| POST | `/api/admin/backups` | auth (owner) | Cria backup manual. Body: `{ type: "db_only" | "full" }` |
| GET | `/api/admin/backups/config` | auth (com tenant) | Le config de backup automatico. |
| PATCH | `/api/admin/backups/config` | auth (owner) | Actualiza config. Body: `{ enabled?, frequency?, day_of_week?, retention_days? }` |
| GET | `/api/admin/backups/:id/download` | auth (owner) | Download do ficheiro de backup (stream de R2). |
| DELETE | `/api/admin/backups/:id` | auth (owner) | Elimina backup. |

### 4.14 User — Perfil & Conta
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/user/modules` | auth | Modulos disponiveis para o user + role + is_owner + is_temp_owner. |
| GET | `/api/user/nav` | auth | Itens de navegacao filtrados por role + permissoes. |
| DELETE | `/api/user/me` | auth | Auto-eliminacao (soft delete). Limpa cookie. Owner fixo proibido. |
| GET | `/api/user/profile` | auth | Perfil completo. |
| PATCH | `/api/user/profile` | auth | Edita: `{ first_name?, last_name?, display_name?, phone?, website?, preferred_language? }` |
| POST | `/api/user/profile/avatar` | auth | Upload avatar. multipart/form-data, WebP, max 200KB, max 512x512. |
| DELETE | `/api/user/profile/avatar` | auth | Remove avatar. |
| POST | `/api/user/profile/change-email` | auth | Body: `{ current_password, new_email }`. Envia link de confirmacao (24h). |
| GET | `/api/user/confirm-email/:token` | Publico | Confirma mudanca de email. Redireciona para `/login?email_confirmed=1`. |
| POST | `/api/user/profile/change-password` | auth | Body: `{ current_password, new_password }` |
| GET | `/api/user/profile/export-rgpd` | auth | Exporta dados pessoais em JSON (RGPD). |

### 4.15 User — Notificacoes
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/user/notifications` | auth | Lista paginada (cursor). Query: `cursor`, `unread=1`. |
| GET | `/api/user/notifications/unread-count` | auth | Badge count: `{ count }` |
| PATCH | `/api/user/notifications/:id/read` | auth | Marca como lida. |
| POST | `/api/user/notifications/read-all` | auth | Marca todas como lidas. |
| DELETE | `/api/user/notifications/:id` | auth | Elimina uma. |
| DELETE | `/api/user/notifications` | auth | Elimina todas. |

---

## 5. SISTEMA DE AUTENTICACAO E SEGURANCA

### 5.1 Sessoes
- Armazenadas em DB (D1), nao JWT stateless
- Token assinado com HMAC-SHA-256 usando `SESSION_SECRET`
- Formato: `{sessionId}:{userId}:{expiresAt}.{hmac_hex}`
- Cookie: `session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000` (30 dias)
- Uma sessao por utilizador (login invalida sessoes anteriores)
- Dupla validacao: expiracoes no payload + na DB

### 5.2 CSRF
- Token gerado via HMAC-SHA-256 com `CSRF_SECRET`
- Formato: `{timestamp}.{uuid}.{hmac_hex}`
- Validade: 1 hora
- Header: `X-CSRF-Token`
- Aplicado em todos os POST/PUT/PATCH/DELETE em `/api/*`
- Isencoes: `/api/auth/logout`
- Frontend obtem token via `GET /api/auth/csrf` no layout server

### 5.3 Rate Limiting
- Implementado com Durable Objects (nao KV)
- Cada IP tem um contador em Durable Object isolado
- Configuracoes pre-definidas:
  - Login: 5 tentativas / 60s
  - Password reset: 3 tentativas / 300s
  - API geral: 60 req / 60s
- Fail-open: se DO falhar, nao bloqueia o request

### 5.4 Password Policy
- Minimo 12 caracteres
- Pelo menos 1 maiuscula
- Pelo menos 1 minuscula
- Pelo menos 1 caracter especial
- Hash: bcryptjs cost=12

### 5.5 Tokens de Uso Unico
- Gerados com `crypto.getRandomValues(32 bytes)` → hex string
- Guardados em DB como SHA-256 hash (raw enviado por email, hash em DB)
- Expiracoes:
  - Password reset: 1 hora
  - Convite: 24 horas
  - Email change: 24 horas
  - Break-glass: 15 minutos

### 5.6 Security Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), ...`

### 5.7 Encriptacao de Credenciais
- AES-256-GCM via Web Crypto API
- Chave derivada de `ENCRYPTION_KEY` com PBKDF2 (100k iteracoes, SHA-256)
- Salt fixo: `"cf-base-integrations-v1"`
- Output: base64url(iv[12] + ciphertext + authTag[16])

---

## 6. SISTEMA DE INTEGRACOES EXTERNAS (M7)

### 6.1 Categorias Suportadas
- `email` (implementado: Resend)
- `sms` (interface definida, sem adapter)
- `llm` (interface definida, sem adapter)
- `cloud_storage`, `calendar`, `payments`, `invoicing`, `pdf` (categorias reservadas)

### 6.2 Lifecycle de uma Integracao
1. Super user cria integracao com provider + credenciais
2. Credenciais sao encriptadas (AES-256-GCM) e guardadas
3. Super user testa a integracao (ping/conexao)
4. Se teste OK → pode activar (so 1 activa por categoria)
5. Verificacao por email: super user envia email de teste → clica link de confirmacao

### 6.3 Adapter Pattern
- Interface `EmailAdapter`: `send(msg)`, `ping()`, `provider`
- Interface `SmsAdapter`: `send(msg)`, `ping()`, `provider`
- Interface `LlmAdapter`: `complete(req)`, `ping()`, `provider`
- Adapters usam `fetch()` directo (zero SDKs npm)
- Circuit breaker obrigatorio: 5 falhas → circuito aberto 30s. Max 3 retries com backoff exponencial.

### 6.4 Envio de Email
- Funcao central `sendEmail(db, encKey, msg, tenantId?)`
- Verifica limite diario se tenantId fornecido
- Silencioso se nenhuma integracao activa (nao falha)
- Incrementa contador diario (melhor-esforco)

---

## 7. SISTEMA DE NOTIFICACOES (M6)

### 7.1 Tipos de Notificacao
- `invite_accepted` — Convite aceite (notifica admins)
- `invite_expired` — Convite expirado
- `elevation_granted` — Elevacao temporaria concedida
- `elevation_expired` — Elevacao expirada
- `elevation_revoked` — Elevacao revogada
- `delete_requested` — Pedido de eliminacao
- `email_change_confirm` — Confirmacao de email
- `tenant_activated` — Empresa activada
- `tenant_deactivated` — Empresa desactivada
- `backup_done` — Backup concluido
- `backup_failed` — Backup falhado
- `break_glass_downloaded` — Break-glass descarregado

### 7.2 Funcionalidades
- Notificacoes sao criadas automaticamente por acoes do sistema
- `notifyAdmins(tenantId, ...)` — notifica todos os admin/owner activos da empresa
- `notifyOwners(tenantId, ...)` — notifica owners
- `notifySuperUsers(...)` — notifica super users
- Notificacoes usam chaves i18n (`title_key`, `body_key`) com `params` JSON
- Badge de contagem nao-lidas no header (NotificationBell component)
- Dropdown com lista, marcar lida, marcar todas lidas, eliminar

---

## 8. SISTEMA DE BACKUPS (M8)

### 8.1 Tipos
- `db_only` — Exporta dados da empresa da DB em JSON
- `full` — Exporta DB + ficheiros R2

### 8.2 Funcionalidades
- Backup manual (owner cria)
- Backup automatico via cron (`0 0 * * *` meia-noite UTC)
- Configuracao por empresa: enabled, frequency (daily/weekly/monthly), day_of_week, retention_days
- Ficheiro guardado em R2 (key: `backups/{tenant_id}/{backup_id}.json`)
- Download streaming de R2
- Link de download com expiracao
- Eliminacao remove registo DB + ficheiro R2

### 8.3 Cron Handler
- Exportado como `scheduled` handler do Worker
- Verifica todas as empresas com backup automatico activo
- Respeita frequencia e dia da semana
- Limpa backups expirados (retention_days)

---

## 9. SISTEMA DE LOGS E AUDITORIA (M9)

### 9.1 Activity Log (por empresa)
- Registado automaticamente em acoes da empresa
- Tipos de accao: `user.invite`, `user.invite_accept`, `user.invite_cancel`, `user.invite_resend`, `user.deactivate`, `user.reactivate`, `user.delete`, `user.elevation_grant`, `user.elevation_revoke`, `backup.create`, `backup.delete`, `company.update`, `company.logo_upload`, `integration.activate`, `integration.deactivate`
- Inclui: actor_id, actor_name, target_type, target_id, target_name, metadata (JSON), was_temp_owner
- Exportacao CSV
- Limpeza exige backup recente (< 60 min)

### 9.2 Audit Log (global — super user)
- Registado em acoes de plataforma
- Tipos: `tenant.created`, `tenant.activated`, `tenant.deactivated`, `tenant.soft_deleted`, `tenant.hard_deleted`, `tenant.limits_updated`, `tenant.ownership_transferred`, `tenant.elevation_granted`, `tenant.elevation_revoked`, `break_glass.generated`
- Inclui: actor_id, event_type, tenant_id, target_type, target_id, bytes_affected, count_affected, metadata (JSON)

### 9.3 Break-Glass Log
- Registo separado para downloads de ficheiros de emergencia
- Inclui: actor_id, downloaded_at

---

## 10. SISTEMA DE MODULOS (M10)

### 10.1 Estrutura
- Registry central (`modules.config.ts`) define modulos
- Cada modulo tem: id, name_key (i18n), icon, description_key, integrations_required, permissions, limits_schema, handlers

### 10.2 Modulos Registados
- `core` — Base (limites: max_users, max_storage_mb)
- `notifications` — Notificacoes (permissao: notifications.read; limite: max_notifications)
- `backups` — Backups (limites: max_backups, retention_days)
- `activity` — Historico de actividade (permissao: activity.read)
- `integrations` — Integracoes (sem permissoes/limites extra)

### 10.3 Lifecycle Hooks
- `onUserDelete(userId, tenantId, db, r2)` — cleanup de dados ao eliminar user
- `onTenantDelete(tenantId, db, r2)` — cleanup de dados ao eliminar empresa
- `onCronMaintenance(db, r2, env)` — manutencao periodica
- `onRgpdExport(userId, tenantId, db)` — exportar dados RGPD do modulo
- Todos os hooks sao tolerantes a falhas (nao aborta se um modulo falha)

### 10.4 Permissoes Granulares
- Colaboradores tem `module_permissions` JSON no perfil
- Admin pode configurar que modulos cada colaborador acede
- Pagina de permissoes em `/team` (tab Permissoes)
- Nav filtra itens por permissoes do user

---

## 11. PAGINAS FRONTEND COMPLETAS

### 11.1 Paginas Publicas (Auth)

**`/setup`** — Setup inicial
- Formulario: email + password
- So aparece se 0 users na DB
- Cria super_user e faz login automatico

**`/login`** — Login
- Formulario: email + password
- Erros genericos (nunca revelar se email existe)
- Link "Esqueceu a password?"
- Query param `email_confirmed=1` mostra mensagem de sucesso

**`/password-reset`** — Pedir reset
- Formulario: email
- Resposta sempre neutra

**`/password-reset/[token]`** — Nova password
- Formulario: nova password (com checklist de requisitos)
- Valida token; se invalido/expirado → mensagem de erro

**`/invite/[token]`** — Aceitar convite
- Mostra email e role do convite
- Formulario: password + nome (opcional)
- Checklist de requisitos de password

**`/logout`** — Rota de logout (POST → redirect `/login`)

### 11.2 Paginas Super User (`/super/*`)

**`/super/dashboard`** — Painel principal
- Stats grid: empresas activas, inactivas, total
- Lista de empresas activas (tabela)
- Lista de empresas recentes (tabela com status badge)

**`/super/tenants`** — Lista de empresas
- Tabs: Todas, Pendentes, Activas, Inactivas (com contagens)
- Tabela: nome, email, status badge, admin seats (x/y), collab seats (x/y), client seats (x/y), data criacao, link ver
- Paginacao cursor-based
- Botao "Nova empresa"
- Estado vazio com ilustracao SVG

**`/super/tenants/new`** — Criar empresa
- Formulario: nome, email da empresa, morada, telefone, website
- Limites: admin seats (1-50, default 3), member seats (0-200, default 0), client seats (0-500, default 0), storage MB
- Owner: email do owner + idioma
- Alertas de erro especificos (email_taken, owner_email_taken)

**`/super/tenants/[id]`** — Detalhe da empresa
- Info card: ID, email, morada, telefone, website, data criacao, owner, seats por tipo (socios, colaboradores, clientes)
- Formulario de limites editaveis
- Accoes: activar/desactivar, soft delete
- Zona de perigo: eliminar permanentemente (com modal de confirmacao)
- Seccao Equipa: owner fixo, owner temporario, socios, colaboradores, clientes
- Formulario elevar membro (duracao em horas)
- Formulario transferir ownership (irreversivel)

**`/super/integrations`** — Gestao de integracoes
- Lista de integracoes por categoria
- Criar: seleccionar categoria + provider + credenciais JSON
- Testar conexao
- Activar/Desactivar
- Verificar por email (envia email de teste com link de confirmacao)
- Confirmar verificacao de email (`/super/integrations/confirm`)

**`/super/audit`** — Audit log
- Tabela: data, actor, evento, empresa, alvo, afectado
- Filtros: event_type, tenant_id
- Paginacao cursor-based
- Seccao Break-Glass com explicacao e botao de download

**`/super/settings`** — Configuracoes globais
- Secao read-only: servicos Cloudflare (DB, R2, Rate Limiter)
- Secao: variaveis de ambiente (APP_ENV, APP_URL)
- Secao: secrets (nunca expoe valores, so indica se configurados)
- Secao: chaves de config de `app_config`

**`/super/backups`** — Backups globais
- Tabela: empresa, tipo, data, estado, tamanho, download
- Paginacao cursor-based

### 11.3 Paginas Admin/Empresa

**`/dashboard`** — Dashboard da empresa
- Para admin/owner:
  - Stats grid: Socios (x/y), Colaboradores (x/y), Clientes (x/y), Total (x/y)
  - Accoes rapidas: Gerir equipa, Convidar socio, Convidar colaborador
- Para colaborador:
  - Grid de modulos disponiveis
  - Ou estado vazio se sem modulos

**`/team`** — Gestao de equipa
- Tabs: Socios, Colaboradores, Clientes, Convites, Permissoes
- Tab Socios: lista com badges owner/owner_temp, datas, botoes eliminar
- Tab Colaboradores: lista com role badge, data, botoes desactivar/reactivar/eliminar
- Tab Clientes: lista de clientes
- Tab Convites: lista com status, expiracao, botoes reenviar/cancelar
- Tab Permissoes: cards por colaborador com toggles de modulos
- Formulario convidar: email + role (member/collaborator/client)
- Modais de confirmacao para desactivar/reactivar/eliminar/cancelar convite

**`/notifications`** — Centro de notificacoes
- Lista com icones por tipo
- Botoes: marcar lida, marcar todas lidas, eliminar todas
- Link para pagina completa a partir do dropdown do header

**`/backups`** — Backups da empresa
- Lista com status badges (pending/running/done/failed)
- Botao criar novo backup (db_only)
- Config automatico: enabled, frequency, day_of_week, retention_days
- Download e eliminacao

**`/activity`** — Historico de actividade
- Lista com icones SVG por tipo de accao
- Filtros: actor_id, action
- Exportar CSV
- Limpar historico (com modal de confirmacao e pre-condicao de backup)

**`/profile`** — Perfil pessoal
- Tabs: Pessoal, Email, Password, Empresa (so owner)
- Tab Pessoal: avatar (upload/remover WebP), nome, apelido, display_name, telefone, website, idioma
- Tab Email: alterar email (exige password actual + confirmacao por email)
- Tab Password: alterar password (exige password actual + nova com checklist)
- Tab Empresa: nome, morada, telefone, website, logotipo (upload/remover)
- Barra de armazenamento usado
- Auto-eliminacao de conta (com confirmacao por password e modal)
- Exportacao RGPD

**`/modules/[id]`** — Pagina de modulo individual
- Placeholder: "Modulo em desenvolvimento"
- Verifica se integracao necessaria esta activa
- Preparado para modulos futuros

---

## 12. SISTEMA DE TEMAS E UI (M11)

### 12.1 Design System
- **100% variaveis CSS** — zero valores hardcoded em componentes
- Ficheiro canonico: `tokens.css` (~620 linhas)
- Categorias de tokens: superficies, bordas, texto, status, badges, tipografia, espacamento, radius, sizes, sombras, motion, z-index

### 12.2 Temas
- `light` (default)
- `dark`
- Controlados via `data-theme` no `<body>`
- Dark mode redefine ~30 variaveis de cor

### 12.3 Paletas (6 opcoes)
| Paleta | Cor principal |
|--------|--------------|
| `indigo` (default) | #6366f1 |
| `emerald` | #10b981 |
| `rose` | #f43f5e |
| `amber` | #f59e0b |
| `slate` | #64748b |
| `ocean` | #0ea5e9 |

- Cada paleta redefine: brand-50/100/200/500/600/700/800, badge-role, nav-active, avatar, ring-color
- Dark mode tem overrides por paleta
- Classe: `.palette-{name}` no `<body>`

### 12.4 Layouts (3 opcoes)
- `sidebar` (default) — Sidebar fixa 224px
- `compact` — Sidebar compacta 60px (so icones)
- `topnav` — Barra de navegacao no topo

- Controlados via `data-layout` no `<body>`
- Alternaveis em tempo real

### 12.5 Persistencia de Preferencias
- Cookies: `cf_layout`, `cf_palette`, `cf_theme`
- Lidos no SSR (`hooks.server.ts` e `+layout.server.ts`) para evitar flash
- Injectados no `<body>` durante SSR via `transformPageChunk`
- Nunca localStorage (proibido pelo STACK_LOCK)

### 12.6 Componentes de Layout Partilhados
- `Sidebar.svelte` — Sidebar completa com nav items, brand, footer items, email do user
- `CompactSidebar.svelte` — Versao compacta com tooltips
- `Header.svelte` — Header com NotificationBell
- `NotificationBell.svelte` — Dropdown de notificacoes com badge, mark read, delete
- `ThemeSwitcher.svelte` — Seletor de layout/paleta/tema
- `Navigation.svelte` — Items de nav (icones SVG monocromaticos via `Icons.ts`)
- `PasswordChecklist.svelte` — Checklist visual de requisitos de password

---

## 13. SISTEMA i18n

### 13.1 Setup
- 2 idiomas: Portugues (PT) e Ingles (EN)
- Ficheiros: `messages/pt.json` e `messages/en.json` (~520 chaves cada)
- Compilados com Paraglide antes do build
- Importados como `import * as m from "$lib/paraglide/messages.js"`
- Uso: `m.team_title()`, `m.notif_body_invite_accepted({ email, role })`

### 13.2 Categorias de Chaves
- `auth_*` — Login, setup, reset, password
- `admin_dashboard_*` — Dashboard da empresa
- `team_*` — Gestao de equipa
- `super_*` — Painel super user
- `notif_*` — Notificacoes
- `backup_*` — Backups
- `activity_*` — Historico de actividade
- `profile_*` — Perfil pessoal
- `company_*` — Dados da empresa
- `common_*` — Textos genericos (botoes, labels)
- `role_*` — Labels de roles
- `status_*` — Labels de status
- `integrations_*` — Integracoes
- `email_*` — Templates de email
- `error_*` — Paginas de erro
- `module_*` — Modulos
- `theme_*` — Switcher de tema
- `invite_*` — Aceitar convite
- `confirm_*` — Modais de confirmacao

---

## 14. OBSERVABILIDADE (M13)

### 14.1 Logging
- JSON estruturado: `{ ts, level, context, trace_id, msg, ...meta }`
- Zero PII nos logs (emails, passwords, tokens redactados)
- Unico uso de `console.log` permitido: dentro do logger
- Niveis: debug, info, warn, error

### 14.2 Trace ID
- Propagado via header `X-Trace-Id` (request → response)
- Gerado automaticamente se nao presente (UUID v4)
- Incluido em todos os logs do request

### 14.3 Error Handler Global
- Captura excepcoes nao tratadas
- Redacta PII (emails, passwords, tokens)
- Resposta: RFC 9457 Problem JSON
- Sentry opcional: envia via fetch se `SENTRY_DSN` configurado

### 14.4 Graceful Shutdown
- `ctx.waitUntil()` no Cloudflare Workers
- Garante que operacoes pendentes terminam

---

## 15. CONFIGURACAO E SECRETS

### 15.1 Variaveis de Ambiente
- `APP_ENV` — "production" / "development"
- `APP_URL` — URL da app (ex: `https://cf-base.acemang-jedi.workers.dev`)

### 15.2 Secrets (via `wrangler secret put`)
- `CSRF_SECRET` — HMAC-SHA-256 para CSRF (min 64 hex chars)
- `SESSION_SECRET` — HMAC-SHA-256 para sessoes
- `ENCRYPTION_KEY` — AES-256-GCM para credenciais de integracoes
- `CF_ACCOUNT_ID` — ID da conta Cloudflare
- `CF_API_TOKEN` — Token API Cloudflare
- `SENTRY_DSN` — (opcional) DSN do Sentry

### 15.3 Bindings (Cloudflare)
- `DB` — D1 Database
- `R2_BUCKET` — R2 Bucket para ficheiros
- `RATE_LIMITER` — Durable Object para rate limiting
- `ASSETS` — Assets estaticos (SvelteKit build)

---

## 16. CRON JOBS

- Trigger: `0 0 * * *` (meia-noite UTC, timezone Europe/Lisbon)
- Handler: `scheduleAutoBackup(env.DB, env.R2_BUCKET)`
- Funcao: percorre empresas com backup auto activo e executa backup conforme frequencia

---

## 17. ARMAZENAMENTO DE FICHEIROS (R2)

### 17.1 Namespacing
- Avatares: `users/{user_id}/avatars/avatar.webp`
- Logotipos: `tenants/{tenant_id}/logos/logo.webp`
- Backups: `backups/{tenant_id}/{backup_id}.json`

### 17.2 Validacoes de Upload
- Formato: WebP obrigatorio (magic bytes RIFF...WEBP)
- Tamanho: max 200 KB
- Dimensoes: max 512x512 pixels
- Dimensoes lidas directamente do header WebP (VP8/VP8L/VP8X) sem Canvas API

---

## 18. FORMATO DE ERROS

- Padrao: RFC 7807 / RFC 9457 Problem Details
- Content-Type: `application/problem+json`
- Campos: `{ type, title, status, detail?, instance?, ...extra }`
- Erros de autenticacao SEMPRE genericos: "Invalid credentials"
- Erros de validacao: `{ errors: [{ field, message }] }` dentro do Problem
- Funcoes helper: `problemResponse()`, `authErrorResponse()`, `forbiddenResponse()`, `validationErrorResponse()`

---

## 19. PAGINACAO

- SEMPRE cursor-based (zero OFFSET)
- Schema: `{ cursor?: string, limit: 1-100, default 20 }`
- Resposta: `{ data/items, next_cursor, has_more? }`
- Cursor e tipicamente o `created_at` timestamp ou ID do ultimo item

---

## 20. IDS

- Formato: `lower(hex(randomblob(16)))` — 32 caracteres hex lowercase
- Gerados pela DB (SQLite default) ou `crypto.randomUUID()` para sessoes
- Regex: `/^[0-9a-f]{32}$/`

---

## 21. TEMPLATES DE EMAIL

### 21.1 Layout Base
- HTML compativel com clientes de email (tabelas, inline styles)
- Estrutura: header com nome da app → body → footer
- Funcoes helper: `baseEmailHtml()`, `ctaButton()`, `para()`, `fallbackUrl()`

### 21.2 Templates Existentes
- **Convite:** link para aceitar convite + nome da empresa
- **Password Reset:** link de reset (expira 1h)
- **Activacao de empresa:** notificacao ao owner
- **Desactivacao de empresa:** notificacao ao owner
- **Elevacao concedida:** notificacao ao membro elevado
- **Elevacao expirada:** notificacao ao membro
- **Verificacao de integracao:** email com link de confirmacao

---

## 22. PAGINA DE ERRO GLOBAL

- Componente `+error.svelte` na raiz
- Mostra codigo de erro (403, 404, 500, etc.) com mensagens i18n
- Layout centrado com icone/ilustracao
- Botao "Voltar ao inicio"

---

## 23. ROUTING FRONTEND (MAPA COMPLETO)

```
/                           → Redirect (login ou dashboard)
/setup                      → Setup inicial
/login                      → Login
/logout                     → Logout (server route)
/password-reset             → Pedir reset
/password-reset/[token]     → Nova password
/invite/[token]             → Aceitar convite

(super)/ — Layout com guard super_user
  /super/dashboard          → Painel super
  /super/tenants            → Lista empresas
  /super/tenants/new        → Criar empresa
  /super/tenants/[id]       → Detalhe empresa
  /super/integrations       → Integracoes
  /super/integrations/confirm → Confirmar verificacao email
  /super/audit              → Audit log + break-glass
  /super/settings           → Configuracoes globais
  /super/backups            → Backups globais

(admin)/ — Layout com guard auth + tenant_id
  /dashboard                → Dashboard empresa
  /team                     → Equipa
  /notifications            → Notificacoes
  /backups                  → Backups empresa
  /activity                 → Historico actividade
  /profile                  → Perfil pessoal
  /modules/[id]             → Pagina de modulo
```

### 23.1 Layout Guards
- `(super)/+layout.server.ts` — Rejeita nao-super_user → redirect `/login` ou `/`
- `(admin)/+layout.server.ts` — Rejeita nao-autenticados → `/login`; super_user → `/super/dashboard`; sem tenant → `/login`
- Ambos carregam `user` via `GET /api/auth/me`

### 23.2 Layout (admin) carrega tambem:
- `unreadNotifCount` via `/api/user/notifications/unread-count`
- `navModules` via `/api/user/nav` (itens de navegacao filtrados por role)

---

## 24. COMPONENTES E UX PATTERNS

### 24.1 Formularios
- Todos usam SvelteKit `enhance()` para submissao
- CSRF token passado como hidden input: `<input type="hidden" name="csrf" value={csrfToken}>`
- Loading state com botoes disabled durante submissao
- Alertas de erro/sucesso com classes de status tokens

### 24.2 Tabelas
- Cursor-based pagination com link "Carregar mais →"
- Header background: `var(--bg-table-header)`
- Status badges com cores semnticas
- Botoes de accao inline

### 24.3 Modais de Confirmacao
- Overlay: `var(--bg-overlay)`
- Card centrado com titulo, corpo, botoes cancelar/confirmar
- Zona de perigo: cor `var(--color-danger)` nos botoes destrutivos

### 24.4 Badge System
- Roles: background `var(--badge-role-bg)`, cor `var(--badge-role-text)` (varia com paleta)
- Status: success (verde), warning (amarelo), error (vermelho), info (azul)
- Contagem: badge circular para notificacoes nao-lidas

### 24.5 Icones
- SVG inline monocromaticos (tipo Lucide)
- Definidos em `Icons.ts` como strings HTML
- Icones: layoutDashboard, users, bell, hardDrive, clipboardList, user, settings, mail, shield, etc.
- Tamanho controlado por CSS (stroke: currentColor, fill: none)

---

## 25. REGRAS DE NEGOCIO IMPORTANTES

### 25.1 Criacao de Empresa (Flow Completo)
1. Super user preenche formulario com dados da empresa + email do owner
2. Sistema cria tenant com `status = 'pending'`
3. Sistema cria convite de owner (role=tenant_admin, is_owner=1)
4. Email com link de convite enviado ao owner (se integracao activa)
5. Owner clica no link, cria password, aceita convite
6. Sistema cria user owner + activa o tenant (`status = 'active'`)
7. Notificacao enviada aos admins: "Convite aceite"

### 25.2 Elevacao Temporaria (Flow)
1. Super user seleciona membro da empresa
2. Define duracao (1h a 7 dias, default 24h)
3. Membro fica com `is_temp_owner=1` e `temp_owner_expires_at`
4. Notificacao enviada ao membro: "Elevacao concedida"
5. Quando expira (ou revogada): `is_temp_owner=0`, notificacao enviada

### 25.3 Transferencia de Ownership (Irreversivel)
1. Super user seleciona novo owner (deve ser membro)
2. Sistema troca: owner antigo perde `is_owner=1`, novo ganha
3. Se novo owner era temp_owner → revogada automaticamente
4. Log de auditoria registado

### 25.4 Auto-Eliminacao de Conta
- Owner fixo NAO pode auto-eliminar (deve transferir ownership primeiro)
- Owner temporario NAO pode auto-eliminar (deve esperar expiracao)
- Outros podem: soft delete, limpa sessao, anonimiza dados

### 25.5 Limites de Seats
- `admin_seat_limit` → limite de socios/membros (role=member + tenant_admin) — ATENCAO: apesar do nome "admin", aplica-se a socios. Min 1 — o owner conta.
- `member_seat_limit` → limite de colaboradores (role=collaborator) — ATENCAO: apesar do nome "member", aplica-se a colaboradores!
- `client_seat_limit` → limite de clientes (role=client)
- Verificados no convite (nao permite criar se limite atingido)
- Dashboard mostra used/limit para cada tipo

---

## 26. EMAILS TRANSACCIONAIS (Quando sao enviados)

| Momento | Destinatario | Template |
|---------|-------------|----------|
| Convite criado (super cria empresa) | Owner email | Convite |
| Convite criado (admin convida membro) | Email convidado | Convite |
| Password reset pedido | Email do user | Reset link |
| Empresa activada | Owners | Activacao |
| Empresa desactivada | Owners | Desactivacao |
| Elevacao concedida | Membro elevado | Elevacao |
| Elevacao expirada | Membro | Elevacao expirada |
| Verificacao de integracao | Email de teste | Verificacao |

---

## 27. TESTES

### 27.1 Stack de Testes
- Framework: Vitest
- Testes unitarios: services, middleware, queries, utils
- Testes E2E: Playwright (configurado, nao exaustivo)

### 27.2 Ficheiros de Teste Existentes
- `auth.test.ts` — login, sessoes
- `csrf.test.ts` — CSRF middleware
- `middleware.test.ts` — auth middleware
- `session.test.ts` — gestao de sessoes
- `tenant.test.ts` — servico de tenants
- `team.test.ts` — servico de equipa
- `invitation.test.ts` — convites
- `backup.test.ts` — backups
- `profile.test.ts` — perfil
- `user.test.ts` — servico de user
- `activity.test.ts` — activity log
- `token.test.ts` — tokens de uso unico
- `queries.test.ts` — queries DB
- `logger.test.ts` — logger
- `problem.test.ts` — problem responses
- `security-headers.test.ts` — headers de seguranca
- `modules.test.ts` — modulos
- `observability.test.ts` — observabilidade
- `rate-limiter-do.test.ts` — rate limiter

---

## 28. RESUMO — CHECKLIST DE IMPLEMENTACAO

Para reconstruir esta app, implementar pela seguinte ordem:

1. **Setup DB** — Criar todas as tabelas (seccao 3)
2. **Auth** — Setup, login, logout, me, CSRF, sessoes, password reset (seccoes 4.1-4.3, 5)
3. **Super User - Empresas** — CRUD + convites (seccao 4.5)
4. **Convites** — Aceitar convite, criar user, activar tenant (seccao 4.4)
5. **Admin - Equipa** — CRUD membros/colaboradores/clientes, convites, permissoes (seccao 4.10)
6. **Admin - Dashboard** — Stats, accoes rapidas (seccao 11.3)
7. **Perfil** — CRUD pessoal, avatar, email, password, empresa, logo (seccoes 4.14, 4.11)
8. **Notificacoes** — CRUD + bell dropdown (seccoes 4.15, 7)
9. **Integracoes** — CRUD + test + activate + email verify (seccoes 4.6, 6)
10. **Backups** — Manual + auto + download + config (seccoes 4.13, 4.8, 8)
11. **Activity & Audit** — Logs, export CSV, break-glass (seccoes 4.12, 4.7, 9)
12. **Modulos** — Registry, limites, permissoes (seccao 10)
13. **Temas** — 2 temas, 6 paletas, 3 layouts (seccao 12)
14. **i18n** — PT + EN, ~520 chaves (seccao 13)
15. **Security** — Headers, rate limit, encryption (seccao 5)
16. **Cron** — Backup automatico (seccao 16)

---

*Fim do briefing v2. Tudo o que esta aqui esta implementado. Se nao esta neste documento, nao implementar.*
