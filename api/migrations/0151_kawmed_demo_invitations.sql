-- KawMed isolated invitation sandbox; no changes to Link identities or real medical profiles.
CREATE TABLE IF NOT EXISTS kawmed_demo_invitations (
 id TEXT PRIMARY KEY,
 owner_user_id TEXT NOT NULL,
 source_medical_profile_id TEXT NOT NULL,
 invited_email TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','revoked','expired')),
 expires_at TEXT NOT NULL,
 accepted_user_id TEXT,
 accepted_at TEXT,
 sandbox_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 FOREIGN KEY(owner_user_id) REFERENCES users(id),
 FOREIGN KEY(source_medical_profile_id) REFERENCES medical_profiles(id),
 FOREIGN KEY(accepted_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_kawmed_demo_email ON kawmed_demo_invitations(invited_email,expires_at);
CREATE INDEX IF NOT EXISTS idx_kawmed_demo_owner ON kawmed_demo_invitations(owner_user_id,created_at);
