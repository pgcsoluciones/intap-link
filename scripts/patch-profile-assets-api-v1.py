#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.home() / 'Desktop' / 'intap-link-universal-bilingual-audit'
TARGET = ROOT / 'api' / 'src' / 'index.ts'
text = TARGET.read_text(encoding='utf-8')
marker = "app.get('/api/v1/public/assets/*', async (c) => {"
if marker not in text:
    raise SystemExit('No encontré endpoint público de assets R2 en api/src/index.ts')
if "app.get('/api/v1/public/profiles/:slug/assets/*'" in text:
    print('✓ Endpoint DB-backed profile assets ya existe')
    raise SystemExit(0)
route = r'''app.get('/api/v1/public/profiles/:slug/assets/*', async (c) => {
  const slug = String(c.req.param('slug') || '').trim().toLowerCase()
  if (!slug || slug.includes('/')) return c.json({ error: 'Slug inválido' }, 400)

  const prefix = `/api/v1/public/profiles/${slug}/assets/`
  const encodedPath = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : ''
  const assetKey = decodeURIComponent(encodedPath).replace(/^\/+/, '')
  if (!assetKey || assetKey.includes('..')) return c.json({ error: 'Asset inválido' }, 400)

  const row = await c.env.DB.prepare(`
    SELECT pa.r2_key, pa.content_type
    FROM profile_assets pa
    JOIN profiles p ON p.id = pa.profile_id
    WHERE lower(p.slug) = ?1
      AND pa.asset_key = ?2
      AND pa.is_active = 1
    LIMIT 1
  `).bind(slug, assetKey).first<{ r2_key: string; content_type: string | null }>()

  if (!row?.r2_key) return c.json({ error: 'Asset no encontrado' }, 404)
  const object = await c.env.BUCKET.get(row.r2_key)
  if (!object) return c.json({ error: 'Archivo no encontrado' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  if (row.content_type) headers.set('content-type', row.content_type)
  if (object.httpEtag) headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
  headers.set('x-kawvo-asset-registry', 'd1')
  headers.set('x-kawvo-asset-storage', 'r2')

  return new Response(object.body, { headers })
})

'''
text = text.replace(marker, route + marker, 1)
TARGET.write_text(text, encoding='utf-8')
print('✓ Endpoint público profile assets: D1 registry -> R2')
