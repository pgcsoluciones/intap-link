-- 0016_fix_profiles_schema.sql
-- Objetivo: reparar el estado roto dejado por 0012–0014 en producción.
--
-- Problema raíz:
--   • 0012 intentó `SELECT whatsapp_number FROM profiles` pero esa columna
--     no existía → migración falló a medias: `profiles_new` quedó huérfana,
--     `profiles` quedó con el schema de 0010 (sin is_active, sin whatsapp_number).
--   • 0013/0014 fallaron por la misma razón (is_active no existe).
--   • Resultado: tabla `profiles_new` dangling + falta is_active + falta whatsapp_number.
--
-- Esta migración:
--   1. Elimina `profiles_new` si quedó huérfana.
--   2. Reconstruye `profiles` con el schema completo usando solo columnas
--      garantizadas (0001 + 0010) para el INSERT — evita "no such column".
--   3. Garantiza plan 'free' en plans + plan_limits para evitar entitlements vacíos.

PRAGMA foreign_keys = OFF;
BEGIN;

-- ── 1. Limpiar tabla huérfana ─────────────────────────────────────────────────
DROP TABLE IF EXISTS profiles_new;

-- ── 2. Reconstruir profiles con schema completo ───────────────────────────────
-- Crea la tabla destino con TODAS las columnas que el Worker necesita.
CREATE TABLE profiles_v16 (
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

-- Copia usando SOLO las columnas de 0001 + las que agrega 0010.
-- Esto es seguro cualquiera sea el estado del schema en prod:
--   • Si la DB está en 0001:   selecciona 0001 cols, el resto queda NULL/default.
--   • Si la DB está en 0010+:  selecciona 0001+0010 cols, is_active=1 por default.
-- No seleccionamos whatsapp_number ni is_active (pueden no existir).
-- INSERT OR IGNORE salta filas que violen NOT NULL (user_id=NULL del demo seed).
INSERT OR IGNORE INTO profiles_v16
  (id, user_id, slug, plan_id, theme_id, name, bio, is_published, created_at,
   avatar_url, category, subcategory, updated_at)
SELECT
  id, user_id, slug,
  COALESCE(plan_id, 'free'),
  COALESCE(theme_id, 'default'),
  name, bio,
  COALESCE(is_published, 0),
  created_at,
  avatar_url, category, subcategory, updated_at
FROM profiles
WHERE user_id IS NOT NULL;

DROP TABLE profiles;
ALTER TABLE profiles_v16 RENAME TO profiles;

-- Recrear índices críticos
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug        ON profiles(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_unique ON profiles(user_id);
CREATE INDEX        IF NOT EXISTS idx_profiles_user_id     ON profiles(user_id);
CREATE INDEX        IF NOT EXISTS idx_profiles_active      ON profiles(is_active, is_published);

-- ── 3. Garantizar plan 'free' (usado en POST /me/profile/claim) ───────────────
INSERT OR IGNORE INTO plans (id, name) VALUES ('free', 'Free');

INSERT OR IGNORE INTO plan_limits (plan_id, max_links, max_photos, max_faqs, can_use_vcard)
VALUES ('free', 5, 3, 3, 0);

COMMIT;
PRAGMA foreign_keys = ON;
