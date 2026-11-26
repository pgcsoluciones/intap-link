-- Proposal only; apply to exact Preview D1 after separate approval, never auto-migrate.
CREATE TABLE review_google_search_usage (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 profile_id TEXT NOT NULL,
 ip_hash TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_review_google_search_user ON review_google_search_usage(user_id,created_at);
CREATE INDEX idx_review_google_search_profile ON review_google_search_usage(profile_id,created_at);
CREATE INDEX idx_review_google_search_ip ON review_google_search_usage(ip_hash,created_at);
CREATE INDEX idx_review_google_search_created ON review_google_search_usage(created_at);
