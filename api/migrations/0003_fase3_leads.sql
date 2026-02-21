-- 0003_fase3_leads.sql

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  source_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_slug_created ON leads(profile_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_ip_created ON leads(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS lead_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_slug TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rl_slug_ip_created ON lead_rate_limits(profile_slug, ip_hash, created_at);
