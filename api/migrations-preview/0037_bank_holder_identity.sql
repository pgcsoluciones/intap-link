-- Preview — Identificación del titular para cuentas bancarias
-- El número nunca se renderiza públicamente; se entrega solo bajo acción explícita de copiar.

ALTER TABLE profile_bank_accounts ADD COLUMN holder_id_type TEXT CHECK (holder_id_type IN ('cedula','rnc'));
ALTER TABLE profile_bank_accounts ADD COLUMN holder_id_number TEXT;
