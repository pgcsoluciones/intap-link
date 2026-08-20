-- INTAP LINK Gratis · experiencia visual y portafolio enriquecido
-- Preview only.
--
-- Se mantienen separados:
--   layout_id   => composición: impacto | personal | esencial
--   template_id => templates especializados/Premium
--
-- Apariencia Free:
--   free_palette_id  => pack prearmado
--   free_brand_color => color principal cuando el usuario personaliza
--
-- Hero Impacto:
--   hero_url
--   hero_position_x / hero_position_y => punto de encuadre 0..100
--   hero_zoom => escala visual, 1.0 por defecto
--
-- Portafolio:
--   title + description independientes de alt_text.

ALTER TABLE profiles
ADD COLUMN free_palette_id TEXT NOT NULL DEFAULT 'intap';

ALTER TABLE profiles
ADD COLUMN free_brand_color TEXT;

ALTER TABLE profiles
ADD COLUMN hero_url TEXT;

ALTER TABLE profiles
ADD COLUMN hero_position_x REAL NOT NULL DEFAULT 50;

ALTER TABLE profiles
ADD COLUMN hero_position_y REAL NOT NULL DEFAULT 50;

ALTER TABLE profiles
ADD COLUMN hero_zoom REAL NOT NULL DEFAULT 1;

ALTER TABLE profile_gallery
ADD COLUMN title TEXT;

ALTER TABLE profile_gallery
ADD COLUMN description TEXT;
