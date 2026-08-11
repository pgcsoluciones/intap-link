-- B2B.2: atomic activation claim marker and SQLite-enforced transitions.
-- The marker exists only inside the claim statement and is deleted on success.
-- Production sequence: 0029. PR #76 has a divergent migration numbering
-- sequence; do not mix that sequence into this branch yet.

CREATE TABLE IF NOT EXISTS artifact_activation_claims (
  id          TEXT PRIMARY KEY,
  intent_hash TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  claim_at    DATETIME NOT NULL
);

CREATE TRIGGER IF NOT EXISTS trg_artifact_activation_claim_before_insert
BEFORE INSERT ON artifact_activation_claims
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artifact_activation_intents i
      JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id
      JOIN intap_artifacts a ON a.id = i.artifact_id
     WHERE i.intent_hash = NEW.intent_hash
       AND i.status = 'active'
       AND i.revoked_at IS NULL
       AND i.expires_at > NEW.claim_at
       AND ac.status = 'active'
       AND (ac.expires_at IS NULL OR ac.expires_at > NEW.claim_at)
       AND a.owner_user_id IS NULL
       AND a.status IN ('available', 'unassigned')
  ) THEN RAISE(ABORT, 'activation claim precondition failed') END;

  SELECT CASE WHEN NEW.profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = NEW.profile_id
       AND p.user_id = NEW.user_id
       AND p.is_active = 1
  ) THEN RAISE(ABORT, 'activation profile is not owned') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_artifact_activation_claim_after_insert
AFTER INSERT ON artifact_activation_claims
BEGIN
  UPDATE intap_artifacts
     SET owner_user_id = NEW.user_id,
         profile_id = NEW.profile_id,
         status = 'activated',
         activated_at = NEW.claim_at,
         updated_at = NEW.claim_at
   WHERE id = (
     SELECT i.artifact_id
       FROM artifact_activation_intents i
      WHERE i.intent_hash = NEW.intent_hash
   )
     AND owner_user_id IS NULL
     AND status IN ('available', 'unassigned');
  SELECT CASE WHEN changes() <> 1
    THEN RAISE(ABORT, 'artifact activation transition failed') END;

  UPDATE artifact_activation_codes
     SET status = 'used', used_at = NEW.claim_at
   WHERE id = (
     SELECT i.activation_code_id
       FROM artifact_activation_intents i
      WHERE i.intent_hash = NEW.intent_hash
   )
     AND status = 'active'
     AND (expires_at IS NULL OR expires_at > NEW.claim_at)
     AND EXISTS (
       SELECT 1 FROM artifact_activation_intents i
       JOIN intap_artifacts a ON a.id = i.artifact_id
        WHERE i.intent_hash = NEW.intent_hash
          AND a.owner_user_id = NEW.user_id
          AND a.status = 'activated'
          AND a.activated_at = NEW.claim_at
     );
  SELECT CASE WHEN changes() <> 1
    THEN RAISE(ABORT, 'activation code transition failed') END;

  UPDATE artifact_activation_intents
     SET status = 'consumed', consumed_at = NEW.claim_at
   WHERE intent_hash = NEW.intent_hash
     AND status = 'active'
     AND revoked_at IS NULL
     AND expires_at > NEW.claim_at
     AND EXISTS (
       SELECT 1 FROM artifact_activation_codes ac
        WHERE ac.id = artifact_activation_intents.activation_code_id
          AND ac.status = 'used'
          AND ac.used_at = NEW.claim_at
     )
     AND EXISTS (
       SELECT 1 FROM intap_artifacts a
        WHERE a.id = artifact_activation_intents.artifact_id
          AND a.owner_user_id = NEW.user_id
          AND a.status = 'activated'
          AND a.activated_at = NEW.claim_at
     );
  SELECT CASE WHEN changes() <> 1
    THEN RAISE(ABORT, 'activation intent transition failed') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artifact_activation_intents i
      JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id
      JOIN intap_artifacts a ON a.id = i.artifact_id
     WHERE i.intent_hash = NEW.intent_hash
       AND i.status = 'consumed'
       AND i.consumed_at = NEW.claim_at
       AND ac.status = 'used'
       AND ac.used_at = NEW.claim_at
       AND a.owner_user_id = NEW.user_id
       AND a.status = 'activated'
       AND a.activated_at = NEW.claim_at
  ) THEN RAISE(ABORT, 'activation claim invariant failed') END;

  DELETE FROM artifact_activation_claims WHERE id = NEW.id;
END;
