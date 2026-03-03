-- 0022_profile_template.sql
-- Vertical templates: template_id + template_data (JSON) per profile

ALTER TABLE profiles ADD COLUMN template_id   TEXT;
ALTER TABLE profiles ADD COLUMN template_data TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_template ON profiles(template_id) WHERE template_id IS NOT NULL;
