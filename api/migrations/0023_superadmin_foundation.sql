-- 0023_superadmin_foundation.sql
-- Super Admin Foundation: admin_users, admin_audit_log, profile_plan_overrides
-- + columnas nuevas en profiles y profile_modules
-- Todas las sentencias son idempotentes (IF NOT EXISTS / IF NOT EXIST).

-- ── 1. Tabla admin_users ─────────────────────────────────────────────────────
-- Roles: 'super_admin' | 'support' | 'viewer'
-- El primer superadmin se siembra en esta misma migración.
-- No hay FK real a users porque la tabla puede no existir aún en local;
-- la integridad se garantiza a nivel de aplicación.

CREATE TABLE IF NOT EXISTS admin_users (
  user_id      TEXT NOT NULL PRIMARY KEY,
  role         TEXT NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('super_admin', 'support', 'viewer')),
  granted_by   TEXT,
  granted_at   DATETIME NOT NULL DEFAULT (datetime('now')),
  notes        TEXT
);

-- ── 2. Tabla admin_audit_log ─────────────────────────────────────────────────
-- Registra toda acción admin con snapshot antes/después (JSON).
-- target_type: 'profile' | 'user' | 'module' | 'admin_user'

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             TEXT NOT NULL PRIMARY KEY
                   DEFAULT (lower(hex(randomblob(8)))),
  admin_user_id  TEXT NOT NULL,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  before_json    TEXT,
  after_json     TEXT,
  ip             TEXT,
  created_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_user
  ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target
  ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON admin_audit_log(created_at);

-- ── 3. Tabla profile_plan_overrides ──────────────────────────────────────────
-- Override manual de límites por perfil (admin puede superar lo que permite el plan).
-- Todos los campos de límite son NULL por defecto → significa "sin override".
-- trial_ends_at expirado → se ignora el override en entitlements.ts.

CREATE TABLE IF NOT EXISTS profile_plan_overrides (
  profile_id        TEXT NOT NULL PRIMARY KEY,
  max_links         INTEGER,
  max_photos        INTEGER,
  max_faqs          INTEGER,
  max_products      INTEGER,
  max_videos        INTEGER,
  can_use_vcard     INTEGER,          -- NULL=no override; 0=force off; 1=force on
  trial_plan_id     TEXT,             -- plan_id a aplicar durante el trial
  trial_ends_at     DATETIME,
  override_reason   TEXT,
  overridden_by     TEXT NOT NULL,    -- user_id del admin que hizo el override
  overridden_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- ── 4. Nuevas columnas en profiles ───────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN trial_ends_at        DATETIME;
ALTER TABLE profiles ADD COLUMN deactivation_reason  TEXT;
ALTER TABLE profiles ADD COLUMN admin_notes          TEXT;

-- ── 5. Nuevas columnas en profile_modules ────────────────────────────────────

ALTER TABLE profile_modules ADD COLUMN assigned_by         TEXT;   -- user_id del admin
ALTER TABLE profile_modules ADD COLUMN assignment_reason   TEXT;

-- ── 6. Seed: primer superadmin ───────────────────────────────────────────────
-- El user_id se resuelve por email en runtime; este seed es de respaldo manual.
-- Si el usuario aún no existe en DB (primer deploy), este INSERT no tendrá efecto
-- hasta que el admin haga login por primera vez y quede registrado en users.
-- El script de bootstrap en api/src/lib/admin-auth.ts se encarga del upsert real.

-- (no hay seed automático aquí para evitar hardcodear un user_id desconocido)
