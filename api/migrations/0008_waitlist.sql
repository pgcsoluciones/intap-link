-- 0008_waitlist.sql
-- Tabla waitlist con campos extendidos: name, sector, mode
-- NOTA: En producción la tabla base y las columnas nuevas fueron agregadas manualmente.
--       Esta migración representa el schema completo para nuevos entornos.

CREATE TABLE IF NOT EXISTS waitlist (
  id         TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email      TEXT    UNIQUE NOT NULL,
  whatsapp   TEXT,
  name       TEXT,
  sector     TEXT,
  mode       TEXT    CHECK(mode IN ('Virtual', 'Fisica', 'Mixta')),
  position   INTEGER,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist (email);
