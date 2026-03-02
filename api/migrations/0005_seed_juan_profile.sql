-- 0005_seed_juan_profile.sql
-- Seed mínimo para que /public/profiles/juan no devuelva 404
-- Idempotente: si existe, no duplica.
--
-- Compatibilidad con schema real de producción:
--   · users en prod solo tiene (id, email) → NO insertar created_at explícitamente
--   · profiles.created_at puede no existir → dejar que el DEFAULT actúe
--   · plan_id usa COALESCE: 'pro' si existe en plans, sino 'free', sino literal 'pro'

-- Usuario propietario (idempotente) — solo (id, email), sin created_at
INSERT OR IGNORE INTO users (id, email) VALUES
  ('user-juan-demo', 'juan@demo.intap.link');

-- Perfil (INSERT solo si no existe el slug 'juan') — sin created_at explícito
INSERT INTO profiles (id, user_id, slug, plan_id, theme_id, name, bio, is_published)
SELECT
  'profile-juan-demo',
  'user-juan-demo',
  'juan',
  COALESCE(
    (SELECT id FROM plans WHERE id = 'pro'),
    (SELECT id FROM plans WHERE id = 'free'),
    'pro'
  ),
  'default',
  'Juan Carlos',
  'Perfil demo de Intap Link',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE slug = 'juan'
);

-- Asegurar publicado aunque ya existiera
UPDATE profiles
SET is_published = 1
WHERE slug = 'juan';
