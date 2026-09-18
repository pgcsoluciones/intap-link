-- KawLink Sponsored · align bank module UX with approved Free bank module
-- Scoped only to sponsored tables. Free/Plus/Team tables remain untouched.

ALTER TABLE sponsored_bank_accounts ADD COLUMN bank_code TEXT;
ALTER TABLE sponsored_bank_accounts ADD COLUMN holder_id_type TEXT;
ALTER TABLE sponsored_bank_accounts ADD COLUMN holder_id_number TEXT;
ALTER TABLE sponsored_bank_accounts ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'masked'
  CHECK (display_mode IN ('masked','visible'));

CREATE TABLE IF NOT EXISTS sponsored_bank_settings (
  sponsored_profile_id TEXT PRIMARY KEY,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsored_profile_id) REFERENCES sponsored_profiles(id) ON DELETE CASCADE
);
