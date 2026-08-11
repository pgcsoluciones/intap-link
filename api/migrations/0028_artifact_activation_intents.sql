-- B2B.1: server-side activation intents.
-- The browser receives only an opaque token. Its SHA-256 hash is persisted.

CREATE TABLE IF NOT EXISTS artifact_activation_intents (
  id                  TEXT PRIMARY KEY,
  intent_hash         TEXT NOT NULL UNIQUE,
  artifact_id         TEXT NOT NULL REFERENCES intap_artifacts(id) ON DELETE CASCADE,
  activation_code_id  TEXT NOT NULL REFERENCES artifact_activation_codes(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'consumed', 'revoked')),
  expires_at          DATETIME NOT NULL,
  consumed_at         DATETIME,
  revoked_at          DATETIME,
  created_at          DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_artifact_activation_intents_artifact
  ON artifact_activation_intents(artifact_id, status);
CREATE INDEX IF NOT EXISTS idx_artifact_activation_intents_code
  ON artifact_activation_intents(activation_code_id, status);
CREATE INDEX IF NOT EXISTS idx_artifact_activation_intents_expiry
  ON artifact_activation_intents(status, expires_at);
