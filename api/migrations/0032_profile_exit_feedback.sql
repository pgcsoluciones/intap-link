CREATE TABLE IF NOT EXISTS profile_exit_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT,
  profile_slug TEXT,
  reason TEXT NOT NULL,
  improvement_one TEXT,
  improvement_two TEXT,
  trial_offer_eligible INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profile_exit_feedback_user
  ON profile_exit_feedback(user_id, created_at DESC);
