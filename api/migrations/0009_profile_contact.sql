-- 0009_profile_contact.sql
-- Datos de contacto enriquecidos por perfil (WhatsApp, email, teléfono, horario, dirección, mapa).
-- En producción la tabla fue creada por consola; esta migración es para nuevos entornos.

CREATE TABLE IF NOT EXISTS profile_contact (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  whatsapp   TEXT,
  email      TEXT,
  phone      TEXT,
  hours      TEXT,
  address    TEXT,
  map_url    TEXT
);
