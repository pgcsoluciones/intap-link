-- Trial CRM, duration control and traceability.
-- Existing Trials remain intact; existing rows default to 72 hours.

ALTER TABLE trial_profiles ADD COLUMN duration_hours INTEGER NOT NULL DEFAULT 72;
ALTER TABLE trial_profiles ADD COLUMN contact_name TEXT;
ALTER TABLE trial_profiles ADD COLUMN contact_phone TEXT;
ALTER TABLE trial_profiles ADD COLUMN contact_whatsapp TEXT;
ALTER TABLE trial_profiles ADD COLUMN contact_email TEXT;
ALTER TABLE trial_profiles ADD COLUMN contact_instagram TEXT;
ALTER TABLE trial_profiles ADD COLUMN company_name TEXT;
ALTER TABLE trial_profiles ADD COLUMN company_type TEXT;
ALTER TABLE trial_profiles ADD COLUMN contact_source TEXT;
ALTER TABLE trial_profiles ADD COLUMN contact_source_detail TEXT;
ALTER TABLE trial_profiles ADD COLUMN prospect_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_trial_profiles_status_expires
  ON trial_profiles(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_trial_profiles_source
  ON trial_profiles(contact_source);

CREATE TABLE IF NOT EXISTS trial_events (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trial_events_trial_created
  ON trial_events(trial_id, created_at DESC);
