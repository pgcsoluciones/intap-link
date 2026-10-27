-- Kawvo Link patrocinio normal · vendedores y trazabilidad aislada de KawMed.
CREATE TABLE IF NOT EXISTS sponsor_sales_representatives (
 id TEXT PRIMARY KEY,
 sponsor_id TEXT NOT NULL REFERENCES sponsor_tenants(id) ON DELETE CASCADE,
 employee_code TEXT,
 first_name TEXT NOT NULL,
 last_name TEXT NOT NULL DEFAULT '',
 whatsapp TEXT NOT NULL,
 email TEXT,
 zone TEXT,
 territory TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsor_sales_reps_tenant ON sponsor_sales_representatives(sponsor_id,active);
CREATE TABLE IF NOT EXISTS sponsor_sales_assignments (
 id TEXT PRIMARY KEY,
 sponsor_id TEXT NOT NULL REFERENCES sponsor_tenants(id) ON DELETE CASCADE,
 sponsor_artifact_id TEXT NOT NULL REFERENCES sponsor_artifacts(id) ON DELETE CASCADE,
 representative_id TEXT NOT NULL REFERENCES sponsor_sales_representatives(id) ON DELETE CASCADE,
 group_label TEXT,
 assigned_by_user_id TEXT,
 assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
 ended_at TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_sponsor_sales_assignment_lookup ON sponsor_sales_assignments(sponsor_id,sponsor_artifact_id,active);
CREATE INDEX IF NOT EXISTS idx_sponsor_sales_assignment_rep ON sponsor_sales_assignments(sponsor_id,representative_id,active);
