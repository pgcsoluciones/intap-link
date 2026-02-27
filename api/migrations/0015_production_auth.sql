-- 0015_production_auth.sql
-- Objetivo: tablas necesarias para auth producción (magic link, sesiones, identidades OAuth).
-- Idempotente: usa CREATE TABLE IF NOT EXISTS.
PRAGMA foreign_keys = ON;
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Magic Links (one-time use, 10 min TTL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_magic_links (
  id            TEXT     PRIMARY KEY,
  email         TEXT     NOT NULL,
  token_hash    TEXT     NOT NULL UNIQUE,
  expires_at    DATETIME NOT NULL,
  used_at       DATETIME,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  requested_ip  TEXT,
  user_agent    TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sesiones (30 días, multi-device, revocables)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_sessions (
  id            TEXT     PRIMARY KEY,
  user_id       TEXT     NOT NULL REFERENCES users(id),
  session_hash  TEXT     NOT NULL UNIQUE,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  expires_at    DATETIME NOT NULL,
  revoked_at    DATETIME,
  last_seen_at  DATETIME,
  ip            TEXT,
  user_agent    TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Identidades OAuth (Google, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_identities (
  id               TEXT     PRIMARY KEY,
  user_id          TEXT     NOT NULL REFERENCES users(id),
  provider         TEXT     NOT NULL,
  provider_user_id TEXT     NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Índices de performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auth_magic_links_token   ON auth_magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_magic_links_email   ON auth_magic_links(email, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_hash       ON auth_sessions(session_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user       ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider ON auth_identities(provider, provider_user_id);

COMMIT;
