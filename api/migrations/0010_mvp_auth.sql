-- 0010_mvp_auth.sql
-- MVP Auth: tablas OTP + sesiones; columnas nuevas en profiles, profile_links, profile_contact.
-- NOTA: Los ALTER TABLE no soportan IF NOT EXISTS en SQLite/D1.
--       Si ya existen en producción, ejecutar solo los CREATE TABLE.

-- ── Nuevas tablas ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_otp (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_email ON auth_otp (email, expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token  ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions (user_id);

-- ── Columnas nuevas en profiles / profile_links / profile_contact ─────────────
-- NOTE: ALTER TABLE ADD COLUMN omitidos — en producción estas columnas ya existen.
-- SQLite/D1 no soporta ADD COLUMN IF NOT EXISTS, y fallarían con "duplicate column".
-- La migración 0012 reconstruye estas tablas con el schema completo (seguro para
-- ambos casos: prod y DBs nuevas).

-- Garantizar 1 usuario = 1 perfil
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_unique ON profiles (user_id);
