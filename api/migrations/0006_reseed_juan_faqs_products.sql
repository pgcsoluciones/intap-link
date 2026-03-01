-- 0006_reseed_juan_faqs_products.sql
-- Re-seed idempotente de FAQs y productos para el perfil "juan".
-- También garantiza que whatsapp_number existe en profiles (el ALTER TABLE se movió
-- aquí desde 0004 para que 0004 sea seguro en BDs donde la columna ya existe).

-- Ensure whatsapp_number column exists (succeeds on fresh DBs; already present on prod)
ALTER TABLE profiles ADD COLUMN whatsapp_number TEXT;

-- WhatsApp (UPDATE es siempre idempotente)
UPDATE profiles
SET whatsapp_number = '+5493413000000'
WHERE slug = 'juan';

-- ── FAQs ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO profile_faqs (id, profile_id, question, answer, sort_order)
SELECT 'faq-juan-1', p.id,
  '¿Cuánto tiempo lleva un proyecto?',
  'Depende del alcance, pero la mayoría de proyectos los entregamos en 2 a 4 semanas desde el inicio.',
  0
FROM profiles p WHERE p.slug = 'juan';

INSERT OR IGNORE INTO profile_faqs (id, profile_id, question, answer, sort_order)
SELECT 'faq-juan-2', p.id,
  '¿Trabajás con clientes de todo el país?',
  'Sí, trabajo de forma remota con clientes en toda Argentina y Latinoamérica sin costo extra.',
  1
FROM profiles p WHERE p.slug = 'juan';

INSERT OR IGNORE INTO profile_faqs (id, profile_id, question, answer, sort_order)
SELECT 'faq-juan-3', p.id,
  '¿Qué formas de pago aceptás?',
  'Acepto transferencia bancaria, Mercado Pago y divisas (USD/EUR). Consultá disponibilidad.',
  2
FROM profiles p WHERE p.slug = 'juan';

-- ── Productos / Servicios ─────────────────────────────────────────────────────

INSERT OR IGNORE INTO profile_products (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order)
SELECT 'prod-juan-1', p.id,
  'Consultoría Estratégica',
  'Sesión 1:1 de 60 minutos para analizar tu situación y definir el plan de acción más efectivo para tu negocio digital.',
  '$50 USD',
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&q=80',
  'Hola! Vi tu perfil y me interesa la Consultoría Estratégica.',
  1, 0
FROM profiles p WHERE p.slug = 'juan';

INSERT OR IGNORE INTO profile_products (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order)
SELECT 'prod-juan-2', p.id,
  'Landing Page Premium',
  'Diseño y desarrollo de página de aterrizaje optimizada para conversión, con formulario de contacto y analíticas incluidas.',
  '$200 USD',
  'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&q=80',
  'Hola! Vi tu perfil y me interesa la Landing Page Premium.',
  0, 1
FROM profiles p WHERE p.slug = 'juan';

INSERT OR IGNORE INTO profile_products (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order)
SELECT 'prod-juan-3', p.id,
  'Pack Social Media',
  'Gestión mensual de redes sociales: estrategia de contenido, diseño de piezas y reportes de métricas mensuales.',
  '$150 USD / mes',
  'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&q=80',
  'Hola! Vi tu perfil y me interesa el Pack Social Media.',
  0, 2
FROM profiles p WHERE p.slug = 'juan';

INSERT OR IGNORE INTO profile_products (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order)
SELECT 'prod-juan-4', p.id,
  'Identidad de Marca',
  'Creación de logo, paleta de colores, tipografías y guía de estilo completa para profesionalizar tu marca.',
  '$300 USD',
  'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80',
  'Hola! Vi tu perfil y me interesa el servicio de Identidad de Marca.',
  0, 3
FROM profiles p WHERE p.slug = 'juan';
