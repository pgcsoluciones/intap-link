-- Kawvo Link · Free Demo Templates + Claim v1
-- Isolated metadata around canonical Free profiles. Does not alter profiles schema,
-- Free limits, Trial tables, Sponsored tables, or normal ownership rules.

CREATE TABLE IF NOT EXISTS free_demo_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rubric TEXT NOT NULL,
  template_email TEXT NOT NULL,
  preset_key TEXT NOT NULL DEFAULT 'professional',
  snapshot_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_free_demo_templates_email
  ON free_demo_templates(lower(template_email));

CREATE INDEX IF NOT EXISTS idx_free_demo_templates_active
  ON free_demo_templates(is_active, is_default, created_at DESC);

CREATE TABLE IF NOT EXISTS free_demo_profiles (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE,
  synthetic_owner_user_id TEXT NOT NULL UNIQUE,
  manager_user_id TEXT NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','claim_ready','claimed','disabled')),
  rubric TEXT,
  artifact_id TEXT,
  created_from TEXT NOT NULL DEFAULT 'superadmin' CHECK (created_from IN ('superadmin','free_activation')),
  claimed_by_user_id TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY(synthetic_owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(manager_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(template_id) REFERENCES free_demo_templates(id) ON DELETE SET NULL,
  FOREIGN KEY(artifact_id) REFERENCES intap_artifacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_free_demo_profiles_manager
  ON free_demo_profiles(manager_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_free_demo_profiles_template
  ON free_demo_profiles(template_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS free_demo_claims (
  id TEXT PRIMARY KEY,
  demo_id TEXT NOT NULL,
  special_email TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','in_progress','used','revoked','expired')),
  expires_at TEXT,
  used_at TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(demo_id) REFERENCES free_demo_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_free_demo_claims_demo
  ON free_demo_claims(demo_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS free_demo_claim_sessions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(claim_id) REFERENCES free_demo_claims(id) ON DELETE CASCADE
);
