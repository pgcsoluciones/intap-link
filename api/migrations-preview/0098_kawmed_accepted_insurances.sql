-- KawMed V1.8 — seguros médicos aceptados explícitos.
-- Mantiene exclusiones separadas para comunicar con claridad cobertura y excepciones.

CREATE TABLE IF NOT EXISTS medical_profile_insurances (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  insurance_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medical_profile_insurances_profile
ON medical_profile_insurances(medical_profile_id, active, sort_order);

INSERT OR IGNORE INTO medical_profile_insurances
(id, medical_profile_id, insurance_name, sort_order, active)
VALUES
('kawmed_ins_accept_1','kawmed_demo_laura_mendez','ARS Demo Salud',1,1),
('kawmed_ins_accept_2','kawmed_demo_laura_mendez','ARS Demo Integral',2,1),
('kawmed_ins_accept_3','kawmed_demo_laura_mendez','Plan Demo Preferente',3,1);
