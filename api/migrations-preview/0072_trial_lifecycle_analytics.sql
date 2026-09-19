-- Trial lifecycle controls and privacy-conscious analytics.
-- No raw IP addresses are stored.

ALTER TABLE trial_profiles ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trial_profiles ADD COLUMN deactivated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_trial_profiles_disabled
  ON trial_profiles(is_disabled, status);

CREATE TABLE IF NOT EXISTS trial_analytics_events (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_label TEXT,
  visitor_id TEXT,
  session_id TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  device_type TEXT,
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trial_analytics_trial_created
  ON trial_analytics_events(trial_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trial_analytics_trial_event
  ON trial_analytics_events(trial_id, event_type);
