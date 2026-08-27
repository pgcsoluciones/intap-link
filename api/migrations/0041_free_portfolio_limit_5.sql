-- Align Free portfolio allowance with current product UI.
UPDATE plan_limits
SET max_photos = 5
WHERE plan_id = 'free';
