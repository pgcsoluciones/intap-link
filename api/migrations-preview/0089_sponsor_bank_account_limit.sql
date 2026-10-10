-- Kawvo Link · límites de cuentas bancarias configurables
-- Free: por perfil/usuario. Patrocinado: por tenant.
CREATE TABLE IF NOT EXISTS profile_bank_limits (
  profile_id TEXT PRIMARY KEY,
  max_accounts INTEGER NOT NULL DEFAULT 3 CHECK (max_accounts BETWEEN 2 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sponsor_bank_limits (
  sponsor_id TEXT PRIMARY KEY,
  max_accounts INTEGER NOT NULL DEFAULT 3 CHECK (max_accounts BETWEEN 2 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE
);
