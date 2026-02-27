-- 0011_ensure_auth_schema.sql
-- Garantiza que auth_otp y sessions existan con el schema correcto,
-- independientemente de si 0010 se aplicó o no.
--
-- sessions usa DROP + CREATE porque:
--   (a) auth está roto en prod → no hay sesiones válidas que preservar
--   (b) SQLite no permite ALTER TABLE ADD COLUMN con DEFAULT de función

-- ── auth_otp (CREATE IF NOT EXISTS — seguro siempre) ──────────────────────────
CREATE TABLE IF NOT EXISTS auth_otp (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_email ON auth_otp (email, expires_at);

-- ── sessions (DROP + CREATE para garantizar created_at) ───────────────────────
-- Seguro: no hay sesiones válidas en producción (auth estaba roto).
DROP TABLE IF EXISTS sessions;

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions (user_id);
