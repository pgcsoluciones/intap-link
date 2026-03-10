-- Migration 0019: Create profile_videos table
CREATE TABLE IF NOT EXISTS profile_videos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profile_videos_profile_id ON profile_videos(profile_id);
