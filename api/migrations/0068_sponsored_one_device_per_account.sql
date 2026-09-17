-- KawLink Sponsored Profile V1 · one beneficiary device per account
-- A regular sponsored account may own only one beneficiary presentation/device.
-- Sponsor-owner Master profiles are intentionally excluded from this constraint.
-- Trigger-based enforcement avoids failing the migration if historical duplicate
-- rows already exist; all new beneficiary claims are protected from this point on.

CREATE TRIGGER IF NOT EXISTS trg_sponsored_profiles_one_beneficiary_per_user
BEFORE INSERT ON sponsored_profiles
WHEN NEW.profile_role = 'beneficiary'
  AND EXISTS (
    SELECT 1
      FROM sponsored_profiles
     WHERE user_id = NEW.user_id
       AND profile_role = 'beneficiary'
  )
BEGIN
  SELECT RAISE(ABORT, 'sponsored_account_already_linked');
END;
