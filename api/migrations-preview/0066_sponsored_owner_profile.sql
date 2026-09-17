-- Preview · sponsor owner profile
ALTER TABLE sponsor_tenants ADD COLUMN profile_slug TEXT;
ALTER TABLE sponsored_profiles ADD COLUMN profile_role TEXT NOT NULL DEFAULT 'beneficiary';
CREATE INDEX IF NOT EXISTS idx_sponsored_profiles_role ON sponsored_profiles(sponsor_id, profile_role, user_id);
