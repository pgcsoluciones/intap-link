-- Free portfolio expands from 5 to 10 images.
UPDATE plan_limits
SET max_photos = 10
WHERE plan_id = 'free';
