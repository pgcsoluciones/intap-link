-- Additive private commercial settings. Preview only after backup and explicit approval.
CREATE TABLE sponsor_commercial_contact_settings (
 sponsor_id TEXT PRIMARY KEY REFERENCES sponsor_tenants(id) ON DELETE CASCADE,
 message_template TEXT NOT NULL CHECK(length(trim(message_template)) BETWEEN 1 AND 400),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
