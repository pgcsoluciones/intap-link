-- KawLink Sponsored Profile V1 · sponsor owner profile
-- The sponsor owner uses the same sponsored public presentation as beneficiaries.

ALTER TABLE sponsor_tenants ADD COLUMN profile_slug TEXT;
ALTER TABLE sponsored_profiles ADD COLUMN profile_role TEXT NOT NULL DEFAULT 'beneficiary';

CREATE INDEX IF NOT EXISTS idx_sponsored_profiles_role
  ON sponsored_profiles(sponsor_id, profile_role, user_id);
