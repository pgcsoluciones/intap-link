-- 0027_free_profile_layout.sql
-- Layout visual de INTAP LINK Gratis.
-- Este campo es independiente de theme_id y template_id.

ALTER TABLE profiles
ADD COLUMN layout_id TEXT NOT NULL DEFAULT 'esencial'
CHECK (
  layout_id IN (
    'impacto',
    'personal',
    'esencial'
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_layout_id
  ON profiles(layout_id);
