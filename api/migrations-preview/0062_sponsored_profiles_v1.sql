-- Preview mirror of 0062_sponsored_profiles_v1.sql

CREATE TABLE IF NOT EXISTS sponsor_tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sponsor_type TEXT NOT NULL DEFAULT 'merchant' CHECK (sponsor_type IN ('merchant','brand')),
  logo_url TEXT,
  contact_email TEXT,
  contact_whatsapp TEXT,
  website_url TEXT,
  banner_title TEXT NOT NULL DEFAULT 'Impulsado por',
  banner_image_url TEXT,
  banner_cta_label TEXT NOT NULL DEFAULT 'Conocer más',
  banner_cta_type TEXT NOT NULL DEFAULT 'beneficiary_whatsapp' CHECK (banner_cta_type IN ('beneficiary_whatsapp','sponsor_whatsapp','sponsor_url','none')),
  banner_cta_value TEXT,
  whatsapp_message_template TEXT NOT NULL DEFAULT 'Hola, me interesa saber más sobre estos productos.',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by_admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sponsor_members (sponsor_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','viewer')),status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),created_at TEXT NOT NULL DEFAULT (datetime('now')),PRIMARY KEY (sponsor_id,user_id),FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS sponsor_batches (id TEXT PRIMARY KEY,sponsor_id TEXT NOT NULL,name TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 0,city TEXT,zone TEXT,notes TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS sponsored_profiles (id TEXT PRIMARY KEY,sponsor_id TEXT NOT NULL,artifact_id TEXT UNIQUE,user_id TEXT,username TEXT UNIQUE,business_name TEXT,specialization TEXT,what_we_do TEXT,avatar_url TEXT,show_avatar INTEGER NOT NULL DEFAULT 1 CHECK (show_avatar IN (0,1)),cover_variant TEXT NOT NULL DEFAULT 'standard',phone TEXT,whatsapp TEXT,instagram TEXT,address TEXT,schedule_json TEXT NOT NULL DEFAULT '[]',gallery_json TEXT NOT NULL DEFAULT '[]',gallery_title TEXT NOT NULL DEFAULT 'Catálogo',palette_id TEXT NOT NULL DEFAULT 'blue',status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','suspended')),modules_json TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),published_at TEXT,FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS sponsor_artifacts (sponsor_id TEXT NOT NULL,artifact_id TEXT NOT NULL UNIQUE,batch_id TEXT,sponsored_profile_id TEXT,beneficiary_user_id TEXT,status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','activated','inactive')),activated_at TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),PRIMARY KEY (sponsor_id,artifact_id),FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE,FOREIGN KEY (batch_id) REFERENCES sponsor_batches(id) ON DELETE SET NULL,FOREIGN KEY (sponsored_profile_id) REFERENCES sponsored_profiles(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS sponsor_module_grants (sponsor_id TEXT NOT NULL,module_code TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),PRIMARY KEY (sponsor_id,module_code),FOREIGN KEY (sponsor_id) REFERENCES sponsor_tenants(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_sponsor_artifacts_sponsor ON sponsor_artifacts(sponsor_id,status);
CREATE INDEX IF NOT EXISTS idx_sponsored_profiles_sponsor ON sponsored_profiles(sponsor_id,status);
CREATE INDEX IF NOT EXISTS idx_sponsored_profiles_user ON sponsored_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_batches_sponsor ON sponsor_batches(sponsor_id,created_at);
