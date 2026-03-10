-- 0007_social_links.sql
-- Tabla de redes sociales por perfil + seed para juan.
-- Tipos soportados en MVP: instagram, tiktok, email.

CREATE TABLE IF NOT EXISTS profile_social_links (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,     -- 'instagram' | 'tiktok' | 'email'
  url        TEXT NOT NULL,     -- https://... o mailto:...
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_social_links_profile
  ON profile_social_links (profile_id, sort_order);

-- ── Seed para juan ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO profile_social_links (id, profile_id, type, url, sort_order, enabled)
SELECT 'sl-juan-ig', p.id, 'instagram', 'https://instagram.com/juandemo', 0, 1
FROM profiles p WHERE p.slug = 'juan';

INSERT OR IGNORE INTO profile_social_links (id, profile_id, type, url, sort_order, enabled)
SELECT 'sl-juan-tt', p.id, 'tiktok', 'https://tiktok.com/@juandemo', 1, 1
FROM profiles p WHERE p.slug = 'juan';

INSERT OR IGNORE INTO profile_social_links (id, profile_id, type, url, sort_order, enabled)
SELECT 'sl-juan-email', p.id, 'email', 'mailto:juan@demo.intap.link', 2, 1
FROM profiles p WHERE p.slug = 'juan';
