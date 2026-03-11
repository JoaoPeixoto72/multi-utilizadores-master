-- migrations/0001_auth.sql
-- Migração base: users + sessions
-- R: STACK_LOCK.md §7 — schema base
-- Forward-only — destrutivas requerem aprovação humana

-- ── Utilizadores ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email       TEXT    NOT NULL UNIQUE,
  pass_hash   TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── Sessões ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signed_token TEXT    NOT NULL UNIQUE,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(signed_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
