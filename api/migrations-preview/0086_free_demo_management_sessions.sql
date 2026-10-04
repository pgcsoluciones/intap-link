-- Kawvo Link · isolated management bridge for Free Demo profiles.
-- Allows only the special manager to enter the canonical Free editor as the
-- synthetic owner of one Demo, without broadening normal Free ownership rules.

CREATE TABLE IF NOT EXISTS free_demo_management_sessions (
  id TEXT PRIMARY KEY,
  demo_id TEXT NOT NULL,
  manager_user_id TEXT NOT NULL,
  synthetic_owner_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(demo_id) REFERENCES free_demo_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY(manager_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(synthetic_owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_free_demo_management_sessions_active
  ON free_demo_management_sessions(manager_user_id, demo_id, expires_at);
