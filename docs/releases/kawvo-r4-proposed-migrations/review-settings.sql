-- Proposal only: not in either active migrations directory. Do not apply without
-- explicit environment/schema approval and backup. No existing profile is changed.
CREATE TABLE profile_review_settings (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  google_review_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Free and Plus: FreeAccount.planLabel maps basic to PLUS; verified in Preview catalog.
INSERT INTO modules(code,name,effects_json)
VALUES ('reviews_google','Reseñas Google','{"includedPlans":["free","basic"]}');
