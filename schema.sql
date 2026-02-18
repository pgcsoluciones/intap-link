-- Tablas de Control (Catálogo)
CREATE TABLE plans (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE plan_limits (plan_id TEXT PRIMARY KEY, max_links INTEGER, max_photos INTEGER, max_faqs INTEGER, can_use_vcard BOOLEAN, FOREIGN KEY(plan_id) REFERENCES plans(id));
CREATE TABLE modules (code TEXT PRIMARY KEY, name TEXT, effects_json TEXT);

-- Tablas de Usuario y Contenido
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, is_admin BOOLEAN DEFAULT 0);
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  slug TEXT UNIQUE,
  plan_id TEXT,
  theme_id TEXT DEFAULT 'classic',
  is_published BOOLEAN DEFAULT 0,
  name TEXT,
  bio TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE profile_links (id TEXT PRIMARY KEY, profile_id TEXT, label TEXT, url TEXT, sort_order INTEGER);
CREATE TABLE profile_faqs (id TEXT PRIMARY KEY, profile_id TEXT, question TEXT, answer TEXT);
CREATE TABLE profile_modules (profile_id TEXT, module_code TEXT, expires_at DATETIME, PRIMARY KEY(profile_id, module_code));
CREATE TABLE profile_gallery (id TEXT PRIMARY KEY, profile_id TEXT, image_key TEXT, sort_order INTEGER DEFAULT 0);
CREATE TABLE analytics (id TEXT PRIMARY KEY, profile_id TEXT, event_type TEXT, target_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);

-- Tabla para códigos de Magic Link (OTP temporal, TTL: 15 min)
CREATE TABLE auth_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL
);
