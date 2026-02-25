-- 0008_waitlist.sql
-- Lista de espera para el lanzamiento de Intap Link.
-- Idempotente: unique index en email y whatsapp previene duplicados.

CREATE TABLE IF NOT EXISTS waitlist (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  whatsapp   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email
  ON waitlist (email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_whatsapp
  ON waitlist (whatsapp);
