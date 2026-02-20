-- ============================================================
-- INTAP LINK — Migración 0001: Schema inicial completo
-- Base de datos: D1 (intap_db)
-- Fecha: 2026-02-19
-- ============================================================

-- -------------------------
-- TABLAS DE CATÁLOGO / CONTROL
-- -------------------------

CREATE TABLE IF NOT EXISTS plans (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_limits (
  plan_id      TEXT PRIMARY KEY,
  max_links    INTEGER NOT NULL DEFAULT 5,
  max_photos   INTEGER NOT NULL DEFAULT 3,
  max_faqs     INTEGER NOT NULL DEFAULT 3,
  can_use_vcard BOOLEAN NOT NULL DEFAULT 0,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS modules (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  effects_json TEXT NOT NULL DEFAULT '{}'
);

-- -------------------------
-- USUARIOS Y AUTENTICACIÓN
-- -------------------------

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS magic_link_codes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- -------------------------
-- PERFILES Y CONTENIDO
-- -------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  plan_id      TEXT NOT NULL DEFAULT 'free',
  theme_id     TEXT NOT NULL DEFAULT 'default',
  name         TEXT,
  bio          TEXT,
  is_published BOOLEAN NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS profile_links (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_faqs (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_gallery (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  image_key  TEXT NOT NULL,
  alt_text   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- -------------------------
-- MÓDULOS ACTIVOS POR PERFIL
-- -------------------------

CREATE TABLE IF NOT EXISTS profile_modules (
  profile_id  TEXT NOT NULL,
  module_code TEXT NOT NULL,
  expires_at  DATETIME,
  activated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, module_code),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (module_code) REFERENCES modules(code)
);

-- -------------------------
-- ANALÍTICAS
-- -------------------------

CREATE TABLE IF NOT EXISTS analytics (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_id  TEXT,
  ip_hash    TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analytics_profile_event ON analytics (profile_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles (slug);
CREATE INDEX IF NOT EXISTS idx_profile_links_profile ON profile_links (profile_id, sort_order);
