-- KawMed V1.5 — códigos MED, lotes y programas de patrocinio médico privados.
-- Totalmente separado de artifacts/Free/Trial/Sponsored público.

CREATE TABLE IF NOT EXISTS medical_sponsor_programs (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  private_banner_image_url TEXT,
  private_cta_label TEXT NOT NULL DEFAULT 'Conocer más',
  private_cta_url TEXT,
  vademecum_url TEXT,
  vademecum_label TEXT NOT NULL DEFAULT 'Ver vademécum',
  notes TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS medical_code_batches (
  id TEXT PRIMARY KEY,
  program_id TEXT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 5000),
  notes TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (program_id) REFERENCES medical_sponsor_programs(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS medical_access_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  batch_id TEXT,
  program_id TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','claimed','inactive')),
  claimed_by_user_id TEXT,
  medical_profile_id TEXT,
  claimed_at TEXT,
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES medical_code_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (program_id) REFERENCES medical_sponsor_programs(id) ON DELETE RESTRICT,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_medical_programs_sponsor ON medical_sponsor_programs(sponsor_id, enabled);
CREATE INDEX IF NOT EXISTS idx_medical_batches_program ON medical_code_batches(program_id, created_at);
CREATE INDEX IF NOT EXISTS idx_medical_codes_batch ON medical_access_codes(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_medical_codes_program ON medical_access_codes(program_id, status);
CREATE INDEX IF NOT EXISTS idx_medical_codes_owner ON medical_access_codes(claimed_by_user_id, claimed_at);

ALTER TABLE medical_profile_sponsors ADD COLUMN program_id TEXT;
