-- KawLink Sponsored Profile V1 · one beneficiary device per account
-- Preview mirror of production migration 0068.

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
