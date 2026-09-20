-- KawLink Trial Online V1
-- Adds authenticated ownership, 4-day online lifecycle, re-use identities and owner notifications.
-- Existing Super Admin Trials remain compatible and default to origin='superadmin'.

ALTER TABLE trial_profiles ADD COLUMN owner_user_id TEXT;
ALTER TABLE trial_profiles ADD COLUMN started_at TEXT;
ALTER TABLE trial_profiles ADD COLUMN origin TEXT NOT NULL DEFAULT 'superadmin';
ALTER TABLE trial_profiles ADD COLUMN email_normalized TEXT;
ALTER TABLE trial_profiles ADD COLUMN phone_normalized TEXT;
ALTER TABLE trial_profiles ADD COLUMN expiration_notice_acknowledged_at TEXT;
ALTER TABLE trial_profiles ADD COLUMN expiration_notice_acknowledged_by_user_id TEXT;
ALTER TABLE trial_profiles ADD COLUMN conversion_requested_at TEXT;
ALTER TABLE trial_profiles ADD COLUMN converted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_trial_profiles_owner
  ON trial_profiles(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_trial_profiles_origin_status
  ON trial_profiles(origin, status);

CREATE INDEX IF NOT EXISTS idx_trial_profiles_email_normalized
  ON trial_profiles(email_normalized);

CREATE INDEX IF NOT EXISTS idx_trial_profiles_phone_normalized
  ON trial_profiles(phone_normalized);

CREATE TABLE IF NOT EXISTS trial_identity_claims (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  user_id TEXT,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('user','email','phone','instagram')),
  identity_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(identity_type, identity_normalized)
);

CREATE INDEX IF NOT EXISTS idx_trial_identity_claims_trial
  ON trial_identity_claims(trial_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trial_identity_claims_user
  ON trial_identity_claims(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trial_notifications (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_label TEXT,
  cta_url TEXT,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  read_at TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trial_notifications_trial_active
  ON trial_notifications(trial_id, is_active, created_at DESC);
