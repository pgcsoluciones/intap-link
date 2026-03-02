-- Migración: Etapa 3 - Panel y Gestión de Leads 
-- Solución Segura/Idempotente para evitar errores de columnas duplicadas en D1 (SQLite)

-- 1. Crear tabla temporal con el esquema FINAL (original + nuevas columnas)
CREATE TABLE IF NOT EXISTS new_leads (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    source_url TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT DEFAULT 'new',
    origin TEXT DEFAULT 'form',
    tags TEXT DEFAULT '[]',
    FOREIGN KEY(profile_id) REFERENCES profiles(id)
);

-- 2. Migrar la data preservando lo existente
INSERT INTO new_leads (id, profile_id, name, email, phone, message, source_url, user_agent, ip_hash, created_at)
SELECT id, profile_id, name, email, phone, message, source_url, user_agent, ip_hash, created_at
FROM leads;

-- 3. Eliminar la tabla original
DROP TABLE leads;

-- 4. Renombrar la nueva tabla al nombre oficial
ALTER TABLE new_leads RENAME TO leads;

-- 5. Crear índices (mejorar el rendimiento por origin/status en paneles de admin)
CREATE INDEX IF NOT EXISTS idx_leads_profile_status ON leads(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(profile_id, created_at DESC);
