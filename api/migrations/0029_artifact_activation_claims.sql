-- B2B.3A: persistent one-time activation claim receipts.
-- Production sequence: 0029. PR #76 has divergent numbering;
-- do not mix that sequence into this branch yet.
--
-- No triggers or manual transaction statements are used. The API performs
-- three guarded UPDATEs followed by this receipt INSERT in one D1 batch.
-- The CHECK makes a failed final-state assertion a SQL error; the primary key
-- makes every activation intent claimable exactly once.

CREATE TABLE IF NOT EXISTS artifact_activation_claims (
  intent_hash TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  claim_at    DATETIME NOT NULL,
  ok          INTEGER NOT NULL CHECK (ok = 1)
);
