-- Ephemeral media attached to public Free quote requests.
-- Mirrors the approved Sponsored quote-media behavior while preserving
-- the existing sponsored_quote_media foreign-key boundary.
CREATE TABLE IF NOT EXISTS free_quote_media (
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
  batch_id TEXT,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_free_quote_media_expiry
  ON free_quote_media(expires_at);

CREATE INDEX IF NOT EXISTS idx_free_quote_media_rate
  ON free_quote_media(profile_id, ip_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_free_quote_media_batch
  ON free_quote_media(batch_id, profile_id);
