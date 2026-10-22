-- KawMed V1.6 — visitadores médicos, estaciones numeradas y asignación trazable.
-- Se mantiene aislado de Team, Free y patrocinio público.

ALTER TABLE medical_sponsor_programs ADD COLUMN representative_cta_label TEXT NOT NULL DEFAULT 'Mi visitador';
ALTER TABLE medical_sponsor_programs ADD COLUMN representative_message_template TEXT NOT NULL DEFAULT 'Hola {visitador}, soy {medico}. Te contacto desde mi panel KawMed y necesito información de {patrocinador}.';

ALTER TABLE medical_access_codes ADD COLUMN station_number INTEGER;
ALTER TABLE medical_access_codes ADD COLUMN current_representative_id TEXT;

CREATE TABLE IF NOT EXISTS medical_representatives (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  employee_code TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT,
  zone TEXT,
  territory TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_code_representative_assignments (
  id TEXT PRIMARY KEY,
  medical_access_code_id TEXT NOT NULL,
  representative_id TEXT NOT NULL,
  assigned_by_user_id TEXT,
  assignment_source TEXT NOT NULL DEFAULT 'manual' CHECK (assignment_source IN ('manual','selection','quantity','import','superadmin')),
  group_label TEXT,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  FOREIGN KEY (medical_access_code_id) REFERENCES medical_access_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (representative_id) REFERENCES medical_representatives(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_med_reps_sponsor_employee
  ON medical_representatives(sponsor_id, employee_code)
  WHERE employee_code IS NOT NULL AND employee_code<>'';

CREATE INDEX IF NOT EXISTS idx_med_reps_sponsor_active
  ON medical_representatives(sponsor_id, active, first_name, last_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_med_codes_batch_station
  ON medical_access_codes(batch_id, station_number)
  WHERE batch_id IS NOT NULL AND station_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_med_codes_current_rep
  ON medical_access_codes(current_representative_id, status);

CREATE INDEX IF NOT EXISTS idx_med_rep_assignments_code
  ON medical_code_representative_assignments(medical_access_code_id, active, assigned_at);

CREATE INDEX IF NOT EXISTS idx_med_rep_assignments_rep
  ON medical_code_representative_assignments(representative_id, active, assigned_at);
