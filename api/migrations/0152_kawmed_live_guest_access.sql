-- KawMed live guest editor: explicit additive authorization.
-- Does not modify the existing simulate/claim workflow or legacy demo snapshots.
CREATE TABLE IF NOT EXISTS kawmed_demo_live_access (
  invitation_id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(invitation_id) REFERENCES kawmed_demo_invitations(id),
  FOREIGN KEY(medical_profile_id) REFERENCES medical_profiles(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_kawmed_live_profile ON kawmed_demo_live_access(medical_profile_id);
