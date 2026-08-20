-- KAWVO LINK · Support ticket timeline and response channels

ALTER TABLE support_tickets ADD COLUMN response_channel TEXT;
ALTER TABLE support_tickets ADD COLUMN responded_at TEXT;

CREATE TABLE IF NOT EXISTS support_ticket_events (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status_key TEXT NOT NULL,
  message TEXT,
  channel TEXT,
  actor_type TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket
  ON support_ticket_events(ticket_id, created_at ASC);
