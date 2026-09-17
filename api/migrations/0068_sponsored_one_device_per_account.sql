-- KawLink Sponsored Profile V1 · one beneficiary device per account
-- A regular sponsored account may own only one beneficiary presentation/device.
-- Sponsor-owner Master profiles are intentionally excluded from this constraint.

CREATE UNIQUE INDEX IF NOT EXISTS ux_sponsored_profiles_one_beneficiary_per_user
  ON sponsored_profiles(user_id)
  WHERE profile_role = 'beneficiary';
