-- Kawvo Link · límite de cuentas bancarias por tenant patrocinador
-- Cada tenant puede permitir entre 2 y 5 cuentas activas por perfil patrocinado.
ALTER TABLE sponsor_tenants
ADD COLUMN bank_account_limit INTEGER NOT NULL DEFAULT 3
CHECK (bank_account_limit BETWEEN 2 AND 5);
