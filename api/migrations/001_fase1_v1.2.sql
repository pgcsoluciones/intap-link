-- Migración Fase 1 v1.2 — INTAP LINK
-- Ejecutar con: wrangler d1 execute intap_db --remote --file=api/migrations/001_fase1_v1.2.sql
-- NOTA: Los ALTER TABLE fallarán si la columna ya existe; es esperado y seguro.

-- profiles: columnas extendidas
ALTER TABLE profiles ADD COLUMN name TEXT;
ALTER TABLE profiles ADD COLUMN bio TEXT;
ALTER TABLE profiles ADD COLUMN theme_id TEXT DEFAULT 'classic';
ALTER TABLE profiles ADD COLUMN is_published INTEGER DEFAULT 0;

-- profile_links: columna de tipo (v1.2)
ALTER TABLE profile_links ADD COLUMN type TEXT DEFAULT 'link';

-- Nueva tabla: profile_assets (avatar / banner)
CREATE TABLE IF NOT EXISTS profile_assets (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'avatar',
  asset_key  TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY(profile_id) REFERENCES profiles(id)
);

-- Nueva tabla: templates
CREATE TABLE IF NOT EXISTS templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  preview_url   TEXT,
  required_tool TEXT NULL
);
