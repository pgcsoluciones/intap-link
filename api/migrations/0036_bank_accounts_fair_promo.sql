-- KAWVO LINK — Cuentas bancarias + beneficio Feria 2026
-- Regla comercial:
--   * Perfil Free activado/publicado hasta 2026-09-05 23:59:59 America/Santo_Domingo
--     conserva Cuentas bancarias permanentemente.
--   * Desde 2026-09-06, Free requiere un entitlement/promoción futura.
--   * Planes pagados conservan acceso por plan.
-- Cutoff equivalente en UTC: 2026-09-06 04:00:00.

INSERT OR IGNORE INTO modules (code, name, effects_json)
VALUES ('bank_accounts', 'Cuentas bancarias', '{}');

CREATE TABLE IF NOT EXISTS profile_bank_settings (
  profile_id TEXT PRIMARY KEY,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_bank_accounts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  bank_code TEXT,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('savings','checking')),
  currency TEXT NOT NULL CHECK (currency IN ('DOP','USD')),
  holder_name TEXT NOT NULL,
  display_mode TEXT NOT NULL DEFAULT 'masked' CHECK (display_mode IN ('masked','visible')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_bank_accounts_profile
  ON profile_bank_accounts(profile_id, sort_order);

-- Todos los perfiles Free que ya estaban publicados antes de desplegar esta
-- migración quedan incluidos en la promoción y no perderán el beneficio.
INSERT OR IGNORE INTO profile_modules (profile_id, module_code, expires_at, activated_at)
SELECT id, 'bank_accounts', NULL, COALESCE(updated_at, created_at, datetime('now'))
FROM profiles
WHERE plan_id = 'free' AND is_published = 1;

-- El beneficio se concede exactamente en la primera activación/publicación
-- durante la ventana promocional. Queda grabado como módulo sin expiración.
CREATE TRIGGER IF NOT EXISTS trg_bank_accounts_fair_on_publish
AFTER UPDATE OF is_published ON profiles
WHEN NEW.plan_id = 'free'
  AND NEW.is_published = 1
  AND OLD.is_published = 0
  AND datetime('now') < '2026-09-06 04:00:00'
BEGIN
  INSERT OR IGNORE INTO profile_modules (profile_id, module_code, expires_at, activated_at)
  VALUES (NEW.id, 'bank_accounts', NULL, datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS trg_bank_accounts_fair_on_insert
AFTER INSERT ON profiles
WHEN NEW.plan_id = 'free'
  AND NEW.is_published = 1
  AND datetime('now') < '2026-09-06 04:00:00'
BEGIN
  INSERT OR IGNORE INTO profile_modules (profile_id, module_code, expires_at, activated_at)
  VALUES (NEW.id, 'bank_accounts', NULL, datetime('now'));
END;
