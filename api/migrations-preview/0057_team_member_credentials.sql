-- Kawvo Link Team · credenciales de Editor/Subadministrador · Preview
-- La contraseña temporal nunca se almacena en texto plano: solo PBKDF2 hash + salt.

CREATE TABLE IF NOT EXISTS team_member_credentials (
  team_member_id TEXT PRIMARY KEY,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0,1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TEXT,
  last_login_at TEXT,
  password_changed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_member_credentials_locked_until
  ON team_member_credentials(locked_until);
