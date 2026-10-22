-- KawMed V1 — perfiles médicos públicos
CREATE TABLE IF NOT EXISTS medical_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  professional_prefix TEXT,
  specialty TEXT NOT NULL,
  subspecialty TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'República Dominicana',
  organization TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medical_profile_centers (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'República Dominicana',
  phone TEXT,
  map_url TEXT,
  latitude REAL,
  longitude REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_profile_schedules (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  center_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  shift TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES medical_profile_centers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_profile_services (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medical_profiles_slug_status ON medical_profiles(slug, status);
CREATE INDEX IF NOT EXISTS idx_medical_centers_profile ON medical_profile_centers(medical_profile_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_medical_schedules_profile_center ON medical_profile_schedules(medical_profile_id, center_id, active, day_of_week, sort_order);
CREATE INDEX IF NOT EXISTS idx_medical_services_profile ON medical_profile_services(medical_profile_id, active, sort_order);

-- Producción: solo esquema. Ningún paciente, profesional o centro ficticio.
