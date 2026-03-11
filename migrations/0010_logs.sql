-- migrations/0010_logs.sql
-- M9 — Histórico de actividade + Audit log
-- R: BUILD_PLAN.md §M9.1

-- ── activity_log ──────────────────────────────────────────────────────────────
-- Registo por empresa de acções dos utilizadores (visível ao admin)
CREATE TABLE IF NOT EXISTS activity_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    TEXT    NOT NULL,
  actor_id     TEXT    NOT NULL,
  actor_name   TEXT    NOT NULL,
  action       TEXT    NOT NULL,        -- ex: "user.invite", "user.delete", "backup.create"
  target_type  TEXT,                    -- ex: "user", "backup", "integration"
  target_id    TEXT,
  target_name  TEXT,
  metadata     TEXT    DEFAULT '{}',    -- JSON extra (sem dados pessoais sensíveis)
  was_temp_owner INTEGER DEFAULT 0,     -- 1 se o actor era owner temporário na altura
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_activity_log_tenant    ON activity_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor     ON activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action    ON activity_log(action);

-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Log de auditoria global append-only (visível apenas ao super user)
-- REGRA: NUNCA guardar dados pessoais (nomes, emails, passwords) — apenas IDs e contagens
-- Retenção: 365 dias (limpeza via cron em M13)
CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type      TEXT    NOT NULL,    -- ex: "tenant.created", "user.deleted", "backup.imported"
  actor_id        TEXT    NOT NULL,    -- ID do utilizador que despoletou o evento
  tenant_id       TEXT,               -- NULL para eventos globais (super user)
  target_type     TEXT,               -- ex: "tenant", "user", "backup"
  target_id       TEXT,
  bytes_affected  INTEGER DEFAULT 0,
  count_affected  INTEGER DEFAULT 0,
  metadata        TEXT    DEFAULT '{}', -- JSON sem dados pessoais
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type  ON audit_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor       ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant      ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON audit_log(created_at DESC);

-- ── break_glass_log ───────────────────────────────────────────────────────────
-- Registo de cada download do ficheiro break-glass
CREATE TABLE IF NOT EXISTS break_glass_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id     TEXT    NOT NULL,
  downloaded_at INTEGER NOT NULL DEFAULT (unixepoch())
);
