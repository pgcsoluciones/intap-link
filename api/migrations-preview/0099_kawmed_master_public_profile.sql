-- KawMed V1.9 — perfil público de ejemplo del Master médico.
-- Reutiliza medical_profiles y toda la experiencia pública /m/:slug; solo agrega la relación sponsor -> perfil Master.

CREATE TABLE IF NOT EXISTS medical_sponsor_master_profiles (
  sponsor_id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_med_sponsor_master_profile_medical
ON medical_sponsor_master_profiles(medical_profile_id);
