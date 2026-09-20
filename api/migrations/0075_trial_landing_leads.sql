-- KawLink Trial Landing Lead Bridge
CREATE TABLE IF NOT EXISTS trial_leads (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  sector TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'kawvo_trial_landing',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  landing_variant TEXT,
  referrer TEXT,
  page_url TEXT,
  campaign_id TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','linked','expired','cancelled')),
  linked_user_id TEXT,
  trial_id TEXT,
  consumed_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trial_leads_email ON trial_leads(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_leads_phone ON trial_leads(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_leads_status ON trial_leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_leads_trial ON trial_leads(trial_id);
