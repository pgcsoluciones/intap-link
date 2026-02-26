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

-- ── Columnas nuevas en profiles ──────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN avatar_url  TEXT;
ALTER TABLE profiles ADD COLUMN category    TEXT;
ALTER TABLE profiles ADD COLUMN subcategory TEXT;
ALTER TABLE profiles ADD COLUMN updated_at  DATETIME;

-- Garantizar 1 usuario = 1 perfil
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_unique ON profiles (user_id);

-- ── Columnas nuevas en profile_links ─────────────────────────────────────────

ALTER TABLE profile_links ADD COLUMN is_active  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE profile_links ADD COLUMN updated_at DATETIME;

-- ── Columnas nuevas en profile_contact ───────────────────────────────────────

ALTER TABLE profile_contact ADD COLUMN updated_at DATETIME;
