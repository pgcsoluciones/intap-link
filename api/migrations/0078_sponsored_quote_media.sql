-- Ephemeral media attached to public sponsored quote requests.
-- Files are accessible only through an expiring token route and are deleted from R2 after expiry.
CREATE TABLE IF NOT EXISTS sponsored_quote_media (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  r2_key TEXT NOT NULL UNIQUE,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image','document','audio')),
  content_type TEXT NOT NULL,
  original_name TEXT,
  size_bytes INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES sponsored_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sponsored_quote_media_expiry
  ON sponsored_quote_media(expires_at);

CREATE INDEX IF NOT EXISTS idx_sponsored_quote_media_rate
  ON sponsored_quote_media(profile_id, ip_hash, created_at);
