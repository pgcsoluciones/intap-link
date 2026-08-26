CREATE TABLE IF NOT EXISTS profile_preview_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_preview_sessions_profile_id
  ON profile_preview_sessions(profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_preview_sessions_expires_at
  ON profile_preview_sessions(expires_at);
