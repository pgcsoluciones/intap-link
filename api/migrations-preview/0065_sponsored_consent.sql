-- Sponsored activation consent V1
-- Records the beneficiary's explicit acceptance at claim time.

ALTER TABLE sponsored_profiles ADD COLUMN consent_version TEXT;
ALTER TABLE sponsored_profiles ADD COLUMN consent_accepted_at TEXT;
ALTER TABLE sponsored_profiles ADD COLUMN consent_sponsor_name TEXT;
