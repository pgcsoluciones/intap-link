-- KAWVO LINK · verified credential actions bound to active auth session
ALTER TABLE account_verified_actions ADD COLUMN session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_account_verified_actions_session
ON account_verified_actions(user_id, session_id, purpose, expires_at);
