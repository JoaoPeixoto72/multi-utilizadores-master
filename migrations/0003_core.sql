-- migrations/0003_core.sql
-- Multi-tenancy: tenants, users extendido, invitations, limites, contadores
-- R: BUILD_PLAN.md §M2.1 | briefing.md §1.2, §2
-- Forward-only — nunca modificar após aplicar em produção

-- ── Empresas (tenants) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id                   TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name                 TEXT    NOT NULL,
  address              TEXT,
  email                TEXT    NOT NULL UNIQUE,
  phone                TEXT,
  website              TEXT,
  logo_key             TEXT,                          -- R2 key
  admin_seat_limit     INTEGER NOT NULL DEFAULT 3,
  member_seat_limit    INTEGER NOT NULL DEFAULT 10,
  storage_limit_bytes  INTEGER NOT NULL DEFAULT 1073741824, -- 1 GB
  daily_email_limit    INTEGER NOT NULL DEFAULT 100,
  allowed_languages    TEXT    NOT NULL DEFAULT '["pt","en"]', -- JSON array
  status               TEXT    NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','inactive','deleted')),
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at           INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tenants_status     ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_email      ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at);

-- ── Estender tabela users (já existe em 0001_auth.sql) ───────────────────────
-- tenant_id: NULL para super_user; FK para tenants.id para todos os outros
ALTER TABLE users ADD COLUMN tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'collaborator'
  CHECK (role IN ('super_user','tenant_admin','member','collaborator'));
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0
  CHECK (is_owner IN (0,1));
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN website TEXT;
ALTER TABLE users ADD COLUMN avatar_key TEXT;                  -- R2 key
ALTER TABLE users ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'pt';
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','inactive','deleted'));
ALTER TABLE users ADD COLUMN is_temp_owner INTEGER NOT NULL DEFAULT 0
  CHECK (is_temp_owner IN (0,1));
ALTER TABLE users ADD COLUMN temp_owner_expires_at INTEGER;    -- unixepoch

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status    ON users(status);

-- ── Convites ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id                  TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id           TEXT    REFERENCES tenants(id) ON DELETE CASCADE,
  email               TEXT    NOT NULL,
  role                TEXT    NOT NULL
                        CHECK (role IN ('tenant_admin','member','collaborator')),
  is_owner            INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0,1)),
  invited_by          TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT    NOT NULL UNIQUE,               -- hash SHA-256 do token
  module_permissions  TEXT    NOT NULL DEFAULT '{}',         -- JSON object
  language            TEXT    NOT NULL DEFAULT 'pt',
  status              TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','cancelled','expired')),
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at          INTEGER NOT NULL,                      -- unixepoch + 24h
  accepted_at         INTEGER,
  cancelled_at        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id  ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email      ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_status     ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- ── Limites de módulos por empresa ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_module_limits (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id   TEXT    NOT NULL,
  limit_key   TEXT    NOT NULL,
  limit_value TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tenant_id, module_id, limit_key)
);

CREATE INDEX IF NOT EXISTS idx_tml_tenant_id ON tenant_module_limits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tml_module_id ON tenant_module_limits(module_id);

-- ── Uso de storage por empresa ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_storage_usage (
  tenant_id  TEXT    PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  bytes_used INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Contador de emails diários por empresa ────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_daily_email_count (
  tenant_id  TEXT    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,                               -- 'YYYY-MM-DD'
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tdec_tenant_id ON tenant_daily_email_count(tenant_id);

-- ── Configuração global da aplicação ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Valores iniciais de configuração
INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('app_name',                    'cf-base'),
  ('default_language',            'pt'),
  ('max_invitation_validity_h',   '24'),
  ('temp_owner_default_h',        '24'),
  ('session_expiry_days',         '30'),
  ('max_login_attempts',          '10'),
  ('login_lockout_minutes',       '15'),
  ('password_reset_expiry_h',     '1'),
  ('daily_email_limit_default',   '100'),
  ('storage_limit_bytes_default', '1073741824');
