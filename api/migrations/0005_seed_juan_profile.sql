-- 0005_seed_juan_profile.sql
-- Seed mínimo para que /public/profiles/juan no devuelva 404
-- Idempotente: si existe, no duplica.
--
-- Ajustes al schema real (0001_initial_schema.sql):
--   · id TEXT PRIMARY KEY → generamos un valor fijo
--   · user_id TEXT NOT NULL → requiere un user; lo creamos primero
--   · No existe columna updated_at en profiles → omitida
--   · theme_id default 'default' (no 'light') → usamos 'default'

-- Usuario propietario (idempotente)
INSERT OR IGNORE INTO users (id, email, created_at) VALUES
  ('user-juan-demo', 'juan@demo.intap.link', datetime('now'));

-- Perfil (INSERT solo si no existe)
INSERT INTO profiles (id, user_id, slug, plan_id, theme_id, name, bio, is_published, created_at)
SELECT
  'profile-juan-demo',
  'user-juan-demo',
  'juan',
  'pro',
  'default',
  'Juan Carlos',
  'Perfil demo de Intap Link',
  1,
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE slug = 'juan'
);

-- Asegurar publicado aunque ya existiera
UPDATE profiles
SET is_published = 1
WHERE slug = 'juan';
