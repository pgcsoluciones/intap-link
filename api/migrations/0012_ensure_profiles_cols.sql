-- 0012_ensure_profiles_cols.sql
-- Garantiza que profiles tenga avatar_url, category, subcategory, updated_at
-- y que profile_links tenga is_active y updated_at.
-- Usa estrategia rename para sortear la limitación de SQLite/D1
-- (no soporta ADD COLUMN IF NOT EXISTS).
--
-- DATO IMPORTANTE: la copia de profiles solo selecciona columnas pre-0010
-- (id → whatsapp_number). Los valores de avatar_url/category/subcategory
-- quedan NULL, lo cual es correcto si 0010 nunca se aplicó en prod.
-- Si 0010 ya corrió y hay datos en esas columnas, se perderían —
-- pero dado que auth estaba roto, esos campos siguen vacíos en prod.

-- ── profiles ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles_new (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  plan_id         TEXT NOT NULL DEFAULT 'free',
  theme_id        TEXT NOT NULL DEFAULT 'default',
  name            TEXT,
  bio             TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
  whatsapp_number TEXT,
  avatar_url      TEXT,
  category        TEXT,
  subcategory     TEXT,
  updated_at      DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- Copia datos preservando columnas base (las nuevas quedan NULL por defecto)
INSERT OR IGNORE INTO profiles_new
  (id, user_id, slug, plan_id, theme_id, name, bio, is_published, created_at, whatsapp_number)
  SELECT id, user_id, slug, plan_id, theme_id, name, bio, is_published, created_at, whatsapp_number
  FROM profiles;

DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;

CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_unique ON profiles (user_id);

-- ── profile_links: agregar is_active y updated_at ────────────────────────────

CREATE TABLE IF NOT EXISTS profile_links_new (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO profile_links_new
  (id, profile_id, label, url, sort_order, is_active, created_at)
  SELECT id, profile_id, label, url, sort_order, 1, created_at
  FROM profile_links;

DROP TABLE profile_links;
ALTER TABLE profile_links_new RENAME TO profile_links;

CREATE INDEX IF NOT EXISTS idx_profile_links_profile ON profile_links (profile_id, sort_order);

-- ── profile_contact: agregar updated_at ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_contact_new (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  whatsapp   TEXT,
  email      TEXT,
  phone      TEXT,
  hours      TEXT,
  address    TEXT,
  map_url    TEXT,
  updated_at DATETIME
);

INSERT OR IGNORE INTO profile_contact_new
  (profile_id, whatsapp, email, phone, hours, address, map_url)
  SELECT profile_id, whatsapp, email, phone, hours, address, map_url
  FROM profile_contact;

DROP TABLE profile_contact;
ALTER TABLE profile_contact_new RENAME TO profile_contact;
