-- migrations/0005_profiles.sql
-- Perfis + Armazenamento (M5)
-- R: BUILD_PLAN.md §M5 | briefing.md §3.5, §3.6, §3.9
-- Forward-only — nunca modificar após aplicar em produção

-- ── Estender tabela users ─────────────────────────────────────────────────────
-- Separar nome/apelido (briefing §3.5: "nome, apelido" como campos distintos)
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name  TEXT;

-- Alteração de email pendente (briefing §3.6)
ALTER TABLE users ADD COLUMN email_pending TEXT;         -- novo email aguardando confirmação
ALTER TABLE users ADD COLUMN email_token   TEXT;         -- token de confirmação (1h) — unicidade via índice UNIQUE abaixo
ALTER TABLE users ADD COLUMN email_token_expires_at INTEGER; -- unixepoch

-- Índice UNIQUE para email_token (substitui a restrição UNIQUE inline — SQLite não suporta ADD COLUMN UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_token_unique ON users(email_token)
  WHERE email_token IS NOT NULL;

-- Índice para lookup de email pendente (verificar duplicados antes de emitir token)
CREATE INDEX IF NOT EXISTS idx_users_email_pending ON users(email_pending)
  WHERE email_pending IS NOT NULL;

-- Índice para avatar_key (lookup de R2 por utilizador)
CREATE INDEX IF NOT EXISTS idx_users_avatar_key ON users(avatar_key)
  WHERE avatar_key IS NOT NULL;

-- ── Índices em tenants ────────────────────────────────────────────────────────
-- Lookup de logo por tenant (R2 cleanup)
CREATE INDEX IF NOT EXISTS idx_tenants_logo_key ON tenants(logo_key)
  WHERE logo_key IS NOT NULL;
