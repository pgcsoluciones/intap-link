import fs from 'node:fs'

const path = new URL('../api/src/index.ts', import.meta.url)
let source = fs.readFileSync(path, 'utf8')

const marker = '// ─── /me endpoints — sub-app aislado, requireAuth se aplica una sola vez ──'
const sentinel = '// ─── Super Admin — physical artifacts management ─────────────────────────'

if (source.includes(sentinel)) {
  console.log('Super Admin artifact API already present; nothing to do.')
  process.exit(0)
}

if (!source.includes(marker)) {
  throw new Error('Insertion marker not found in api/src/index.ts')
}

const block = String.raw`

// ─── Super Admin — physical artifacts management ─────────────────────────
// Read and operational management for the physical product inventory.
// Plaintext activation secrets are NEVER stored; rotation revokes any still-active
// code and returns the replacement secret exactly once.

function normalizeSuperAdminArtifact(c, row) {
  const codeStatus = row.activation_code_status || 'none'
  return {
    id: row.id,
    public_code: row.public_code,
    product_type: row.product_type,
    status: row.status,
    owner_user_id: row.owner_user_id ?? null,
    owner_email: row.owner_email ?? null,
    profile_id: row.profile_id ?? null,
    profile_slug: row.profile_slug ?? null,
    profile_name: row.profile_name ?? null,
    profile_is_active: row.profile_is_active ?? null,
    profile_is_published: row.profile_is_published ?? null,
    activation_code_status: codeStatus,
    activation_code_expires_at: row.activation_code_expires_at ?? null,
    activation_code_used_at: row.activation_code_used_at ?? null,
    activation_code_created_at: row.activation_code_created_at ?? null,
    claim_at: row.claim_at ?? null,
    activated_at: row.activated_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    public_url: publicArtifactUrl(artifactWebOrigin(c), row.public_code),
  }
}

const SUPERADMIN_ARTIFACT_SELECT = String.raw\`
  SELECT
    a.id, a.public_code, a.product_type, a.status,
    a.owner_user_id, a.profile_id, a.activated_at, a.created_at, a.updated_at,
    u.email AS owner_email,
    p.slug AS profile_slug, p.name AS profile_name,
    p.is_active AS profile_is_active, p.is_published AS profile_is_published,
    CASE
      WHEN ac.id IS NULL THEN 'none'
      WHEN ac.status = 'active' AND ac.expires_at IS NOT NULL AND ac.expires_at <= datetime('now') THEN 'expired'
      ELSE ac.status
    END AS activation_code_status,
    ac.expires_at AS activation_code_expires_at,
    ac.used_at AS activation_code_used_at,
    ac.created_at AS activation_code_created_at,
    cl.claim_at AS claim_at
  FROM intap_artifacts a
  LEFT JOIN users u ON u.id = a.owner_user_id
  LEFT JOIN profiles p ON p.id = a.profile_id
  LEFT JOIN artifact_activation_codes ac
    ON ac.id = (
      SELECT ac2.id
      FROM artifact_activation_codes ac2
      WHERE ac2.artifact_id = a.id
      ORDER BY ac2.created_at DESC, ac2.id DESC
      LIMIT 1
    )
  LEFT JOIN artifact_activation_claims cl ON cl.artifact_id = a.id
\`

app.get('/api/v1/superadmin/artifacts', requireSuperAdmin('viewer'), async (c) => {
  const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') || '100', 10)))
  const status = String(c.req.query('status') || '').trim().toLowerCase()
  const q = String(c.req.query('q') || '').trim()
  const validStatuses = ['unassigned', 'available', 'activated', 'suspended', 'revoked']
  if (status && !validStatuses.includes(status)) {
    return c.json({ ok: false, error: 'Estado de producto inválido.' }, 400)
  }

  const conditions = []
  const bindings = []
  if (status) { conditions.push('a.status = ?'); bindings.push(status) }
  if (q) {
    const like = '%' + q + '%'
    conditions.push('(a.public_code LIKE ? OR u.email LIKE ? OR p.slug LIKE ? OR p.name LIKE ?)')
    bindings.push(like, like, like, like)
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''

  const rows = await c.env.DB.prepare(
    SUPERADMIN_ARTIFACT_SELECT + where + ' ORDER BY a.created_at DESC LIMIT ?'
  ).bind(...bindings, limit).all()

  return c.json({
    ok: true,
    data: { items: (rows.results || []).map(row => normalizeSuperAdminArtifact(c, row)) },
  })
})

app.get('/api/v1/superadmin/artifacts/:id', requireSuperAdmin('viewer'), async (c) => {
  const id = String(c.req.param('id') || '').trim()
  const row = await c.env.DB.prepare(
    SUPERADMIN_ARTIFACT_SELECT + ' WHERE a.id = ? LIMIT 1'
  ).bind(id).first()
  if (!row) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  return c.json({ ok: true, data: normalizeSuperAdminArtifact(c, row) })
})

app.patch('/api/v1/superadmin/artifacts/:id/profile', requireSuperAdmin('support'), async (c) => {
  const id = String(c.req.param('id') || '').trim()
  let body = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const profileId = body?.profile_id == null || body.profile_id === '' ? null : String(body.profile_id).trim()

  const artifact = await c.env.DB.prepare(
    'SELECT id, status FROM intap_artifacts WHERE id = ? LIMIT 1'
  ).bind(id).first()
  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  if (!['activated', 'suspended'].includes(String(artifact.status))) {
    return c.json({ ok: false, error: 'El destino solo puede administrarse después de activar el producto.' }, 409)
  }

  if (profileId) {
    const profile = await c.env.DB.prepare(
      'SELECT id FROM profiles WHERE id = ? AND is_active = 1 LIMIT 1'
    ).bind(profileId).first()
    if (!profile) return c.json({ ok: false, error: 'Perfil destino no encontrado o inactivo.' }, 404)
  }

  await c.env.DB.prepare(
    "UPDATE intap_artifacts SET profile_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(profileId, id).run()

  const row = await c.env.DB.prepare(
    SUPERADMIN_ARTIFACT_SELECT + ' WHERE a.id = ? LIMIT 1'
  ).bind(id).first()
  return c.json({ ok: true, data: row ? normalizeSuperAdminArtifact(c, row) : null })
})

app.patch('/api/v1/superadmin/artifacts/:id/status', requireSuperAdmin('support'), async (c) => {
  const id = String(c.req.param('id') || '').trim()
  let body = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const nextStatus = String(body?.status || '').trim().toLowerCase()
  if (!['activated', 'suspended', 'revoked'].includes(nextStatus)) {
    return c.json({ ok: false, error: 'Estado operativo inválido.' }, 400)
  }

  const current = await c.env.DB.prepare(
    'SELECT id, status, owner_user_id FROM intap_artifacts WHERE id = ? LIMIT 1'
  ).bind(id).first()
  if (!current) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)

  const currentStatus = String(current.status)
  const allowed =
    (nextStatus === 'revoked' && currentStatus !== 'revoked') ||
    (currentStatus === 'activated' && nextStatus === 'suspended') ||
    (currentStatus === 'suspended' && nextStatus === 'activated')

  if (!allowed) {
    return c.json({ ok: false, error: 'Transición de estado no permitida.', current_status: currentStatus }, 409)
  }
  if (nextStatus === 'activated' && !current.owner_user_id) {
    return c.json({ ok: false, error: 'No se puede activar operativamente un producto sin propietario.' }, 409)
  }

  await c.env.DB.prepare(
    "UPDATE intap_artifacts SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(nextStatus, id).run()

  const row = await c.env.DB.prepare(
    SUPERADMIN_ARTIFACT_SELECT + ' WHERE a.id = ? LIMIT 1'
  ).bind(id).first()
  return c.json({ ok: true, data: row ? normalizeSuperAdminArtifact(c, row) : null })
})

app.post('/api/v1/superadmin/artifacts/:id/activation-code/rotate', requireSuperAdmin('support'), async (c) => {
  const id = String(c.req.param('id') || '').trim()
  let body = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const artifact = await c.env.DB.prepare(
    'SELECT id, public_code, status, owner_user_id FROM intap_artifacts WHERE id = ? LIMIT 1'
  ).bind(id).first()
  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  if (artifact.owner_user_id || !['available', 'unassigned'].includes(String(artifact.status))) {
    return c.json({ ok: false, error: 'No se puede emitir otro código después de que el producto fue reclamado.' }, 409)
  }

  const expiresAt = body?.expires_at == null || body.expires_at === '' ? null : String(body.expires_at).trim()
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
    return c.json({ ok: false, error: 'Fecha de vencimiento inválida.' }, 400)
  }

  const activationCode = generateHumanCode(20)
  const activationHash = await hashActivationCode(activationCode)
  const activationId = crypto.randomUUID()
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE artifact_activation_codes SET status = 'revoked' WHERE artifact_id = ? AND status = 'active'"
    ).bind(id),
    c.env.DB.prepare(
      "UPDATE artifact_activation_intents SET status = 'revoked', revoked_at = ? WHERE artifact_id = ? AND status = 'active'"
    ).bind(now, id),
    c.env.DB.prepare(
      `INSERT INTO artifact_activation_codes
        (id, artifact_id, activation_code_hash, status, expires_at, created_at)
       VALUES (?, ?, ?, 'active', ?, datetime('now'))`
    ).bind(activationId, id, activationHash, expiresAt),
  ])

  return c.json({
    ok: true,
    data: {
      artifact_id: id,
      public_code: artifact.public_code,
      activation_code: activationCode,
      expires_at: expiresAt,
      warning: 'Guarda el nuevo código ahora. El secreto no puede recuperarse después.',
    },
  }, 201)
})
`

source = source.replace(marker, block + '\n\n' + marker)
fs.writeFileSync(path, source)
console.log('Inserted Super Admin artifact management API into api/src/index.ts')
