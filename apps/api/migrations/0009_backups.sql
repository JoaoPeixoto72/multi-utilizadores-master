-- migrations/0009_backups.sql
-- M8 — Backups
-- R: BUILD_PLAN.md §M8.1

-- Tabela de backups
CREATE TABLE IF NOT EXISTS backups (
  id          TEXT PRIMARY KEY,               -- UUID v4
  tenant_id   TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'db_only', -- db_only | full
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | failed
  size_bytes  INTEGER,
  r2_key      TEXT,                            -- chave R2 onde o ZIP está guardado
  download_expires_at INTEGER,                 -- epoch ms — URL presigned expira em 24h
  error_msg   TEXT,                            -- preenchido se status = failed
  created_by  TEXT NOT NULL,                   -- user_id que pediu o backup
  created_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  completed_at INTEGER
);

-- Configuração de backup automático por empresa
CREATE TABLE IF NOT EXISTS backup_auto_config (
  tenant_id       TEXT PRIMARY KEY,
  enabled         INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
  frequency       TEXT NOT NULL DEFAULT 'weekly', -- daily | weekly | monthly
  day_of_week     INTEGER DEFAULT 0,          -- 0=Sunday..6=Saturday (weekly)
  retention_days  INTEGER NOT NULL DEFAULT 30,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_backups_tenant_id   ON backups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backups_status       ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created_at   ON backups(created_at DESC);
