-- 0020_leads_status_origin.sql
-- Adds status tracking and origin field to leads table

ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN origin TEXT;

-- Index for filtering by status and profile
CREATE INDEX IF NOT EXISTS idx_leads_slug_status ON leads(profile_slug, status);
