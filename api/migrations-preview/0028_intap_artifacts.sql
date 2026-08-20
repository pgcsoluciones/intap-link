-- B2: mismo esquema de artefactos para D1 Preview.
-- No contiene datos de Producción ni códigos reales.

CREATE TABLE IF NOT EXISTS intap_artifacts (
  id              TEXT PRIMARY KEY,
  public_code     TEXT NOT NULL UNIQUE,
  product_type    TEXT NOT NULL DEFAULT 'other'
                    CHECK (product_type IN ('card', 'ping', 'bracelet', 'keychain', 'stand', 'qr', 'other')),
  status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('unassigned', 'available', 'activated', 'suspended', 'revoked')),
  owner_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  profile_id      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  activated_at    DATETIME,
  created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artifact_activation_codes (
  id                  TEXT PRIMARY KEY,
  artifact_id         TEXT NOT NULL REFERENCES intap_artifacts(id) ON DELETE CASCADE,
  activation_code_hash TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'used', 'revoked')),
  expires_at          DATETIME,
  used_at             DATETIME,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  last_attempt_at     DATETIME,
  created_at          DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intap_artifacts_owner
  ON intap_artifacts(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_intap_artifacts_profile
  ON intap_artifacts(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_intap_artifacts_status
  ON intap_artifacts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_artifact_activation_codes_artifact
  ON artifact_activation_codes(artifact_id, status);
CREATE INDEX IF NOT EXISTS idx_artifact_activation_codes_attempts
  ON artifact_activation_codes(last_attempt_at);
