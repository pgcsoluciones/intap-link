-- Sponsored public primary actions visibility.
-- Preserve approved behavior: quote visible by default, agenda hidden until configured.
ALTER TABLE sponsored_profiles ADD COLUMN quote_button_visible INTEGER NOT NULL DEFAULT 1 CHECK (quote_button_visible IN (0,1));
ALTER TABLE sponsored_profiles ADD COLUMN appointment_button_visible INTEGER NOT NULL DEFAULT 0 CHECK (appointment_button_visible IN (0,1));
