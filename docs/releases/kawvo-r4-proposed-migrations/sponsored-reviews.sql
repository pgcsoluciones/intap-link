-- Proposed additive schema. Apply only to exact D1 after backup and authorization.
CREATE TABLE sponsored_review_settings (
 sponsored_profile_id TEXT PRIMARY KEY REFERENCES sponsored_profiles(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 google_review_url TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sponsored_review_events (
 id TEXT PRIMARY KEY,
 sponsored_profile_id TEXT NOT NULL REFERENCES sponsored_profiles(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL CHECK(event_type IN ('review_view','review_qr','review_click')),
 target_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(sponsored_profile_id,event_type,target_id)
);
CREATE INDEX idx_sponsored_review_events_period ON sponsored_review_events(sponsored_profile_id,created_at,event_type);
