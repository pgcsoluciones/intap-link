-- KawLink Sponsored · parity bancaria con Perfil Free
-- Mantiene almacenamiento patrocinado aislado de Free/Plus/Team.

ALTER TABLE sponsored_bank_accounts ADD COLUMN bank_code TEXT;
ALTER TABLE sponsored_bank_accounts ADD COLUMN holder_id_type TEXT CHECK (holder_id_type IN ('cedula','rnc') OR holder_id_type IS NULL);
ALTER TABLE sponsored_bank_accounts ADD COLUMN holder_id_number TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsored_bank_accounts ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'masked' CHECK (display_mode IN ('masked','visible'));

CREATE TABLE IF NOT EXISTS sponsored_bank_settings (
  sponsored_profile_id TEXT PRIMARY KEY,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsored_profile_id) REFERENCES sponsored_profiles(id) ON DELETE CASCADE
);

UPDATE sponsored_bank_accounts
SET bank_code = CASE lower(trim(bank_name))
  WHEN 'banco vimenca' THEN 'vimenca'
  WHEN 'banco promerica' THEN 'promerica'
  WHEN 'banco popular dominicano' THEN 'popular'
  WHEN 'banco bdi' THEN 'bdi'
  WHEN 'banco santa cruz' THEN 'santa-cruz'
  WHEN 'banco bhd león' THEN 'bhd-leon'
  WHEN 'banco bhd leon' THEN 'bhd-leon'
  WHEN 'banco ademi' THEN 'ademi'
  WHEN 'banesco' THEN 'banesco'
  WHEN 'scotiabank república dominicana' THEN 'scotiabank'
  WHEN 'scotiabank republica dominicana' THEN 'scotiabank'
  WHEN 'la nacional ahorros y préstamos' THEN 'la-nacional'
  WHEN 'la nacional ahorros y prestamos' THEN 'la-nacional'
  WHEN 'banco de reservas' THEN 'banreservas'
  WHEN 'citi' THEN 'citi'
  WHEN 'banco caribe' THEN 'caribe'
  WHEN 'banco lópez de haro' THEN 'lopez-de-haro'
  WHEN 'banco lopez de haro' THEN 'lopez-de-haro'
  WHEN 'bellbank' THEN 'bellbank'
  WHEN 'banco múltiple activo dominicana' THEN 'activo-dominicana'
  WHEN 'banco multiple activo dominicana' THEN 'activo-dominicana'
  WHEN 'banco lafise' THEN 'lafise'
  WHEN 'asociación cibao de ahorros y préstamos' THEN 'asociacion-cibao'
  WHEN 'asociacion cibao de ahorros y prestamos' THEN 'asociacion-cibao'
  ELSE bank_code
END
WHERE bank_code IS NULL OR trim(bank_code)='';

CREATE INDEX IF NOT EXISTS idx_sponsored_bank_settings_enabled
  ON sponsored_bank_settings(is_enabled);
