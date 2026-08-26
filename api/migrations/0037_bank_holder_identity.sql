-- Producción — Identificación del titular para cuentas bancarias
-- Archivo espejo de Preview. NO aplicar a Producción hasta autorización y QA aprobado.

ALTER TABLE profile_bank_accounts ADD COLUMN holder_id_type TEXT CHECK (holder_id_type IN ('cedula','rnc'));
ALTER TABLE profile_bank_accounts ADD COLUMN holder_id_number TEXT;
