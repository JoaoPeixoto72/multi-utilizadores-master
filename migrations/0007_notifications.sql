-- migrations/0007_notifications.sql
-- M6 — Sistema de Notificações
-- R: BUILD_PLAN.md §M6.1

-- Tabela principal de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,           -- UUID gerado na aplicação
  user_id      TEXT NOT NULL,              -- destinatário
  tenant_id    TEXT,                       -- NULL para super_user
  type         TEXT NOT NULL,              -- chave do tipo (ver enum abaixo)
  title_key    TEXT NOT NULL,              -- chave i18n do título
  body_key     TEXT NOT NULL,              -- chave i18n do corpo
  params       TEXT,                       -- JSON com variáveis para interpolação
  link         TEXT,                       -- URL interna de navegação (pode ser NULL)
  is_read      INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  read_at      TEXT,
  expires_at   TEXT,                       -- NULL = não expira

  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant
  ON notifications (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_expires
  ON notifications (expires_at)
  WHERE expires_at IS NOT NULL;
