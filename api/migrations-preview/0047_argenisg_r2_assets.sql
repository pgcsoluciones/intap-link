-- 0047_argenisg_r2_assets.sql
-- Preview: inventario persistente de recursos gráficos de perfiles especiales.
-- Los binarios viven en R2 Preview; D1 Preview conserva el mapa lógico -> r2_key.

CREATE TABLE IF NOT EXISTS profile_assets (
  profile_id TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  content_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, asset_key),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_assets_profile_sort
  ON profile_assets(profile_id, sort_order, asset_key);

CREATE INDEX IF NOT EXISTS idx_profile_assets_r2_key
  ON profile_assets(r2_key);

UPDATE profiles
SET template_data = json_set(
      CASE WHEN json_valid(template_data) THEN template_data ELSE '{}' END,
      '$.asset_storage', 'r2',
      '$.asset_manifest_version', 1,
      '$.asset_route', '/assets/adonisg',
      '$.asset_r2_prefix', 'profile-assets/argenisg/v1',
      '$.social_image_url', 'https://intap-api-preview.fliaprince.workers.dev/api/v1/public/profiles/argenisg/assets/og/adonisg-og-v6.png'
    ),
    updated_at = datetime('now')
WHERE slug = 'argenisg';
