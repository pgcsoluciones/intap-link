-- Kawvo Link Team
-- Perfil master + códigos temporales de vinculación + miembros/dispositivos.

CREATE TABLE IF NOT EXISTS team_workspaces (
  id TEXT PRIMARY KEY,
  master_profile_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (master_profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_workspaces_owner ON team_workspaces(owner_user_id);

CREATE TABLE IF NOT EXISTS team_link_codes (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','disabled','used')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by_user_id TEXT,
  artifact_id TEXT,
  member_profile_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (team_id) REFERENCES team_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (artifact_id) REFERENCES intap_artifacts(id) ON DELETE SET NULL,
  FOREIGN KEY (member_profile_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_team_link_codes_team_status ON team_link_codes(team_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_link_codes_expiry ON team_link_codes(status, expires_at);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL UNIQUE,
  invite_code_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES team_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES intap_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (invite_code_id) REFERENCES team_link_codes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
