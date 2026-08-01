-- INTAP LINK Preview baseline through 0029
-- Generated from the verified migration chain; never apply to intap_db production.
PRAGMA defer_foreign_keys = true;

CREATE TABLE admin_audit_log (
  id             TEXT NOT NULL PRIMARY KEY
                   DEFAULT (lower(hex(randomblob(8)))),
  admin_user_id  TEXT NOT NULL,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  before_json    TEXT,
  after_json     TEXT,
  ip             TEXT,
  created_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE admin_users (
  user_id      TEXT NOT NULL PRIMARY KEY,
  role         TEXT NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('super_admin', 'support', 'viewer')),
  granted_by   TEXT,
  granted_at   DATETIME NOT NULL DEFAULT (datetime('now')),
  notes        TEXT
);
CREATE TABLE analytics (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_id  TEXT,
  ip_hash    TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE TABLE auth_identities (
  id               TEXT     PRIMARY KEY,
  user_id          TEXT     NOT NULL REFERENCES users(id),
  provider         TEXT     NOT NULL,
  provider_user_id TEXT     NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id)
);
CREATE TABLE auth_magic_links (
  id            TEXT     PRIMARY KEY,
  email         TEXT     NOT NULL,
  token_hash    TEXT     NOT NULL UNIQUE,
  expires_at    DATETIME NOT NULL,
  used_at       DATETIME,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  requested_ip  TEXT,
  user_agent    TEXT
);
CREATE TABLE auth_otp (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE auth_sessions (
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
CREATE TABLE billing_gateway_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  provider TEXT NOT NULL
    CHECK (provider IN (
      'paypal',
      'azul',
      'cardnet',
      'stripe',
      'intap_payment_link'
    )),

  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN (
      'disabled',
      'test',
      'ready',
      'active'
    )),

  display_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'DOP',

  public_config_json TEXT,

  -- No guardar secretos reales aquí.
  -- Usar secret_ref para apuntar a variables seguras del entorno.
  secret_ref TEXT,

  webhook_url TEXT,
  notes TEXT,

  created_by_admin_id TEXT,
  updated_by_admin_id TEXT,

  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE billing_payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  subscription_id TEXT,
  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT,

  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'DOP',

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'proof_submitted',
      'under_review',
      'confirmed',
      'rejected',
      'refunded',
      'cancelled',
      'expired'
    )),

  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual',
      'gateway',
      'payment_link'
    )),

  provider TEXT,
  payment_method_code TEXT,

  external_reference TEXT,
  admin_reference TEXT,

  proof_url TEXT,
  proof_asset_id TEXT,

  source_bank_name TEXT,
  customer_reference_text TEXT,

  transferred_at DATETIME,
  submitted_at DATETIME,
  reviewed_at DATETIME,
  confirmed_at DATETIME,
  rejected_at DATETIME,

  reviewed_by_admin_id TEXT,
  rejection_reason TEXT,
  internal_notes TEXT,
  metadata_json TEXT,

  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE billing_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'active',
      'past_due',
      'suspended',
      'cancelled',
      'expired'
    )),

  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual',
      'gateway',
      'admin_grant',
      'trial',
      'system'
    )),

  starts_at DATETIME,
  current_period_start DATETIME,
  current_period_end DATETIME,

  cancelled_at DATETIME,
  suspended_at DATETIME,
  deactivation_reason TEXT,

  external_customer_id TEXT,
  external_subscription_id TEXT,

  notes TEXT,
  created_by_admin_id TEXT,

  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE lead_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_slug TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  source_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, status TEXT NOT NULL DEFAULT 'new', origin TEXT, tags TEXT NOT NULL DEFAULT '[]');
