-- 0017_ensure_all_table_schemas.sql
-- Objetivo: garantizar que profiles, profile_links y profile_contact
-- tienen TODAS las columnas que el Worker necesita, sin importar el estado
-- en que quedaron las migraciones anteriores (0010, 0012, 0016 pudieron
-- haber fallado parcialmente en producción).
--
-- Estrategia: rename-table para cada tabla (seguro en SQLite/D1):
--   1. Crear tabla_new con el schema completo
--   2. INSERT OR IGNORE de las columnas garantizadas (schema 0001 + 0009)
--   3. DROP TABLE tabla
--   4. RENAME tabla_new → tabla
--   5. Recrear índices
--
-- No seleccionamos columnas que pueden no existir (whatsapp_number,
-- avatar_url, category, subcategory, updated_at, is_active, etc.) para
-- que el INSERT funcione sin importar el estado actual del schema.
-- Esos campos quedan NULL/DEFAULT, que es el valor correcto para datos
-- que no pudieron setearse antes.

PRAGMA foreign_keys = OFF;
BEGIN;

-- ── 1. Limpiar tablas huérfanas de migraciones anteriores fallidas ─────────────
DROP TABLE IF EXISTS profiles_new;
DROP TABLE IF EXISTS profiles_v16;
DROP TABLE IF EXISTS profiles_new_0004;
DROP TABLE IF EXISTS profile_links_new;
DROP TABLE IF EXISTS profile_contact_new;

-- ── 2. Reconstruir profiles con schema completo ───────────────────────────────
CREATE TABLE profiles_v17 (
  id              TEXT     PRIMARY KEY,
  user_id         TEXT     NOT NULL,
  slug            TEXT     UNIQUE NOT NULL,
  plan_id         TEXT     NOT NULL DEFAULT 'free',
  theme_id        TEXT     NOT NULL DEFAULT 'default',
  name            TEXT,
  bio             TEXT,
  is_published    INTEGER  NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
  whatsapp_number TEXT,
  avatar_url      TEXT,
  category        TEXT,
  subcategory     TEXT,
  updated_at      DATETIME,
  is_active       INTEGER  NOT NULL DEFAULT 1
);

-- Copiar usando SOLO las columnas que existen desde 0001 (garantizadas).
-- user_id=NULL (perfil demo legacy) queda excluido por el WHERE.
INSERT OR IGNORE INTO profiles_v17
  (id, user_id, slug, plan_id, theme_id, name, bio, is_published, created_at)
SELECT
  id,
  user_id,
  slug,
  COALESCE(plan_id, 'free'),
  COALESCE(theme_id, 'default'),
  name,
  bio,
  COALESCE(is_published, 0),
  COALESCE(created_at, datetime('now'))
FROM profiles
WHERE user_id IS NOT NULL;

DROP TABLE profiles;
ALTER TABLE profiles_v17 RENAME TO profiles;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug        ON profiles (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_unique ON profiles (user_id);
CREATE INDEX        IF NOT EXISTS idx_profiles_user_id     ON profiles (user_id);
CREATE INDEX        IF NOT EXISTS idx_profiles_active      ON profiles (is_active, is_published);

-- ── 3. Reconstruir profile_links con is_active y updated_at ──────────────────
CREATE TABLE profile_links_v17 (
  id         TEXT     PRIMARY KEY,
  profile_id TEXT     NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  label      TEXT     NOT NULL,
  url        TEXT     NOT NULL,
  sort_order INTEGER  NOT NULL DEFAULT 0,
  is_active  INTEGER  NOT NULL DEFAULT 1,
  updated_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO profile_links_v17
  (id, profile_id, label, url, sort_order, created_at)
SELECT
  id, profile_id, label, url,
  COALESCE(sort_order, 0),
  COALESCE(created_at, datetime('now'))
FROM profile_links;

DROP TABLE profile_links;
ALTER TABLE profile_links_v17 RENAME TO profile_links;

CREATE INDEX IF NOT EXISTS idx_profile_links_profile      ON profile_links (profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_profile_links_active_sort  ON profile_links (profile_id, is_active, sort_order);

-- ── 4. Reconstruir profile_contact con updated_at ────────────────────────────
CREATE TABLE profile_contact_v17 (
  profile_id TEXT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  whatsapp   TEXT,
  email      TEXT,
  phone      TEXT,
  hours      TEXT,
  address    TEXT,
  map_url    TEXT,
  updated_at DATETIME
);

INSERT OR IGNORE INTO profile_contact_v17
  (profile_id, whatsapp, email, phone, hours, address, map_url)
SELECT
  profile_id, whatsapp, email, phone, hours, address, map_url
FROM profile_contact;

DROP TABLE profile_contact;
ALTER TABLE profile_contact_v17 RENAME TO profile_contact;

-- ── 5. Garantizar plan 'free' (requerido por onboarding /claim) ───────────────
INSERT OR IGNORE INTO plans (id, name) VALUES ('free', 'Free');
INSERT OR IGNORE INTO plan_limits (plan_id, max_links, max_photos, max_faqs, can_use_vcard)
VALUES ('free', 5, 3, 3, 0);

COMMIT;
PRAGMA foreign_keys = ON;
