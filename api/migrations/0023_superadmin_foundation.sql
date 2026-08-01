-- 0023_superadmin_foundation.sql
-- Super Admin Foundation: admin_users, admin_audit_log, profile_plan_overrides
-- + columnas nuevas en profiles y profile_modules
--
-- ⚠️  MIGRACIÓN ONE-TIME — gestionada por Wrangler (d1_migrations).
--     Wrangler la ejecuta exactamente una vez y nunca la re-aplica.
--     NO re-ejecutar manualmente: las secciones 4 y 5 usan DROP TABLE,
--     y SQLite no permite SELECT de columnas que aún no existen, por lo que
--     es imposible lograr idempotencia real en SQL puro para este patrón.
--
-- Secciones 1-3: CREATE TABLE IF NOT EXISTS → seguras en cualquier re-run.
-- Secciones 4-5: rename-table (patrón 0012/0017) → seguras solo en first-run.

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
-- Patrón rename-table (one-time): crea tabla nueva con schema completo,
-- copia las columnas garantizadas (0001→0022), descarta la vieja, renombra.
-- Las columnas nuevas (trial_ends_at, deactivation_reason, admin_notes) no se
-- pueden copiar aquí porque no existen en la tabla origen en el primer run;
-- incluirlas en el SELECT causaría "no such column" en SQLite/D1.
-- En re-run manual: datos de esas columnas se perderían — por eso es one-time.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS profiles_v23;

CREATE TABLE profiles_v23 (
  id                  TEXT     PRIMARY KEY,
  user_id             TEXT     NOT NULL,
  slug                TEXT     UNIQUE NOT NULL,
  plan_id             TEXT     NOT NULL DEFAULT 'free',
  theme_id            TEXT     NOT NULL DEFAULT 'default',
  name                TEXT,
  bio                 TEXT,
  is_published        INTEGER  NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
  whatsapp_number     TEXT,
  avatar_url          TEXT,
  category            TEXT,
  subcategory         TEXT,
  updated_at          DATETIME,
  is_active           INTEGER  NOT NULL DEFAULT 1,
  blocks_order        TEXT     DEFAULT '["links","faqs","products","video","gallery"]',
  accent_color        TEXT     DEFAULT '#3B82F6',
  button_style        TEXT     DEFAULT 'rounded',
  template_id         TEXT,
  template_data       TEXT     NOT NULL DEFAULT '{}',
  -- columnas 0023 (admin)
  trial_ends_at       DATETIME,
  deactivation_reason TEXT,
  admin_notes         TEXT
);

-- Copia columnas garantizadas 0017+0018+0022.
-- Las tres columnas nuevas quedan NULL en todos los perfiles existentes.
INSERT OR IGNORE INTO profiles_v23 (
  id, user_id, slug, plan_id, theme_id, name, bio,
  is_published, created_at, whatsapp_number, avatar_url,
  category, subcategory, updated_at, is_active,
  blocks_order, accent_color, button_style,
  template_id, template_data
)
SELECT
  id,
  user_id,
  slug,
  COALESCE(plan_id,       'free'),
  COALESCE(theme_id,      'default'),
  name,
  bio,
  COALESCE(is_published,  0),
  COALESCE(created_at,    datetime('now')),
  whatsapp_number,
  avatar_url,
  category,
  subcategory,
  updated_at,
  COALESCE(is_active,     1),
  COALESCE(blocks_order,  '["links","faqs","products","video","gallery"]'),
  COALESCE(accent_color,  '#3B82F6'),
  COALESCE(button_style,  'rounded'),
  template_id,
  COALESCE(template_data, '{}')
FROM profiles;

DROP TABLE profiles;
ALTER TABLE profiles_v23 RENAME TO profiles;

-- Recrear todos los índices de profiles (0017 + 0022)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug        ON profiles (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_unique ON profiles (user_id);
CREATE INDEX        IF NOT EXISTS idx_profiles_user_id     ON profiles (user_id);
CREATE INDEX        IF NOT EXISTS idx_profiles_active      ON profiles (is_active, is_published);
CREATE INDEX        IF NOT EXISTS idx_profiles_template    ON profiles (template_id) WHERE template_id IS NOT NULL;

-- ── 5. Nuevas columnas en profile_modules ────────────────────────────────────
-- Mismo patrón rename-table one-time. Las columnas nuevas (assigned_by,
-- assignment_reason) quedan NULL. Misma limitación que sección 4:
-- incluirlas en el SELECT fallaría en first-run.

DROP TABLE IF EXISTS profile_modules_v23;

CREATE TABLE profile_modules_v23 (
  profile_id         TEXT NOT NULL,
  module_code        TEXT NOT NULL,
  expires_at         DATETIME,
  activated_at       DATETIME NOT NULL DEFAULT (datetime('now')),
  assigned_by        TEXT,   -- user_id del admin
  assignment_reason  TEXT,
  PRIMARY KEY (profile_id, module_code),
  FOREIGN KEY (profile_id)   REFERENCES profiles(id)     ON DELETE CASCADE,
  FOREIGN KEY (module_code)  REFERENCES modules(code)
);

INSERT OR IGNORE INTO profile_modules_v23 (
  profile_id, module_code, expires_at
)
SELECT
  profile_id,
  module_code,
  expires_at
FROM profile_modules;

DROP TABLE profile_modules;
ALTER TABLE profile_modules_v23 RENAME TO profile_modules;

PRAGMA foreign_keys = ON;

-- ── 6. Seed: primer superadmin ───────────────────────────────────────────────
-- El user_id se resuelve por email en runtime; este seed es de respaldo manual.
-- Si el usuario aún no existe en DB (primer deploy), este INSERT no tendrá efecto
-- hasta que el admin haga login por primera vez y quede registrado en users.
-- El script de bootstrap en api/src/lib/admin-auth.ts se encarga del upsert real.

-- (no hay seed automático aquí para evitar hardcodear un user_id desconocido)
