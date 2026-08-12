-- B2B.3: D1-compatible assertion table for atomic activation claims.
-- Preview sequence: 0030 because Preview already uses 0029 for intents.
-- PR #76 has divergent numbering; do not merge that sequence here yet.
--
-- This migration intentionally contains no programmable SQL hooks or manual
-- transaction statements.
-- The application executes the claim transitions and the assertion insert in a
-- single D1 DB.batch([...]); CHECK(ok = 1) makes a failed invariant a SQL error.

CREATE TABLE IF NOT EXISTS artifact_activation_claim_assertions (
  id          TEXT PRIMARY KEY,
  intent_hash TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  claim_at    DATETIME NOT NULL,
  ok          INTEGER NOT NULL CHECK (ok = 1)
);
