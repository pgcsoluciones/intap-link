-- KawMed Preview V1.1 — exclusiones de seguros médicos
CREATE TABLE IF NOT EXISTS medical_profile_insurance_exclusions (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  insurance_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medical_insurance_exclusions_profile
ON medical_profile_insurance_exclusions(medical_profile_id, active, sort_order);

INSERT OR IGNORE INTO medical_profile_insurance_exclusions
(id, medical_profile_id, insurance_name, sort_order, active)
VALUES
('kawmed_ins_ex_1','kawmed_demo_laura_mendez','Seguro Demo Alfa',1,1),
('kawmed_ins_ex_2','kawmed_demo_laura_mendez','Plan Médico Demo Beta',2,1);
