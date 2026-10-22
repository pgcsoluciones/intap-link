-- KawMed V1.7 — Master médico por patrocinador + contexto multicuenta seguro.
-- No reutiliza sponsor_artifacts: el Master KawMed es un acceso privado al panel médico.

CREATE TABLE IF NOT EXISTS medical_sponsor_masters (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL UNIQUE,
  master_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','claimed','inactive')),
  claimed_by_user_id TEXT,
  claimed_at TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_medical_sponsor_masters_code
  ON medical_sponsor_masters(master_code,status);

CREATE TABLE IF NOT EXISTS sponsor_user_context (
  user_id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sponsor_user_context_sponsor
  ON sponsor_user_context(sponsor_id,updated_at);
