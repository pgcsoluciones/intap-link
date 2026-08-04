-- INTAP LINK — perfiles especiales para QA en Preview
-- Esta migración pertenece únicamente a intap_db_preview.
-- No debe ejecutarse sobre intap_db de Producción.


-- Identidades técnicas independientes.
INSERT OR IGNORE INTO users (id, email)
VALUES ('user-qa-jason', 'qa-jason@preview.intap.local');

INSERT OR IGNORE INTO users (id, email)
VALUES ('user-qa-novi', 'qa-novi@preview.intap.local');

INSERT OR IGNORE INTO users (id, email)
VALUES ('user-qa-1aeventos', 'qa-1aeventos@preview.intap.local');

INSERT OR IGNORE INTO users (id, email)
VALUES ('user-qa-rentaord', 'qa-rentaord@preview.intap.local');


-- Comercial Jason.
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
  'profile-qa-jason',
  'user-qa-jason',
  'jason',
  'pro',
  'light',
  'Comercial Jason',
  'Perfil especial de Comercial Jason para validación en Preview.',
  1,
  1,
  'automotive_jason_v3',
  '{}',
  'esencial'
);

UPDATE profiles
SET
  template_id = 'automotive_jason_v3',
  template_data = '{}',
  is_published = 1,
  is_active = 1,
  updated_at = datetime('now')
WHERE slug = 'jason'
  AND user_id = 'user-qa-jason';


-- NOVI HOME.
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
  'profile-qa-novi',
  'user-qa-novi',
  'novi',
  'pro',
  'light',
  'NOVI HOME',
  'Perfil inmobiliario especial para validación en Preview.',
  1,
  1,
  'real_estate_novi_v4',
  '{}',
  'esencial'
);

UPDATE profiles
SET
  template_id = 'real_estate_novi_v4',
  template_data = '{}',
  is_published = 1,
  is_active = 1,
  updated_at = datetime('now')
WHERE slug = 'novi'
  AND user_id = 'user-qa-novi';


-- 1A Eventos.
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
  'profile-qa-1aeventos',
  'user-qa-1aeventos',
  '1aeventos',
  'pro',
  'light',
  '1A Eventos',
  'Alquiler de mobiliario y artículos para eventos.',
  1,
  1,
  'events_1a_v1',
  '{}',
  'esencial'
);

UPDATE profiles
SET
  template_id = 'events_1a_v1',
  template_data = '{}',
  is_published = 1,
  is_active = 1,
  updated_at = datetime('now')
WHERE slug = '1aeventos'
  AND user_id = 'user-qa-1aeventos';


-- Rentao RD.
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
  'profile-qa-rentaord',
  'user-qa-rentaord',
  'rentaord',
  'pro',
  'light',
  'Rentao RD',
  'Alquiler de vehículos y experiencias de navegación.',
  1,
  1,
  'car_rental_rentao_v1',
  '{}',
  'esencial'
);

UPDATE profiles
SET
  template_id = 'car_rental_rentao_v1',
  template_data = '{}',
  is_published = 1,
  is_active = 1,
  updated_at = datetime('now')
WHERE slug = 'rentaord'
  AND user_id = 'user-qa-rentaord';
