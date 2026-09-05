-- 0046_seed_argenisg_special_profile.sql
-- SOLO PREVIEW: consolida el slug final /argenisg y su endpoint de Instagram.
-- Producción no se toca.

UPDATE profiles
SET
  slug='argenisg',
  name='Argenis Grullón',
  bio='Asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal en Santiago, República Dominicana.',
  category='Servicios profesionales',
  subcategory='Asesoría de imagen y estilismo de moda',
  template_id='personal_brand_adonisg_v1',
  template_data='{"role":"Asesor de Imagen · Estilista de Moda · Estratega de Marca","role_en":"Image Consultant · Fashion Stylist · Personal Brand Strategist","whatsapp":"18293024095","languages":{"default":"es","enabled":["es","en"]},"instagram_url":"https://www.instagram.com/argenisgrullonrd/","instagram_feed_endpoint":"/api/argenisg-instagram","media_mentions_json":"[]","collaborations_json":"[{\"name\":\"Raquel Moreta\"},{\"name\":\"Lily Payamps\"},{\"name\":\"Lilibeth Durán\"},{\"name\":\"Todo Abrigos\"},{\"name\":\"Black Photos\"},{\"name\":\"Jeisly Blossom\"}]"}',
  is_published=1,
  is_active=1,
  updated_at=datetime('now')
WHERE user_id='user-qa-adonisg'
  AND slug IN ('adonisg','argenisg');
