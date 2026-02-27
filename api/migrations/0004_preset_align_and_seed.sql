-- 0004_preset_align_and_seed.sql
-- Objetivo:
-- 1) Asegurar tablas mínimas que YA usa el Worker
-- 2) Asegurar catálogos (plans, plan_limits, modules)
-- 3) Insertar un perfil demo estable (juan / profile_debug) y contenido base
-- 4) Evitar futuros "no such table/column" por falta de preset

PRAGMA foreign_keys=ON;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Catálogos base (planes, límites, módulos)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'DOP',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plan_limits (
  plan_id TEXT PRIMARY KEY,
  max_links INTEGER NOT NULL DEFAULT 5,
  max_photos INTEGER NOT NULL DEFAULT 5,
  max_faqs INTEGER NOT NULL DEFAULT 3,
  can_use_vcard INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS modules (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  effects_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_modules (
  profile_id TEXT NOT NULL,
  module_code TEXT NOT NULL,
  expires_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, module_code),
  FOREIGN KEY(module_code) REFERENCES modules(code)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Tablas "contenido de perfil" que el endpoint público usa
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_social_links (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_faqs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_products (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  price TEXT NULL,
  image_url TEXT NULL,
  whatsapp_text TEXT NULL,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_gallery (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  image_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_contact (
  profile_id TEXT PRIMARY KEY,
  whatsapp TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  hours TEXT NULL,
  address TEXT NULL,
  map_url TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- IMPORTANTE:
-- profile_links ya existe en tu DB (lo vimos en PRAGMA) y tiene is_active DEFAULT 1.
-- No la recreamos aquí para no chocar.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Operación (leads + rate limit + analytics + waitlist)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NULL,
  message TEXT NOT NULL,
  source_url TEXT NULL,
  user_agent TEXT NULL,
  ip_hash TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lead_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_slug TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rl_slug_ip_created ON lead_rate_limits(profile_slug, ip_hash, created_at);

CREATE TABLE IF NOT EXISTS analytics (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_id TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  whatsapp TEXT NULL,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  mode TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Seed de catálogos (planes + límites + módulos)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO plans (id, name, price_cents, currency, is_active) VALUES
  ('basic', 'Básico', 0, 'DOP', 1),
  ('pro',   'Pro',   59500, 'DOP', 1);

INSERT OR IGNORE INTO plan_limits (plan_id, max_links, max_photos, max_faqs, can_use_vcard) VALUES
  ('basic', 5, 5, 3, 1),
  ('pro',   50, 50, 30, 1);

INSERT OR IGNORE INTO modules (code, name, effects_json, is_active) VALUES
  ('links_plus',    'Links Plus',    '{"extraLinks":100}', 1),
  ('gallery_plus',  'Gallery Plus',  '{"extraPhotos":50}', 1),
  ('faq_plus',      'FAQ Plus',      '{"extraFaqs":20}', 1),
  ('vcard',         'vCard',         '{"unlockVCard":true}', 1),
  ('map',           'Mapa',          '{"enable_features":["map"]}', 1),
  ('form_contact',  'Formulario',    '{"enable_features":["form_contact"]}', 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Seed perfil DEMO: profile_debug / slug: juan
-- ─────────────────────────────────────────────────────────────────────────────

-- Insertar perfil demo SOLO si no existe.
-- Ojo: tu tabla profiles ya existe. Aquí solo insertamos datos.
INSERT OR IGNORE INTO profiles (id, user_id, slug, plan_id, theme_id, is_published, name, bio, avatar_url, whatsapp_number, category, subcategory, is_active)
VALUES (
  'profile_debug',
  NULL,
  'juan',
  'basic',
  'light',
  1,
  'Juan Carlos',
  'Experto en compuadoras',
  NULL,
  NULL,
  NULL,
  NULL,
  1
);

-- Activar módulos demo (para que entitlements suban)
INSERT OR IGNORE INTO profile_modules (profile_id, module_code, expires_at) VALUES
  ('profile_debug', 'links_plus',    datetime('now', '+365 days')),
  ('profile_debug', 'vcard',         datetime('now', '+365 days')),
  ('profile_debug', 'form_contact',  datetime('now', '+365 days'));

-- Contacto demo
INSERT OR IGNORE INTO profile_contact (profile_id, whatsapp, email, phone, hours, address, map_url)
VALUES
  ('profile_debug', '+1809XXXXXXX', 'correo@ejemplo.com', '+1809XXXXXXX', 'Lun–Vie 9:00am–6:00pm', 'Santo Domingo, RD', 'https://www.google.com/maps?q=Santo+Domingo');

-- Social links demo
INSERT OR IGNORE INTO profile_social_links (id, profile_id, type, url, sort_order, enabled) VALUES
  ('sl-juan-ig',   'profile_debug', 'instagram', 'https://instagram.com/juandemo', 0, 1),
  ('sl-juan-tt',   'profile_debug', 'tiktok',    'https://tiktok.com/@juandemo',   1, 1),
  ('sl-juan-email','profile_debug', 'email',     'mailto:juan@demo.intap.link',     2, 1);

-- Links demo (tu tabla profile_links ya existe)
-- Insertamos sin romper si ya estaban.
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, sort_order, is_active) VALUES
  ('link-1', 'profile_debug', 'Mi Instagram', 'https://instagram.com/juan', 1, 1),
  ('l1',     'profile_debug', 'LinkedIn Profesional', 'https://linkedin.com/in/juanluis', 2, 1),
  ('link-2', 'profile_debug', 'LinkedIn Profesional', 'https://linkedin.com/in/juan', 3, 1),
  ('l2',     'profile_debug', 'Instagram Personal', 'https://instagram.com/juanluis', 4, 1),
  ('link_map_juan', 'profile_debug', 'Cómo llegar', 'https://www.google.com/maps?q=Santo+Domingo', 5, 1),
  ('link-3', 'profile_debug', 'Mi Portafolio', 'https://juan.dev', 6, 1),
  ('l3',     'profile_debug', 'WhatsApp Directo', 'https://wa.me/123456789', 7, 1);

-- FAQs demo
INSERT OR IGNORE INTO profile_faqs (id, profile_id, question, answer, sort_order) VALUES
  ('faq-demo-1', 'profile_debug', '¿Cómo hago un pedido?', 'Escríbeme por WhatsApp y te guío paso a paso.', 1),
  ('faq-demo-2', 'profile_debug', '¿En cuánto tiempo entregan?', 'Depende del servicio, normalmente entre 24 y 72 horas.', 2),
  ('faq-demo-3', 'profile_debug', '¿Qué métodos de pago aceptan?', 'Transferencia, efectivo o tarjeta (según el caso).', 3);

-- Productos demo
INSERT OR IGNORE INTO profile_products (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order) VALUES
  ('prod-demo-1', 'profile_debug', 'Servicio Premium', 'Diseño + optimización de tu perfil para convertir más.', 'RD$ 5,900', NULL, 'Hola, me interesa el Servicio Premium. ¿Cómo inicio?', 1, 1),
  ('prod-demo-2', 'profile_debug', 'Asesoría Express', 'Diagnóstico rápido + recomendaciones accionables.', 'RD$ 1,990', NULL, 'Hola, quiero la Asesoría Express. ¿Disponibilidad?', 0, 2);

-- Índices de performance básicos
CREATE INDEX IF NOT EXISTS idx_profile_links_profile_sort ON profile_links(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_social_links_profile_sort ON profile_social_links(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_faqs_profile_sort ON profile_faqs(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_profile_sort ON profile_products(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_profile_sort ON profile_gallery(profile_id, sort_order);
