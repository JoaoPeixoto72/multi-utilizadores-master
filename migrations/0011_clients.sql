-- migrations/0011_clients.sql
-- Adiciona role 'client' e client_seat_limit ao sistema
-- Hierarquia: super_user > empresa > socios (tenant_admin/member) > colaboradores > clientes
-- Forward-only

-- ── 1. Adicionar client_seat_limit ao tenants ───────────────────────────────
ALTER TABLE tenants ADD COLUMN client_seat_limit INTEGER NOT NULL DEFAULT 0;

-- ── 2. Re-criar tabela users com o novo CHECK constraint para role ──────────
-- SQLite nao suporta ALTER COLUMN CHECK, por isso re-criamos

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id                    TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email                 TEXT    NOT NULL UNIQUE,
  pass_hash             TEXT    NOT NULL,
  tenant_id             TEXT    REFERENCES tenants(id) ON DELETE SET NULL,
  role                  TEXT    NOT NULL DEFAULT 'collaborator'
                          CHECK (role IN ('super_user','tenant_admin','member','collaborator','client')),
  is_owner              INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0,1)),
  display_name          TEXT,
  first_name            TEXT,
  last_name             TEXT,
  phone                 TEXT,
  website               TEXT,
  avatar_key            TEXT,
  preferred_language    TEXT    NOT NULL DEFAULT 'pt',
  status                TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','inactive','deleted')),
  is_temp_owner         INTEGER NOT NULL DEFAULT 0 CHECK (is_temp_owner IN (0,1)),
  temp_owner_expires_at INTEGER,
  email_pending         TEXT,
  email_token           TEXT,
  email_token_expires_at INTEGER,
  module_permissions    TEXT    NOT NULL DEFAULT '{}',
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO users_new
  SELECT id, email, pass_hash, tenant_id, role, is_owner,
         display_name, first_name, last_name, phone, website, avatar_key,
         preferred_language, status, is_temp_owner, temp_owner_expires_at,
         email_pending, email_token, email_token_expires_at,
         COALESCE(module_permissions, '{}'),
         created_at, updated_at
  FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Re-criar indices
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status    ON users(status);

PRAGMA foreign_keys = ON;

-- ── 3. Actualizar invitations CHECK para incluir 'client' ──────────────────
-- Nota: invitations.role ja permite 'collaborator', adicionamos 'client'
-- Como SQLite nao suporta ALTER CHECK, recriamos

PRAGMA foreign_keys = OFF;

CREATE TABLE invitations_new (
  id                  TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id           TEXT    REFERENCES tenants(id) ON DELETE CASCADE,
  email               TEXT    NOT NULL,
  role                TEXT    NOT NULL
                        CHECK (role IN ('tenant_admin','member','collaborator','client')),
  is_owner            INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0,1)),
  invited_by          TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT    NOT NULL UNIQUE,
  module_permissions  TEXT    NOT NULL DEFAULT '{}',
  language            TEXT    NOT NULL DEFAULT 'pt',
  status              TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','cancelled','expired')),
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at          INTEGER NOT NULL,
  accepted_at         INTEGER,
  cancelled_at        INTEGER
);

INSERT INTO invitations_new SELECT * FROM invitations;

DROP TABLE invitations;
ALTER TABLE invitations_new RENAME TO invitations;

CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id  ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email      ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_status     ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

PRAGMA foreign_keys = ON;
