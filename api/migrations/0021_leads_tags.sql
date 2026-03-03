-- 0021_leads_tags.sql
-- Adds tags (JSON array) to leads + index on created_at for date filtering

ALTER TABLE leads ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_leads_slug_created ON leads(profile_slug, created_at DESC);
