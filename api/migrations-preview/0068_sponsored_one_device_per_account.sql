-- KawLink Sponsored Profile V1 · one beneficiary device per account
-- Preview mirror of production migration 0068.

CREATE UNIQUE INDEX IF NOT EXISTS ux_sponsored_profiles_one_beneficiary_per_user
  ON sponsored_profiles(user_id)
  WHERE profile_role = 'beneficiary';
