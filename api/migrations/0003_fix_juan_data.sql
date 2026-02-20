-- ============================================================
-- INTAP LINK — Migración 0003: Limpieza de datos demo para juan
-- Base de datos: D1 (intap_db)
-- Fecha: 2026-02-20
-- Ejecutar:
--   npx wrangler d1 execute intap_db --remote \
--     --file=api/migrations/0003_fix_juan_data.sql
-- ============================================================

-- -------------------------
-- 1. Eliminar galería demo
--    Elimina filas cuyo image_key sea 'demo/*' o 'profile_debug*'
--    para el perfil 'juan'. Seguro idempotente.
-- -------------------------
DELETE FROM profile_gallery
WHERE profile_id = (SELECT id FROM profiles WHERE slug = 'juan')
  AND (
    image_key LIKE 'demo/%'
    OR image_key LIKE 'profile_debug%'
  );

-- -------------------------
-- 2. Corrección de typo en bio
--    La palabra correcta es "computadoras".
--    Cubre los typos más comunes: computadras / computadros / computadaras.
--    Solo actualiza si alguno de esos typos existe en el campo bio.
-- -------------------------
UPDATE profiles
SET bio = REPLACE(
            REPLACE(
              REPLACE(bio, 'computadras', 'computadoras'),
              'computadros', 'computadoras'),
            'computadaras', 'computadoras')
WHERE slug = 'juan'
  AND (
    bio LIKE '%computadras%'
    OR bio LIKE '%computadros%'
    OR bio LIKE '%computadaras%'
  );

-- -------------------------
-- 3. (Opcional) Deduplicar links por URL
--    Deja sólo el link con menor sort_order cuando hay URL repetida.
-- -------------------------
DELETE FROM profile_links
WHERE id NOT IN (
  SELECT MIN(id)
  FROM profile_links
  WHERE profile_id = (SELECT id FROM profiles WHERE slug = 'juan')
  GROUP BY url
)
AND profile_id = (SELECT id FROM profiles WHERE slug = 'juan');