CREATE TABLE location_search_rate_limits (
  profile_id TEXT PRIMARY KEY,
  last_request_at INTEGER NOT NULL,
  updated_at DATETIME NOT NULL
    DEFAULT (datetime('now'))
);
CREATE TABLE magic_link_codes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE modules (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  effects_json TEXT NOT NULL DEFAULT '{}'
, is_active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE plan_limits (
  plan_id      TEXT PRIMARY KEY,
  max_links    INTEGER NOT NULL DEFAULT 5,
  max_photos   INTEGER NOT NULL DEFAULT 3,
  max_faqs     INTEGER NOT NULL DEFAULT 3,
  can_use_vcard BOOLEAN NOT NULL DEFAULT 0, max_products INTEGER NOT NULL DEFAULT 3, max_videos INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);
CREATE TABLE plans (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE "profile_contact" (
  profile_id TEXT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  whatsapp   TEXT,
  email      TEXT,
  phone      TEXT,
  hours      TEXT,
  address    TEXT,
  map_url    TEXT,
  updated_at DATETIME
, place_name TEXT, latitude REAL, longitude REAL);
CREATE TABLE profile_faqs (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE TABLE profile_gallery (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  image_key  TEXT NOT NULL,
  alt_text   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE TABLE "profile_links" (
  id         TEXT     PRIMARY KEY,
  profile_id TEXT     NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  label      TEXT     NOT NULL,
  url        TEXT     NOT NULL,
  sort_order INTEGER  NOT NULL DEFAULT 0,
  is_active  INTEGER  NOT NULL DEFAULT 1,
  updated_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
, is_cta INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "profile_modules" (
  profile_id         TEXT NOT NULL,
  module_code        TEXT NOT NULL,
  expires_at         DATETIME,
  activated_at       DATETIME NOT NULL DEFAULT (datetime('now')),
  assigned_by        TEXT,   -- user_id del admin
  assignment_reason  TEXT,
  PRIMARY KEY (profile_id, module_code),
  FOREIGN KEY (profile_id)   REFERENCES profiles(id)     ON DELETE CASCADE,
  FOREIGN KEY (module_code)  REFERENCES modules(code)
);
CREATE TABLE profile_plan_events (
  id           TEXT     NOT NULL PRIMARY KEY
                          DEFAULT (lower(hex(randomblob(8)))),
  profile_id   TEXT     NOT NULL,
  event_type   TEXT     NOT NULL
                 CHECK (event_type IN (
                   'trial_expired', 'module_expired', 'override_expired',
                   'downgrade', 'retention_selection', 'item_reactivated'
                 )),
  triggered_by TEXT,            -- user_id del usuario; NULL = evento del sistema
  event_data   TEXT,            -- JSON con detalles del evento
  created_at   DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE profile_plan_overrides (
  profile_id        TEXT NOT NULL PRIMARY KEY,
  max_links         INTEGER,
  max_photos        INTEGER,
  max_faqs          INTEGER,
  max_products      INTEGER,
  max_videos        INTEGER,
  can_use_vcard     INTEGER,          -- NULL=no override; 0=force off; 1=force on
  trial_plan_id     TEXT,             -- plan_id a aplicar durante el trial
  trial_ends_at     DATETIME,
  override_reason   TEXT,
  overridden_by     TEXT NOT NULL,    -- user_id del admin que hizo el override
  overridden_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE profile_products (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  price TEXT,
  image_url TEXT,
  whatsapp_text TEXT,
  is_featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE profile_social_links (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,     -- 'instagram' | 'tiktok' | 'email'
  url        TEXT NOT NULL,     -- https://... o mailto:...
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled    INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE profile_videos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE "profiles" (
  id                  TEXT     PRIMARY KEY,
  user_id             TEXT     NOT NULL,
  slug                TEXT     UNIQUE NOT NULL,
  plan_id             TEXT     NOT NULL DEFAULT 'free',
  theme_id            TEXT     NOT NULL DEFAULT 'default',
  name                TEXT,
  bio                 TEXT,
  is_published        INTEGER  NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
  whatsapp_number     TEXT,
  avatar_url          TEXT,
  category            TEXT,
  subcategory         TEXT,
  updated_at          DATETIME,
  is_active           INTEGER  NOT NULL DEFAULT 1,
  blocks_order        TEXT     DEFAULT '["links","faqs","products","video","gallery"]',
  accent_color        TEXT     DEFAULT '#3B82F6',
  button_style        TEXT     DEFAULT 'rounded',
  template_id         TEXT,
  template_data       TEXT     NOT NULL DEFAULT '{}',
  -- columnas 0023 (admin)
  trial_ends_at       DATETIME,
  deactivation_reason TEXT,
  admin_notes         TEXT
, layout_id TEXT NOT NULL DEFAULT 'esencial'
CHECK (
  layout_id IN (
    'impacto',
    'personal',
    'esencial'
  )
));
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE waitlist (
  id         TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email      TEXT    UNIQUE NOT NULL,
  whatsapp   TEXT,
  name       TEXT,
  sector     TEXT,
  mode       TEXT    CHECK(mode IN ('Virtual', 'Fisica', 'Mixta')),
  position   INTEGER,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "billing_gateway_configs" VALUES('e82046e7e7ec1fb169af8e36ce60155a','paypal','disabled','PayPal','USD','{}',NULL,NULL,'Preparado para integración futura.',NULL,NULL,'2026-08-01 00:33:47','2026-08-01 00:33:47');
INSERT INTO "billing_gateway_configs" VALUES('2632235bbc2ef4d90093b9726238c5da','azul','disabled','Azul','DOP','{}',NULL,NULL,'Preparado para integración futura.',NULL,NULL,'2026-08-01 00:33:47','2026-08-01 00:33:47');
INSERT INTO "billing_gateway_configs" VALUES('74a32dbec9554c16f82115f23515e752','cardnet','disabled','CardNet','DOP','{}',NULL,NULL,'Preparado para integración futura.',NULL,NULL,'2026-08-01 00:33:47','2026-08-01 00:33:47');
INSERT INTO "billing_gateway_configs" VALUES('26d2f823d76bba5911a51acfb054942a','stripe','disabled','Stripe','USD','{}',NULL,NULL,'Preparado para integración futura.',NULL,NULL,'2026-08-01 00:33:47','2026-08-01 00:33:47');
INSERT INTO "billing_gateway_configs" VALUES('84763cce59f1d92315e0d33f8fb7a6de','intap_payment_link','disabled','INTAP Payment Link','DOP','{}',NULL,NULL,'Enlace de pago propio futuro.',NULL,NULL,'2026-08-01 00:33:47','2026-08-01 00:33:47');
INSERT INTO "modules" VALUES('extra_links','Pack Extra Links','{"extraLinks": 5}',1);
INSERT INTO "modules" VALUES('extra_photos','Pack Extra Fotos','{"extraPhotos": 5}',1);
INSERT INTO "modules" VALUES('extra_faqs','Pack Extra FAQs','{"extraFaqs": 5}',1);
INSERT INTO "modules" VALUES('vcard_unlock','Desbloquear vCard','{"unlockVCard": true}',1);
INSERT INTO "modules" VALUES('power_pack','Power Pack','{"extraLinks": 10, "extraPhotos": 10, "extraFaqs": 10, "unlockVCard": true}',1);
INSERT INTO "modules" VALUES('links_plus','Links Plus','{"extraLinks":100}',1);
INSERT INTO "modules" VALUES('gallery_plus','Gallery Plus','{"extraPhotos":50}',1);
INSERT INTO "modules" VALUES('faq_plus','FAQ Plus','{"extraFaqs":20}',1);
INSERT INTO "modules" VALUES('vcard','vCard','{"unlockVCard":true}',1);
INSERT INTO "modules" VALUES('map','Mapa','{"enable_features":["map"]}',1);
INSERT INTO "modules" VALUES('form_contact','Formulario','{"enable_features":["form_contact"]}',1);
INSERT INTO "plan_limits" VALUES('free',3,5,0,0,3,1);
INSERT INTO "plan_limits" VALUES('starter',8,3,5,0,8,3);
INSERT INTO "plan_limits" VALUES('pro',20,10,15,1,25,10);
INSERT INTO "plan_limits" VALUES('agency',50,30,30,1,50,30);
INSERT INTO "plan_limits" VALUES('basic',5,5,3,0,3,1);
INSERT INTO "plans" VALUES('free','Free');
INSERT INTO "plans" VALUES('starter','Starter');
INSERT INTO "plans" VALUES('pro','Pro');
INSERT INTO "plans" VALUES('agency','Agency');
INSERT INTO "plans" VALUES('basic','Básico');
INSERT INTO "profile_contact" VALUES('profile-juan-demo','+1809XXXXXXX','correo@ejemplo.com','+1809XXXXXXX','Lun–Vie 9:00am–6:00pm','Santo Domingo, RD','https://www.google.com/maps?q=Santo+Domingo',NULL,NULL,NULL,NULL);
INSERT INTO "profile_faqs" VALUES('faq-juan-1','profile-juan-demo','¿Cuánto tiempo lleva un proyecto?','Depende del alcance, pero la mayoría de proyectos los entregamos en 2 a 4 semanas desde el inicio.',0);
INSERT INTO "profile_faqs" VALUES('faq-juan-2','profile-juan-demo','¿Trabajás con clientes de todo el país?','Sí, trabajo de forma remota con clientes en toda Argentina y Latinoamérica sin costo extra.',1);
INSERT INTO "profile_faqs" VALUES('faq-juan-3','profile-juan-demo','¿Qué formas de pago aceptás?','Acepto transferencia bancaria, Mercado Pago y divisas (USD/EUR). Consultá disponibilidad.',2);
INSERT INTO "profile_faqs" VALUES('faq-demo-1','profile-juan-demo','¿Cómo hago un pedido?','Escríbeme por WhatsApp y te guío paso a paso.',1);
INSERT INTO "profile_faqs" VALUES('faq-demo-2','profile-juan-demo','¿En cuánto tiempo entregan?','Depende del servicio, normalmente entre 24 y 72 horas.',2);
INSERT INTO "profile_faqs" VALUES('faq-demo-3','profile-juan-demo','¿Qué métodos de pago aceptan?','Transferencia, efectivo o tarjeta (según el caso).',3);
INSERT INTO "profile_links" VALUES('link-1','profile-juan-demo','Mi Instagram','https://instagram.com/juan',1,1,NULL,'2026-08-01 00:33:47',0);
INSERT INTO "profile_links" VALUES('l1','profile-juan-demo','LinkedIn Profesional','https://linkedin.com/in/juanluis',2,1,NULL,'2026-08-01 00:33:47',0);
INSERT INTO "profile_links" VALUES('link-2','profile-juan-demo','LinkedIn Profesional','https://linkedin.com/in/juan',3,1,NULL,'2026-08-01 00:33:47',0);
INSERT INTO "profile_links" VALUES('l2','profile-juan-demo','Instagram Personal','https://instagram.com/juanluis',4,1,NULL,'2026-08-01 00:33:47',0);
INSERT INTO "profile_links" VALUES('link_map_juan','profile-juan-demo','Cómo llegar','https://www.google.com/maps?q=Santo+Domingo',5,1,NULL,'2026-08-01 00:33:47',0);
INSERT INTO "profile_links" VALUES('link-3','profile-juan-demo','Mi Portafolio','https://juan.dev',6,1,NULL,'2026-08-01 00:33:47',0);
INSERT INTO "profile_links" VALUES('l3','profile-juan-demo','WhatsApp Directo','https://wa.me/123456789',7,1,NULL,'2026-08-01 00:33:47',0);
INSERT INTO "profile_modules" VALUES('profile-juan-demo','links_plus','2027-08-01 00:33:47','2026-08-01 00:33:47',NULL,NULL);
INSERT INTO "profile_modules" VALUES('profile-juan-demo','vcard','2027-08-01 00:33:47','2026-08-01 00:33:47',NULL,NULL);
INSERT INTO "profile_modules" VALUES('profile-juan-demo','form_contact','2027-08-01 00:33:47','2026-08-01 00:33:47',NULL,NULL);
INSERT INTO "profile_products" VALUES('prod-juan-1','profile-juan-demo','Consultoría Estratégica','Sesión 1:1 de 60 minutos para analizar tu situación y definir el plan de acción más efectivo para tu negocio digital.','$50 USD','https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&q=80','Hola! Vi tu perfil y me interesa la Consultoría Estratégica.',1,0,'2026-08-01 00:33:47');
INSERT INTO "profile_products" VALUES('prod-juan-2','profile-juan-demo','Landing Page Premium','Diseño y desarrollo de página de aterrizaje optimizada para conversión, con formulario de contacto y analíticas incluidas.','$200 USD','https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&q=80','Hola! Vi tu perfil y me interesa la Landing Page Premium.',0,1,'2026-08-01 00:33:47');
INSERT INTO "profile_products" VALUES('prod-juan-3','profile-juan-demo','Pack Social Media','Gestión mensual de redes sociales: estrategia de contenido, diseño de piezas y reportes de métricas mensuales.','$150 USD / mes','https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&q=80','Hola! Vi tu perfil y me interesa el Pack Social Media.',0,2,'2026-08-01 00:33:47');
INSERT INTO "profile_products" VALUES('prod-juan-4','profile-juan-demo','Identidad de Marca','Creación de logo, paleta de colores, tipografías y guía de estilo completa para profesionalizar tu marca.','$300 USD','https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80','Hola! Vi tu perfil y me interesa el servicio de Identidad de Marca.',0,3,'2026-08-01 00:33:47');
INSERT INTO "profile_products" VALUES('prod-demo-1','profile-juan-demo','Servicio Premium','Diseño + optimización de tu perfil para convertir más.','RD$ 5,900',NULL,'Hola, me interesa el Servicio Premium. ¿Cómo inicio?',1,1,'2026-08-01 00:33:47');
INSERT INTO "profile_products" VALUES('prod-demo-2','profile-juan-demo','Asesoría Express','Diagnóstico rápido + recomendaciones accionables.','RD$ 1,990',NULL,'Hola, quiero la Asesoría Express. ¿Disponibilidad?',0,2,'2026-08-01 00:33:47');
INSERT INTO "profile_social_links" VALUES('sl-juan-ig','profile-juan-demo','instagram','https://instagram.com/juandemo',0,1);
INSERT INTO "profile_social_links" VALUES('sl-juan-tt','profile-juan-demo','tiktok','https://tiktok.com/@juandemo',1,1);
INSERT INTO "profile_social_links" VALUES('sl-juan-email','profile-juan-demo','email','mailto:juan@demo.intap.link',2,1);
INSERT INTO "profiles" VALUES('profile-juan-demo','user-juan-demo','juan','pro','default','Juan Carlos','Perfil demo de Intap Link',1,'2026-08-01 00:33:47',NULL,NULL,NULL,NULL,NULL,1,'["links","faqs","products","video","gallery"]','#3B82F6','rounded',NULL,'{}',NULL,NULL,NULL,'esencial');
INSERT INTO "users" VALUES('user-juan-demo','juan@demo.intap.link','2026-08-01 00:33:47');
DELETE FROM "sqlite_sequence";
CREATE INDEX idx_analytics_profile_event ON analytics (profile_id, event_type, created_at);
CREATE INDEX idx_leads_slug_created ON leads(profile_slug, created_at);
CREATE INDEX idx_leads_ip_created ON leads(ip_hash, created_at);
CREATE INDEX idx_rl_slug_ip_created ON lead_rate_limits(profile_slug, ip_hash, created_at);
CREATE INDEX idx_products_profile ON profile_products(profile_id, sort_order);
CREATE INDEX idx_social_links_profile
  ON profile_social_links (profile_id, sort_order);
CREATE INDEX idx_waitlist_email ON waitlist (email);
CREATE INDEX idx_auth_otp_email ON auth_otp (email, expires_at);
CREATE INDEX idx_sessions_token ON sessions (token_hash);
CREATE INDEX idx_sessions_user  ON sessions (user_id);
CREATE INDEX idx_social_links_profile_sort ON profile_social_links(profile_id, sort_order);
CREATE INDEX idx_faqs_profile_sort ON profile_faqs(profile_id, sort_order);
CREATE INDEX idx_products_profile_sort ON profile_products(profile_id, sort_order);
CREATE INDEX idx_gallery_profile_sort ON profile_gallery(profile_id, sort_order);
CREATE INDEX idx_profile_faqs_profile_sort ON profile_faqs(profile_id, sort_order);
CREATE INDEX idx_profile_products_profile_sort ON profile_products(profile_id, sort_order);
CREATE INDEX idx_profile_products_featured ON profile_products(profile_id, is_featured);
CREATE INDEX idx_profile_gallery_profile_sort ON profile_gallery(profile_id, sort_order);
CREATE INDEX idx_profile_social_links_profile_enabled_sort
ON profile_social_links(profile_id, enabled, sort_order);
CREATE INDEX idx_lead_rl_slug_ip_created ON lead_rate_limits(profile_slug, ip_hash, created_at);
CREATE INDEX idx_analytics_profile_event_created ON analytics(profile_id, event_type, created_at);
CREATE INDEX idx_waitlist_position ON waitlist(position);
CREATE INDEX idx_auth_magic_links_token   ON auth_magic_links(token_hash);
CREATE INDEX idx_auth_magic_links_email   ON auth_magic_links(email, created_at);
CREATE INDEX idx_auth_sessions_hash       ON auth_sessions(session_hash);
CREATE INDEX idx_auth_sessions_user       ON auth_sessions(user_id);
CREATE INDEX idx_auth_identities_provider ON auth_identities(provider, provider_user_id);
CREATE INDEX idx_profile_links_profile      ON profile_links (profile_id, sort_order);
CREATE INDEX idx_profile_links_active_sort  ON profile_links (profile_id, is_active, sort_order);
CREATE INDEX idx_profile_videos_profile_id ON profile_videos(profile_id);
CREATE INDEX idx_leads_slug_status ON leads(profile_slug, status);
CREATE INDEX idx_audit_admin_user
  ON admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_target
  ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_created_at
  ON admin_audit_log(created_at);
CREATE UNIQUE INDEX idx_profiles_slug        ON profiles (slug);
CREATE UNIQUE INDEX idx_profiles_user_unique ON profiles (user_id);
CREATE INDEX idx_profiles_user_id     ON profiles (user_id);
CREATE INDEX idx_profiles_active      ON profiles (is_active, is_published);
CREATE INDEX idx_profiles_template    ON profiles (template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_plan_events_profile
  ON profile_plan_events (profile_id);
CREATE INDEX idx_plan_events_type
  ON profile_plan_events (profile_id, event_type);
CREATE INDEX idx_plan_events_created
  ON profile_plan_events (created_at);
CREATE INDEX idx_billing_subscriptions_profile
  ON billing_subscriptions(profile_id, created_at DESC);
CREATE INDEX idx_billing_subscriptions_user
  ON billing_subscriptions(user_id, created_at DESC);
CREATE INDEX idx_billing_subscriptions_status
  ON billing_subscriptions(status);
CREATE INDEX idx_billing_subscriptions_plan
  ON billing_subscriptions(plan_id);
CREATE INDEX idx_billing_payments_profile
  ON billing_payments(profile_id, created_at DESC);
CREATE INDEX idx_billing_payments_subscription
  ON billing_payments(subscription_id);
CREATE INDEX idx_billing_payments_status
  ON billing_payments(status, created_at DESC);
CREATE INDEX idx_billing_payments_reference
  ON billing_payments(external_reference);
CREATE INDEX idx_billing_gateway_configs_provider
  ON billing_gateway_configs(provider);
CREATE INDEX idx_billing_gateway_configs_status
  ON billing_gateway_configs(status);
CREATE INDEX idx_profiles_layout_id
  ON profiles(layout_id);

