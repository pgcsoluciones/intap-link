-- 0029_profile_contact_location.sql
-- Ubicación estructurada para perfiles INTAP LINK.
--
-- Conserva address y map_url para compatibilidad
-- con los perfiles Premium y públicos existentes.

ALTER TABLE profile_contact
ADD COLUMN place_name TEXT;

ALTER TABLE profile_contact
ADD COLUMN latitude REAL;

ALTER TABLE profile_contact
ADD COLUMN longitude REAL;

-- Control básico de frecuencia para el buscador
-- de ubicaciones del onboarding Gratis.
CREATE TABLE IF NOT EXISTS location_search_rate_limits (
  profile_id TEXT PRIMARY KEY,
  last_request_at INTEGER NOT NULL,
  updated_at DATETIME NOT NULL
    DEFAULT (datetime('now'))
);
