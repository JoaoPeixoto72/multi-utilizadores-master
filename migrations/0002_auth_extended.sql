-- migrations/0002_auth_extended.sql
-- Extensão de auth: password_resets + rate_limit_log
-- R: STACK_LOCK.md §7, briefing.md §4 (reset password, rate limiting)
-- Forward-only

-- ── Reset de password ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id         TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,  -- hash do token (nunca guardar raw)
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,                  -- NULL = não usado
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id   ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token     ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires   ON password_resets(expires_at);
