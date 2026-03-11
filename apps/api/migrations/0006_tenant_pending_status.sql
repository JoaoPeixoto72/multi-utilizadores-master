-- migrations/0006_tenant_pending_status.sql
-- Adiciona 'pending' ao enum de status de tenants
-- R: BUILD_PLAN.md — tenant só fica active após owner aceitar convite
-- Forward-only — nunca modificar após aplicar em prod

-- SQLite não suporta ALTER COLUMN CHECK, por isso re-criamos a tabela
-- com a nova constraint, copiamos dados e fazemos drop+rename.

PRAGMA foreign_keys = OFF;

-- 1. Nova tabela com constraint actualizada
CREATE TABLE tenants_new (
  id                   TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name                 TEXT    NOT NULL,
  address              TEXT,
  email                TEXT    NOT NULL UNIQUE,
  phone                TEXT,
  website              TEXT,
  logo_key             TEXT,
  admin_seat_limit     INTEGER NOT NULL DEFAULT 3,
  member_seat_limit    INTEGER NOT NULL DEFAULT 10,
  storage_limit_bytes  INTEGER NOT NULL DEFAULT 1073741824,
  daily_email_limit    INTEGER NOT NULL DEFAULT 100,
  allowed_languages    TEXT    NOT NULL DEFAULT '["pt","en"]',
  status               TEXT    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','active','inactive','deleted')),
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at           INTEGER
);

-- 2. Copiar dados existentes
INSERT INTO tenants_new SELECT * FROM tenants;

-- 3. Substituir
DROP TABLE tenants;
ALTER TABLE tenants_new RENAME TO tenants;

-- 4. Re-criar índices
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_email  ON tenants(email);

PRAGMA foreign_keys = ON;
