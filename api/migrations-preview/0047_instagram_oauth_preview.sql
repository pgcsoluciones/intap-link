-- 0047_instagram_oauth_preview.sql
-- SOLO PREVIEW: OAuth seguro de Instagram por perfil.
-- No guarda contraseñas. El access token se guarda cifrado con AES-GCM.

CREATE TABLE IF NOT EXISTS profile_instagram_invites (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','started','used','revoked')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  used_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_instagram_invites_profile
  ON profile_instagram_invites(profile_id, status, expires_at);

CREATE TABLE IF NOT EXISTS profile_instagram_oauth_states (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (invite_id) REFERENCES profile_instagram_invites(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_instagram_oauth_states_state
  ON profile_instagram_oauth_states(state_hash, expires_at);

CREATE TABLE IF NOT EXISTS profile_instagram_connections (
  profile_id TEXT PRIMARY KEY,
  instagram_user_id TEXT NOT NULL,
  username TEXT,
  account_type TEXT,
  token_ciphertext TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_expires_at TEXT,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  disconnected_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
