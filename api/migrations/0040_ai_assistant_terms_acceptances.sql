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
