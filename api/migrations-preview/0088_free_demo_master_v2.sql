-- Kawvo Link · Free Demo MASTER v2
-- Isolated orchestration for SuperAdmin-created Free demonstrations.
-- The editable/public profile itself remains a canonical Free profile so current
-- Free rendering, agenda, quote and limits stay authoritative.
-- This migration does not alter Trial, Sponsored or normal Free ownership rules.

CREATE TABLE IF NOT EXISTS free_demo_v2_profiles (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE,
  synthetic_owner_user_id TEXT NOT NULL UNIQUE,
  template_key TEXT NOT NULL,
  template_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','claim_ready','claimed','disabled')),
  published_at TEXT,
  claimed_by_user_id TEXT,
  claimed_owner_email TEXT,
  claimed_at TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY(synthetic_owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(claimed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_free_demo_v2_status
  ON free_demo_v2_profiles(status, created_at);

CREATE INDEX IF NOT EXISTS idx_free_demo_v2_template
  ON free_demo_v2_profiles(template_key, status);

CREATE TABLE IF NOT EXISTS free_demo_v2_claims (
  id TEXT PRIMARY KEY,
  demo_id TEXT NOT NULL,
  special_email TEXT NOT NULL,
  slug_snapshot TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','in_progress','used','revoked','expired')),
  expires_at TEXT,
  used_at TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(demo_id) REFERENCES free_demo_v2_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_free_demo_v2_claims_demo_status
  ON free_demo_v2_claims(demo_id, status);
