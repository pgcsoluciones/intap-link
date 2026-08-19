-- 0035_demo_viral_share.sql
-- Kawvo Link Demo: snapshots temporales (24 h) + analítica de conversión/viralidad.
-- No crea usuarios, perfiles ni slugs públicos.

CREATE TABLE IF NOT EXISTS demo_share_snapshots (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  sector_key TEXT,
  payload_json TEXT NOT NULL,
  portrait_key TEXT,
  service_image_keys_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  opened_count INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_demo_share_snapshots_expires_at
  ON demo_share_snapshots(expires_at);

CREATE INDEX IF NOT EXISTS idx_demo_share_snapshots_created_at
  ON demo_share_snapshots(created_at);

CREATE TABLE IF NOT EXISTS demo_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  snapshot_id TEXT,
  sector_key TEXT,
  source TEXT NOT NULL DEFAULT 'demo',
  session_key TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (snapshot_id) REFERENCES demo_share_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_events_type_created
  ON demo_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_demo_events_snapshot
  ON demo_events(snapshot_id, created_at);

CREATE INDEX IF NOT EXISTS idx_demo_events_sector_created
  ON demo_events(sector_key, created_at);
