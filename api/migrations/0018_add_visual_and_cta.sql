-- Migration 0018: Add visual config, blocks order, CTA flag, and product/video limits
-- profiles: blocks_order, accent_color, button_style
-- profile_links: is_cta
-- plan_limits: max_products, max_videos

ALTER TABLE profiles ADD COLUMN blocks_order TEXT DEFAULT '["links","faqs","products","video","gallery"]';
ALTER TABLE profiles ADD COLUMN accent_color TEXT DEFAULT '#3B82F6';
ALTER TABLE profiles ADD COLUMN button_style TEXT DEFAULT 'rounded';

ALTER TABLE profile_links ADD COLUMN is_cta INTEGER NOT NULL DEFAULT 0;

ALTER TABLE plan_limits ADD COLUMN max_products INTEGER NOT NULL DEFAULT 3;
ALTER TABLE plan_limits ADD COLUMN max_videos INTEGER NOT NULL DEFAULT 1;

-- Update existing plan rows with appropriate product/video limits
UPDATE plan_limits SET max_products = 3,  max_videos = 1  WHERE plan_id = 'free';
UPDATE plan_limits SET max_products = 8,  max_videos = 3  WHERE plan_id = 'starter';
UPDATE plan_limits SET max_products = 25, max_videos = 10 WHERE plan_id = 'pro';
UPDATE plan_limits SET max_products = 50, max_videos = 30 WHERE plan_id = 'agency';
