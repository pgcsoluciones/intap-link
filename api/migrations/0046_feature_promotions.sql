-- KAWVO LINK — Promociones de funciones administrables
CREATE TABLE IF NOT EXISTS feature_promotions (
  id TEXT PRIMARY KEY,
  feature_code TEXT NOT NULL,
  name TEXT NOT NULL,
  target_plan TEXT NOT NULL DEFAULT 'free',
  access_mode TEXT NOT NULL DEFAULT 'all' CHECK (access_mode IN ('all','code','profile')),
  promo_code TEXT,
  profile_id TEXT,
  starts_at DATETIME NOT NULL DEFAULT (datetime('now')),
  ends_at DATETIME,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  created_by_user_id TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_promotions_active
ON feature_promotions(feature_code, target_plan, is_enabled, starts_at, ends_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_promotions_code
ON feature_promotions(promo_code)
WHERE promo_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS feature_promotion_redemptions (
  promotion_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  redeemed_at DATETIME NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (promotion_id, profile_id),
  FOREIGN KEY (promotion_id) REFERENCES feature_promotions(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Cuentas bancarias disponibles para Free hasta nuevo aviso.
INSERT OR IGNORE INTO feature_promotions
  (id, feature_code, name, target_plan, access_mode, starts_at, ends_at, is_enabled)
VALUES
  ('promo-bank-accounts-free-open', 'bank_accounts', 'Cuentas bancarias Free · hasta nuevo aviso', 'free', 'all', datetime('now'), NULL, 1);
