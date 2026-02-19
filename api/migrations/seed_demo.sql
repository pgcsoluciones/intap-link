-- Seed de datos demo — Fase 1 v1.2 — INTAP LINK
-- Ejecutar con: wrangler d1 execute intap_db --remote --file=api/migrations/seed_demo.sql

-- Plan base free
INSERT OR IGNORE INTO plans (id, name) VALUES ('free', 'Free');
INSERT OR IGNORE INTO plan_limits (plan_id, max_links, max_photos, max_faqs, can_use_vcard)
  VALUES ('free', 5, 0, 0, 0);

-- Módulos disponibles
INSERT OR IGNORE INTO modules (code, name, effects_json)
  VALUES ('extra_links', 'Links Extra', '{"extraLinks":10}');
INSERT OR IGNORE INTO modules (code, name, effects_json)
  VALUES ('templates_pro', 'Templates Pro', '{}');

-- Templates (libres + premium)
INSERT OR IGNORE INTO templates (id, name, required_tool)
  VALUES ('tpl_classic', 'Classic', NULL);
INSERT OR IGNORE INTO templates (id, name, required_tool)
  VALUES ('tpl_dark', 'Dark', NULL);
INSERT OR IGNORE INTO templates (id, name, required_tool)
  VALUES ('tpl_modern', 'Modern Mint', NULL);
INSERT OR IGNORE INTO templates (id, name, required_tool)
  VALUES ('tpl_premium_rose', 'Premium Rose', 'templates_pro');
INSERT OR IGNORE INTO templates (id, name, required_tool)
  VALUES ('tpl_premium_gold', 'Premium Gold', 'templates_pro');

-- Usuario demo
INSERT OR IGNORE INTO users (id, email) VALUES ('usr_demo_01', 'demo@intaprd.com');
INSERT OR IGNORE INTO users (id, email) VALUES ('usr_demo_02', 'privado@intaprd.com');

-- Perfil 1: publicado — slug "demo" (free, clásico)
INSERT OR IGNORE INTO profiles (id, user_id, slug, plan_id, name, bio, theme_id, is_published)
  VALUES (
    'prf_demo_01',
    'usr_demo_01',
    'demo',
    'free',
    'María García',
    'Emprendedora digital · Consultora de marketing · Buenos Aires',
    'classic',
    1
  );

-- Links del perfil demo (con tipos v1.2)
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, type, sort_order)
  VALUES ('lnk_d01_01', 'prf_demo_01', 'WhatsApp', 'https://wa.me/5491112345678', 'whatsapp', 1);
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, type, sort_order)
  VALUES ('lnk_d01_02', 'prf_demo_01', 'Llamar', 'tel:+5491112345678', 'phone', 2);
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, type, sort_order)
  VALUES ('lnk_d01_03', 'prf_demo_01', 'Instagram', 'https://instagram.com/mariapro', 'social', 3);
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, type, sort_order)
  VALUES ('lnk_d01_04', 'prf_demo_01', 'LinkedIn', 'https://linkedin.com/in/mariapro', 'social', 4);
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, type, sort_order)
  VALUES ('lnk_d01_05', 'prf_demo_01', 'Mi Sitio Web', 'https://mariapro.com', 'link', 5);

-- Perfil 2: NO publicado — slug "privado" (para prueba 403)
INSERT OR IGNORE INTO profiles (id, user_id, slug, plan_id, name, bio, theme_id, is_published)
  VALUES (
    'prf_demo_02',
    'usr_demo_02',
    'privado',
    'free',
    'Perfil Privado Test',
    'Este perfil no está publicado.',
    'classic',
    0
  );
