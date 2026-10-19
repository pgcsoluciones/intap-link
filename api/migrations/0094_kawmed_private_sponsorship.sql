-- KawMed V1.4 — patrocinio ético visible SOLO al médico autenticado.
-- No agrega patrocinio al payload ni al renderer público del paciente.

CREATE TABLE IF NOT EXISTS medical_profile_sponsors (
  medical_profile_id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  vademecum_url TEXT,
  vademecum_label TEXT NOT NULL DEFAULT 'Ver vademécum',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_medical_profile_sponsors_sponsor
  ON medical_profile_sponsors(sponsor_id, enabled);
