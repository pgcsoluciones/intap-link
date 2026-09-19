-- Preview mirror: KawLink Trial 72h
CREATE TABLE IF NOT EXISTS trial_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired')),
  profile_json TEXT NOT NULL,
  created_by_admin_user_id TEXT NOT NULL,
  activated_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trial_profiles_slug_status ON trial_profiles(slug, status);
CREATE INDEX IF NOT EXISTS idx_trial_profiles_creator_created ON trial_profiles(created_by_admin_user_id, created_at);
