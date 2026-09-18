-- KawLink Sponsored · authorized multi-profile QA/presentation account
-- Keeps the one-beneficiary-profile rule for every other account.
-- The authorized email may own multiple beneficiary sponsored profiles.

DROP TRIGGER IF EXISTS trg_sponsored_profiles_one_beneficiary_per_user;

CREATE TRIGGER IF NOT EXISTS trg_sponsored_profiles_one_beneficiary_per_user
BEFORE INSERT ON sponsored_profiles
WHEN NEW.profile_role = 'beneficiary'
  AND NOT EXISTS (
    SELECT 1
      FROM users u
     WHERE u.id = NEW.user_id
       AND lower(trim(COALESCE(u.email,''))) = 'intapcard@gmail.com'
  )
  AND EXISTS (
    SELECT 1
      FROM sponsored_profiles sp
     WHERE sp.user_id = NEW.user_id
       AND sp.profile_role = 'beneficiary'
  )
BEGIN
  SELECT RAISE(ABORT, 'sponsored_account_already_linked');
END;
