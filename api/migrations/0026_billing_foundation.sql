-- 0026_billing_foundation.sql
-- Base SaaS Billing para INTAP LINK.
-- Inspirada en patrones de AlcanciApp, adaptada a profiles/users/plans/admin_audit_log de INTAP.
-- No modifica perfiles, planes, módulos ni entitlements existentes.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Suscripciones SaaS por perfil
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'active',
      'past_due',
      'suspended',
      'cancelled',
      'expired'
    )),

  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual',
      'gateway',
      'admin_grant',
      'trial',
      'system'
    )),

  starts_at DATETIME,
  current_period_start DATETIME,
  current_period_end DATETIME,

  cancelled_at DATETIME,
  suspended_at DATETIME,
  deactivation_reason TEXT,

  external_customer_id TEXT,
  external_subscription_id TEXT,

  notes TEXT,
  created_by_admin_id TEXT,

  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_profile
  ON billing_subscriptions(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user
  ON billing_subscriptions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
  ON billing_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_plan
  ON billing_subscriptions(plan_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pagos SaaS / pagos manuales
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  subscription_id TEXT,
  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT,

  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'DOP',

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'proof_submitted',
      'under_review',
      'confirmed',
      'rejected',
      'refunded',
      'cancelled',
      'expired'
    )),

  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual',
      'gateway',
      'payment_link'
    )),

  provider TEXT,
  payment_method_code TEXT,

  external_reference TEXT,
  admin_reference TEXT,

  proof_url TEXT,
  proof_asset_id TEXT,

  source_bank_name TEXT,
  customer_reference_text TEXT,

  transferred_at DATETIME,
  submitted_at DATETIME,
  reviewed_at DATETIME,
  confirmed_at DATETIME,
  rejected_at DATETIME,

  reviewed_by_admin_id TEXT,
  rejection_reason TEXT,
  internal_notes TEXT,
  metadata_json TEXT,

  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_profile
  ON billing_payments(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription
  ON billing_payments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_billing_payments_status
  ON billing_payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_payments_reference
  ON billing_payments(external_reference);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Configuración futura de pasarelas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_gateway_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  provider TEXT NOT NULL
    CHECK (provider IN (
      'paypal',
      'azul',
      'cardnet',
      'stripe',
      'intap_payment_link'
    )),

  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN (
      'disabled',
      'test',
      'ready',
      'active'
    )),

  display_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'DOP',

  public_config_json TEXT,

  -- No guardar secretos reales aquí.
  -- Usar secret_ref para apuntar a variables seguras del entorno.
  secret_ref TEXT,

  webhook_url TEXT,
  notes TEXT,

  created_by_admin_id TEXT,
  updated_by_admin_id TEXT,

  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_gateway_configs_provider
  ON billing_gateway_configs(provider);

CREATE INDEX IF NOT EXISTS idx_billing_gateway_configs_status
  ON billing_gateway_configs(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Seeds mínimos de pasarelas deshabilitadas
-- ─────────────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO billing_gateway_configs (
  provider,
  status,
  display_name,
  currency,
  public_config_json,
  notes
) VALUES
  ('paypal', 'disabled', 'PayPal', 'USD', '{}', 'Preparado para integración futura.'),
  ('azul', 'disabled', 'Azul', 'DOP', '{}', 'Preparado para integración futura.'),
  ('cardnet', 'disabled', 'CardNet', 'DOP', '{}', 'Preparado para integración futura.'),
  ('stripe', 'disabled', 'Stripe', 'USD', '{}', 'Preparado para integración futura.'),
  ('intap_payment_link', 'disabled', 'INTAP Payment Link', 'DOP', '{}', 'Enlace de pago propio futuro.');
