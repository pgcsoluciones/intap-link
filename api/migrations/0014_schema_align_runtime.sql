-- 0014_schema_align_runtime.sql
-- Objetivo: blindar consistencia + performance sin romper idempotencia.
-- Nota: NO usamos ALTER TABLE (SQLite no soporta IF NOT EXISTS en ADD COLUMN).
-- Requisito: columnas ya presentes:
--   - profiles.is_active
--   - profile_links.is_active
PRAGMA foreign_keys = ON;
BEGIN;
-- ─────────────────────────────────────────────────────────────────────────────
-- Backfills seguros (no fallan si ya están correctos)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE profiles
SET is_active = 1
WHERE is_active IS NULL;
UPDATE profile_links
SET is_active = 1
WHERE is_active IS NULL;
-- Opcional: normalizar sort_order NULL a 0 para evitar ORDER BY raros
UPDATE profile_links
SET sort_order = 0
WHERE sort_order IS NULL;
UPDATE profile_faqs
SET sort_order = 0
WHERE sort_order IS NULL;
UPDATE profile_products
SET sort_order = 0
WHERE sort_order IS NULL;
UPDATE profile_gallery
SET sort_order = 0
WHERE sort_order IS NULL;
UPDATE profile_social_links
SET sort_order = 0
WHERE sort_order IS NULL;
-- ─────────────────────────────────────────────────────────────────────────────
-- Índices críticos (performance)
-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active, is_published);
-- Links
CREATE INDEX IF NOT EXISTS idx_profile_links_profile_sort ON profile_links(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_profile_links_profile_active_sort ON profile_links(profile_id, is_active, sort_order);
-- FAQs
CREATE INDEX IF NOT EXISTS idx_profile_faqs_profile_sort ON profile_faqs(profile_id, sort_order);
-- Products
CREATE INDEX IF NOT EXISTS idx_profile_products_profile_sort ON profile_products(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_profile_products_featured ON profile_products(profile_id, is_featured);
-- Gallery
CREATE INDEX IF NOT EXISTS idx_profile_gallery_profile_sort ON profile_gallery(profile_id, sort_order);
-- Social links
CREATE INDEX IF NOT EXISTS idx_profile_social_links_profile_enabled_sort
ON profile_social_links(profile_id, enabled, sort_order);
-- Leads + rate limit
CREATE INDEX IF NOT EXISTS idx_leads_slug_created ON leads(profile_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_lead_rl_slug_ip_created ON lead_rate_limits(profile_slug, ip_hash, created_at);
-- Analytics (si está activa)
CREATE INDEX IF NOT EXISTS idx_analytics_profile_event_created ON analytics(profile_id, event_type, created_at);
-- Waitlist (si se usa ranking/posición)
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist(position);
COMMIT;
