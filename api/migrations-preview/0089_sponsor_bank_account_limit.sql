-- Kawvo Link · límite de cuentas bancarias por tenant patrocinador
-- Tabla aislada e idempotente: cada tenant puede permitir entre 2 y 5 cuentas activas por perfil.
CREATE TABLE IF NOT EXISTS sponsor_bank_limits (
  sponsor_id TEXT PRIMARY KEY,
  max_accounts INTEGER NOT NULL DEFAULT 3 CHECK (max_accounts BETWEEN 2 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE
);
