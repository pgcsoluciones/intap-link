-- 0045_seed_argenisg_special_profile.sql
-- Producción: crea el perfil especial administrado /argenisg.
-- El usuario técnico existe únicamente para satisfacer ownership interno del perfil;
-- Argenis vincula Instagram mediante invitación OAuth y no necesita credenciales Kawvo.

INSERT OR IGNORE INTO users (id, email)
VALUES ('user-managed-argenisg', 'managed-argenisg@kawvo.local');

INSERT OR IGNORE INTO profiles (
  id,user_id,slug,plan_id,theme_id,name,bio,category,subcategory,is_published,is_active,template_id,template_data,layout_id
)
VALUES (
  'profile-managed-argenisg','user-managed-argenisg','argenisg','pro','light','Argenis Grullón',
  'Asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal en Santiago, República Dominicana.',
  'Servicios profesionales','Asesoría de imagen y estilismo de moda',1,1,'personal_brand_adonisg_v1',
  '{"role":"Asesor de Imagen · Estilista de Moda · Estratega de Marca","role_en":"Image Consultant · Fashion Stylist · Personal Brand Strategist","whatsapp":"18293024095","languages":{"default":"es","enabled":["es","en"]},"instagram_url":"https://www.instagram.com/argenisgrullonrd/","instagram_feed_endpoint":"/api/v1/public/profiles/argenisg/instagram/latest","media_mentions_json":"[]","collaborations_json":"[{\"name\":\"Raquel Moreta\"},{\"name\":\"Lily Payamps\"},{\"name\":\"Lilibeth Durán\"},{\"name\":\"Todo Abrigos\"},{\"name\":\"Black Photos\"},{\"name\":\"Jeisly Blossom\"}]"}',
  'esencial'
);

UPDATE profiles
SET
  name='Argenis Grullón',
  bio='Asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal en Santiago, República Dominicana.',
  category='Servicios profesionales',
  subcategory='Asesoría de imagen y estilismo de moda',
  template_id='personal_brand_adonisg_v1',
  template_data='{"role":"Asesor de Imagen · Estilista de Moda · Estratega de Marca","role_en":"Image Consultant · Fashion Stylist · Personal Brand Strategist","whatsapp":"18293024095","languages":{"default":"es","enabled":["es","en"]},"instagram_url":"https://www.instagram.com/argenisgrullonrd/","instagram_feed_endpoint":"/api/v1/public/profiles/argenisg/instagram/latest","media_mentions_json":"[]","collaborations_json":"[{\"name\":\"Raquel Moreta\"},{\"name\":\"Lily Payamps\"},{\"name\":\"Lilibeth Durán\"},{\"name\":\"Todo Abrigos\"},{\"name\":\"Black Photos\"},{\"name\":\"Jeisly Blossom\"}]"}',
  is_published=1,
  is_active=1,
  updated_at=datetime('now')
WHERE id='profile-managed-argenisg'
  AND user_id='user-managed-argenisg';
