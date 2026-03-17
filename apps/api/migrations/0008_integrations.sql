-- migrations/0008_integrations.sql
-- M7 — Integrações Externas
-- R: BUILD_PLAN.md §M7.1

-- Tabela de integrações (uma activa por categoria, excepto payments)
CREATE TABLE IF NOT EXISTS integrations (
  id                    TEXT PRIMARY KEY,
  category              TEXT NOT NULL CHECK (category IN (
                          'email','sms','llm','cloud_storage',
                          'calendar','payments','invoicing','pdf'
                        )),
  provider              TEXT NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  is_active             INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  tested_at             TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Índice: categoria + activa (para getActiveAdapter)
CREATE INDEX IF NOT EXISTS idx_integrations_category_active
  ON integrations (category, is_active);

-- Índice: provider
CREATE INDEX IF NOT EXISTS idx_integrations_provider
  ON integrations (provider);

-- Trigger: actualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS trg_integrations_updated_at
  AFTER UPDATE ON integrations
  FOR EACH ROW
BEGIN
  UPDATE integrations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
