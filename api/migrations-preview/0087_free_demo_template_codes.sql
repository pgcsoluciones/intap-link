-- Kawvo Link · one-time template codes for Free Demo creation.
-- Mirrors the Trial lifecycle concept: master template -> independent draft -> edit -> publish,
-- while keeping Free storage/auth completely isolated from Trial.

CREATE TABLE IF NOT EXISTS free_demo_template_codes (
  id TEXT PRIMARY KEY,
  preset_key TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','redeeming','used','revoked','expired')),
  expires_at TEXT,
  redeemed_by_manager_user_id TEXT,
  demo_id TEXT,
  used_at TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(redeemed_by_manager_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(demo_id) REFERENCES free_demo_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_free_demo_template_codes_status
  ON free_demo_template_codes(status, created_at);

CREATE INDEX IF NOT EXISTS idx_free_demo_template_codes_preset
  ON free_demo_template_codes(preset_key, status);
