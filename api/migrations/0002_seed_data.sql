-- ============================================================
-- INTAP LINK — Migración 0002: Datos semilla (Planes y Módulos)
-- Base de datos: D1 (intap_db)
-- Fecha: 2026-02-19
-- ============================================================

-- -------------------------
-- PLANES
-- -------------------------

INSERT OR IGNORE INTO plans (id, name) VALUES
  ('free',    'Free'),
  ('starter', 'Starter'),
  ('pro',     'Pro'),
  ('agency',  'Agency');

-- -------------------------
-- LÍMITES POR PLAN
-- -------------------------

INSERT OR IGNORE INTO plan_limits (plan_id, max_links, max_photos, max_faqs, can_use_vcard) VALUES
  ('free',    3,  0,  0, 0),
  ('starter', 8,  3,  5, 0),
  ('pro',     20, 10, 15, 1),
  ('agency',  50, 30, 30, 1);

-- -------------------------
-- MÓDULOS DISPONIBLES
-- -------------------------

-- extra_links: agrega 5 links adicionales al plan base
INSERT OR IGNORE INTO modules (code, name, effects_json) VALUES
  ('extra_links',  'Pack Extra Links',  '{"extraLinks": 5}');

-- extra_photos: agrega 5 fotos adicionales
INSERT OR IGNORE INTO modules (code, name, effects_json) VALUES
  ('extra_photos', 'Pack Extra Fotos',  '{"extraPhotos": 5}');

-- extra_faqs: agrega 5 FAQs adicionales
INSERT OR IGNORE INTO modules (code, name, effects_json) VALUES
  ('extra_faqs',   'Pack Extra FAQs',   '{"extraFaqs": 5}');

-- vcard_unlock: desbloquea descarga de vCard
INSERT OR IGNORE INTO modules (code, name, effects_json) VALUES
  ('vcard_unlock', 'Desbloquear vCard', '{"unlockVCard": true}');

-- power_pack: combo completo (links + fotos + FAQs + vCard)
INSERT OR IGNORE INTO modules (code, name, effects_json) VALUES
  ('power_pack', 'Power Pack', '{"extraLinks": 10, "extraPhotos": 10, "extraFaqs": 10, "unlockVCard": true}');
