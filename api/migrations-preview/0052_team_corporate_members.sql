-- Kawvo Link Team · corporate member access · Preview
-- Miembros normales no requieren cuenta de acceso. Los roles administrativos sí pueden recibir credencial.

CREATE TABLE IF NOT EXISTS team_member_credentials (
  team_member_id TEXT PRIMARY KEY,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  password_changed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_member_credentials_lock
  ON team_member_credentials(locked_until);
