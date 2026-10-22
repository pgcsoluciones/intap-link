-- KawMed V1.4 — patrocinio ético visible SOLO al médico autenticado.
-- El paciente nunca recibe estos datos desde el endpoint público del perfil.

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

-- Demo Preview interno. Nunca se muestra en el perfil público del paciente.
INSERT OR IGNORE INTO sponsor_tenants(
  id,name,slug,sponsor_type,banner_title,banner_cta_label,banner_cta_type,banner_cta_value,website_url,is_active
) VALUES(
  'kawmed_demo_lab',
  'Laboratorio de demostración',
  'kawmed-demo-lab',
  'brand',
  'Información profesional para médicos',
  'Conocer el laboratorio',
  'sponsor_url',
  'https://nfc.kawvoia.com',
  'https://nfc.kawvoia.com',
  1
);

INSERT OR REPLACE INTO medical_profile_sponsors(
  medical_profile_id,sponsor_id,vademecum_url,vademecum_label,enabled,updated_at
) VALUES(
  'kawmed_demo_laura_mendez',
  'kawmed_demo_lab',
  'https://nfc.kawvoia.com',
  'Ver vademécum',
  1,
  datetime('now')
);
