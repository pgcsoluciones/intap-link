-- Limpieza previa opcional (comentada en prod)
-- DELETE FROM profile_links WHERE profile_id = 'profile_debug';
-- DELETE FROM profile_faqs WHERE profile_id = 'profile_debug';
-- DELETE FROM profile_modules WHERE profile_id = 'profile_debug';

-- Asegurar usuario administrador
INSERT OR IGNORE INTO users (id, email) VALUES ('admin_id', 'juanluis@intaprd.com');

-- Crear perfil test-valida si no existe
INSERT OR IGNORE INTO profiles (id, user_id, slug, plan_id, name, bio, theme_id, is_published) 
VALUES ('profile_debug', 'admin_id', 'test-valida', 'premium', 'Juan Luis Pérez', 'Arquitecto de Soluciones Cloud & Director de INTAP LINK.', 'classic', 1);

-- Poblar Links
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, sort_order) VALUES ('l1', 'profile_debug', 'LinkedIn Profesional', 'https://linkedin.com/in/juanluis', 1);
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, sort_order) VALUES ('l2', 'profile_debug', 'Instagram Personal', 'https://instagram.com/juanluis', 2);
INSERT OR IGNORE INTO profile_links (id, profile_id, label, url, sort_order) VALUES ('l3', 'profile_debug', 'WhatsApp Directo', 'https://wa.me/123456789', 3);

-- Poblar FAQs
INSERT OR IGNORE INTO profile_faqs (id, profile_id, question, answer) VALUES ('f1', 'profile_debug', '¿Qué es INTAP LINK?', 'Es la plataforma SaaS líder para la gestión de identidades digitales modulares en Cloudflare.');
INSERT OR IGNORE INTO profile_faqs (id, profile_id, question, answer) VALUES ('f2', 'profile_debug', '¿Cómo adquiero el plan PRO?', 'Puedes hacerlo directamente desde tu dashboard haciendo clic en Desbloquear PRO.');

-- Activar Módulos vCard y Galería
INSERT OR IGNORE INTO profile_modules (profile_id, module_code, expires_at) VALUES ('profile_debug', 'vcard', datetime('now', '+1 year'));
INSERT OR IGNORE INTO profile_modules (profile_id, module_code, expires_at) VALUES ('profile_debug', 'gallery', datetime('now', '+1 year'));

-- Configurar límites de planes (por si acaso)
INSERT OR IGNORE INTO plans (id, name) VALUES ('premium', 'Plan Premium');
INSERT OR IGNORE INTO plan_limits (plan_id, max_links, max_photos, max_faqs, can_use_vcard) VALUES ('premium', 20, 15, 10, 1);
