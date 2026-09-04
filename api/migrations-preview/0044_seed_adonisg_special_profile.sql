-- 0044_seed_adonisg_special_profile.sql
-- SOLO PREVIEW: crea /adonisg para QA del perfil especial editorial.
-- No copiar ni ejecutar sobre intap_db de Producción.

INSERT OR IGNORE INTO users (id, email)
VALUES ('user-qa-adonisg', 'qa-adonisg@preview.intap.local');

INSERT OR IGNORE INTO profiles (
  id,
  user_id,
  slug,
  plan_id,
  theme_id,
  name,
  bio,
  is_published,
  is_active,
  template_id,
  template_data,
  layout_id
)
VALUES (
  'profile-qa-adonisg',
  'user-qa-adonisg',
  'adonisg',
  'pro',
  'light',
  'Argenis Grullón',
  'Asesor de imagen certificado por IBA, fashion stylist, creador digital y estratega de marca personal en Santiago, República Dominicana.',
  1,
  1,
  'personal_brand_adonisg_v1',
  '{"languages":{"default":"es","enabled":["es","en"]},"instagram_url":"https://www.instagram.com/argenisgrullonrd/","media_mentions_json":"[]","collaborations_json":"[]"}',
  'esencial'
);

UPDATE profiles
SET
  name = 'Argenis Grullón',
  bio = 'Asesor de imagen certificado por IBA, fashion stylist, creador digital y estratega de marca personal en Santiago, República Dominicana.',
  template_id = 'personal_brand_adonisg_v1',
  template_data = '{"languages":{"default":"es","enabled":["es","en"]},"instagram_url":"https://www.instagram.com/argenisgrullonrd/","media_mentions_json":"[]","collaborations_json":"[]"}',
  is_published = 1,
  is_active = 1,
  updated_at = datetime('now')
WHERE slug = 'adonisg'
  AND user_id = 'user-qa-adonisg';
