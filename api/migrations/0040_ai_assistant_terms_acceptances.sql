-- Versioned acceptance records for Kawvo AI Assistant specific terms.
-- Stores only consent metadata, never prompt/answer/model content.
CREATE TABLE IF NOT EXISTS ai_assistant_terms_acceptances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  locale TEXT NOT NULL DEFAULT 'es-DO',
  source TEXT NOT NULL DEFAULT 'assistant_ui'
);

CREATE INDEX IF NOT EXISTS idx_ai_terms_user_version
  ON ai_assistant_terms_acceptances (user_id, terms_version, accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_terms_user_created
  ON ai_assistant_terms_acceptances (user_id, accepted_at DESC);

-- Product/security control distinct from normal quota exhaustion.
-- No row means normal access. A suspended row can be temporary or indefinite.
CREATE TABLE IF NOT EXISTS ai_assistant_access_controls (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('allowed', 'suspended')),
  reason_code TEXT,
  expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_access_status_expires
  ON ai_assistant_access_controls (status, expires_at);
