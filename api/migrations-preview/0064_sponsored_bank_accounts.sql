-- Preview mirror of 0064_sponsored_bank_accounts.sql

CREATE TABLE IF NOT EXISTS sponsored_bank_accounts (
  id TEXT PRIMARY KEY,
  sponsored_profile_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'savings' CHECK (account_type IN ('savings','checking')),
  currency TEXT NOT NULL DEFAULT 'DOP' CHECK (currency IN ('DOP','USD')),
  holder_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sponsored_profile_id) REFERENCES sponsored_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sponsored_bank_accounts_profile
  ON sponsored_bank_accounts(sponsored_profile_id, sort_order, created_at);
