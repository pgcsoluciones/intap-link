-- KAWVO LINK · Free profile production experience
-- Production schema alignment verified against intap_db on 2026-08-18.
-- layout_id already exists in production and is intentionally NOT recreated here.

ALTER TABLE profiles ADD COLUMN free_palette_id TEXT NOT NULL DEFAULT 'intap';
ALTER TABLE profiles ADD COLUMN free_brand_color TEXT;
ALTER TABLE profiles ADD COLUMN hero_url TEXT;
ALTER TABLE profiles ADD COLUMN hero_position_x REAL NOT NULL DEFAULT 50;
ALTER TABLE profiles ADD COLUMN hero_position_y REAL NOT NULL DEFAULT 50;
ALTER TABLE profiles ADD COLUMN hero_zoom REAL NOT NULL DEFAULT 1;

-- Production profile_gallery currently lacks these metadata columns.
ALTER TABLE profile_gallery ADD COLUMN alt_text TEXT;
ALTER TABLE profile_gallery ADD COLUMN title TEXT;
ALTER TABLE profile_gallery ADD COLUMN description TEXT;
