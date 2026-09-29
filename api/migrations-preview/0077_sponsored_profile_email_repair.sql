-- Recovery for Preview: 0076 was recorded as applied while its SQL contained literal escaped newlines.
ALTER TABLE sponsored_profiles ADD COLUMN email TEXT;
