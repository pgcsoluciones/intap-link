-- 0044_seed_adonisg_special_profile.sql
-- SOLO PREVIEW: crea /adonisg para QA del perfil especial editorial.
-- No copiar ni ejecutar sobre intap_db de Producción.
-- Los nombres de colaboraciones se limitan a relaciones públicas verificadas;
-- no se infieren clientes a partir de simples menciones sociales.

INSERT OR IGNORE INTO users (id, email)
VALUES ('user-qa-adonisg', 'qa-adonisg@preview.intap.local');

INSERT OR IGNORE INTO profiles (
  id,user_id,slug,plan_id,theme_id,name,bio,category,subcategory,is_published,is_active,template_id,template_data,layout_id
)
VALUES (
  'profile-qa-adonisg','user-qa-adonisg','adonisg','pro','light','Argenis Grullón',
  'Asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal en Santiago, República Dominicana.',
  'Servicios profesionales','Asesoría de imagen y estilismo de moda',1,1,'personal_brand_adonisg_v1',
  '{"role":"Asesor de Imagen · Estilista de Moda · Estratega de Marca","role_en":"Image Consultant · Fashion Stylist · Personal Brand Strategist","whatsapp":"18293024095","languages":{"default":"es","enabled":["es","en"]},"instagram_url":"https://www.instagram.com/argenisgrullonrd/","media_mentions_json":"[]","collaborations_json":"[{\"name\":\"Raquel Moreta\"},{\"name\":\"Lily Payamps\"},{\"name\":\"Lilibeth Durán\"},{\"name\":\"Todo Abrigos\"},{\"name\":\"Black Photos\"},{\"name\":\"Jeisly Blossom\"}]"}',
  'esencial'
);

UPDATE profiles
SET
  name='Argenis Grullón',
  bio='Asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal en Santiago, República Dominicana.',
  category='Servicios profesionales',
  subcategory='Asesoría de imagen y estilismo de moda',
  template_id='personal_brand_adonisg_v1',
  template_data='{"role":"Asesor de Imagen · Estilista de Moda · Estratega de Marca","role_en":"Image Consultant · Fashion Stylist · Personal Brand Strategist","whatsapp":"18293024095","languages":{"default":"es","enabled":["es","en"]},"instagram_url":"https://www.instagram.com/argenisgrullonrd/","media_mentions_json":"[]","collaborations_json":"[{\"name\":\"Raquel Moreta\"},{\"name\":\"Lily Payamps\"},{\"name\":\"Lilibeth Durán\"},{\"name\":\"Todo Abrigos\"},{\"name\":\"Black Photos\"},{\"name\":\"Jeisly Blossom\"}]"}',
  is_published=1,
  is_active=1,
  updated_at=datetime('now')
WHERE slug='adonisg' AND user_id='user-qa-adonisg';