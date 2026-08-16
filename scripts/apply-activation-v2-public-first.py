from pathlib import Path

path = Path('api/src/index.ts')
source = path.read_text()

identify_marker = "// Public preflight. It reveals only product type and a stable public code;"
identify_sentinel = "app.post('/api/v1/public/artifacts/identify'"
if identify_sentinel not in source:
    block = r'''// Public product identification by the non-secret code printed/programmed on the product.
// This step never consumes the activation secret and never creates ownership.
app.post('/api/v1/public/artifacts/identify', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const publicCode = String(body?.public_code || '').trim().toUpperCase()
  if (!isPublicCodeShape(publicCode)) {
    return c.json({ ok: false, error: 'Código público inválido.' }, 400)
  }

  const row = await c.env.DB.prepare(
    `SELECT a.public_code, a.product_type, a.status, a.owner_user_id,
            CASE
              WHEN ac.id IS NULL THEN 'none'
              WHEN ac.status = 'active' AND ac.expires_at IS NOT NULL AND ac.expires_at <= datetime('now') THEN 'expired'
              ELSE ac.status
            END AS activation_code_status
       FROM intap_artifacts a
       LEFT JOIN artifact_activation_codes ac
         ON ac.id = (
           SELECT ac2.id FROM artifact_activation_codes ac2
            WHERE ac2.artifact_id = a.id
            ORDER BY ac2.created_at DESC, ac2.id DESC LIMIT 1
         )
      WHERE a.public_code = ? LIMIT 1`
  ).bind(publicCode).first()

  if (!row) return c.json({ ok: false, error: 'Producto INTAP no encontrado.' }, 404)
  const artifact = row as any
  if (artifact.owner_user_id || !['available', 'unassigned'].includes(String(artifact.status))) {
    return c.json({ ok: false, error: 'Este producto ya fue reclamado.' }, 409)
  }
  if (artifact.activation_code_status !== 'active') {
    return c.json({ ok: false, error: 'Este producto no tiene un código de activación disponible.' }, 409)
  }

  return c.json({
    ok: true,
    data: {
      public_code: artifact.public_code,
      product_type: artifact.product_type,
      status: 'available',
    },
  })
})

'''
    if identify_marker not in source:
        raise SystemExit('identify insertion marker not found')
    source = source.replace(identify_marker, block + identify_marker, 1)

activate_marker = "me.patch('/artifacts/:id/profile', async (c) => {"
activate_sentinel = "me.post('/artifacts/activate-direct'"
if activate_sentinel not in source:
    block = r'''// Activation v2: the public product code is identified first; after authentication
// and profile creation, the secret is submitted once and the whole claim is committed atomically.
me.post('/artifacts/activate-direct', async (c) => {
  const userId = c.get('userId') as string
  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const publicCode = String(body?.public_code || '').trim().toUpperCase()
  const activationCode = normalizeActivationCode(body?.activation_code)
  const requestedProfileId = String(body?.profile_id || '').trim()

  if (!isPublicCodeShape(publicCode)) return c.json({ ok: false, error: 'Código público inválido.' }, 400)
  if (!isActivationCodeShape(activationCode)) return c.json({ ok: false, error: 'Código de activación inválido.' }, 400)
  if (!requestedProfileId) return c.json({ ok: false, error: 'Debes crear o seleccionar tu perfil antes de activar el producto.' }, 409)

  const profile = await c.env.DB.prepare(
    `SELECT id, slug, is_active, is_published FROM profiles
      WHERE id = ? AND user_id = ? AND is_active = 1 LIMIT 1`
  ).bind(requestedProfileId, userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no autorizado o inactivo.' }, 403)

  const activationHash = await hashActivationCode(activationCode)
  const candidate = await c.env.DB.prepare(
    `SELECT a.id AS artifact_id, a.public_code, a.product_type,
            ac.id AS activation_code_id
       FROM intap_artifacts a
       JOIN artifact_activation_codes ac ON ac.artifact_id = a.id
      WHERE a.public_code = ?
        AND ac.activation_code_hash = ?
        AND ac.status = 'active'
        AND (ac.expires_at IS NULL OR ac.expires_at > datetime('now'))
        AND a.owner_user_id IS NULL
        AND a.status IN ('available', 'unassigned')
      LIMIT 1`
  ).bind(publicCode, activationHash).first()

  if (!candidate) {
    return c.json({ ok: false, error: 'El código secreto no corresponde a este producto o ya no está disponible.' }, 409)
  }

  const artifactId = String((candidate as any).artifact_id)
  const activationCodeId = String((candidate as any).activation_code_id)
  const intentToken = generateToken(32)
  const intentHash = await sha256Hex(intentToken)
  const intentId = crypto.randomUUID()
  const claimAt = new Date().toISOString().replace('T', ' ').replace('Z', '')

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO artifact_activation_intents
          (id, intent_hash, artifact_id, activation_code_id, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, 'active', datetime(?, '+15 minutes'), ?)`
      ).bind(intentId, intentHash, artifactId, activationCodeId, claimAt, claimAt),
      c.env.DB.prepare(
        `UPDATE intap_artifacts
            SET owner_user_id = ?, profile_id = ?, status = 'activated',
                activated_at = ?, updated_at = ?
          WHERE id = ? AND public_code = ?
            AND owner_user_id IS NULL
            AND status IN ('available', 'unassigned')
            AND EXISTS (
              SELECT 1 FROM artifact_activation_codes ac
               WHERE ac.id = ? AND ac.artifact_id = intap_artifacts.id
                 AND ac.activation_code_hash = ?
                 AND ac.status = 'active'
                 AND (ac.expires_at IS NULL OR ac.expires_at > ?)
            )`
      ).bind(userId, requestedProfileId, claimAt, claimAt, artifactId, publicCode, activationCodeId, activationHash, claimAt),
      c.env.DB.prepare(
        `UPDATE artifact_activation_codes
            SET status = 'used', used_at = ?
          WHERE id = ? AND artifact_id = ? AND activation_code_hash = ?
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > ?)
            AND EXISTS (
              SELECT 1 FROM intap_artifacts a
               WHERE a.id = ? AND a.owner_user_id = ? AND a.profile_id = ?
                 AND a.status = 'activated' AND a.activated_at = ?
            )`
      ).bind(claimAt, activationCodeId, artifactId, activationHash, claimAt,
             artifactId, userId, requestedProfileId, claimAt),
      c.env.DB.prepare(
        `UPDATE artifact_activation_intents
            SET status = 'consumed', consumed_at = ?
          WHERE id = ? AND intent_hash = ? AND artifact_id = ? AND activation_code_id = ?
            AND status = 'active'
            AND EXISTS (
              SELECT 1 FROM artifact_activation_codes ac
               WHERE ac.id = ? AND ac.status = 'used' AND ac.used_at = ?
            )`
      ).bind(claimAt, intentId, intentHash, artifactId, activationCodeId, activationCodeId, claimAt),
      c.env.DB.prepare(
        `INSERT INTO artifact_activation_claims
          (intent_hash, artifact_id, activation_code_id, user_id, profile_id, claim_at, ok)
         VALUES (?, ?, ?, ?, ?, ?, CASE WHEN EXISTS (
           SELECT 1
             FROM intap_artifacts a
             JOIN artifact_activation_codes ac ON ac.id = ? AND ac.artifact_id = a.id
             JOIN artifact_activation_intents i ON i.id = ? AND i.artifact_id = a.id AND i.activation_code_id = ac.id
            WHERE a.id = ? AND a.owner_user_id = ? AND a.profile_id = ?
              AND a.status = 'activated' AND a.activated_at = ?
              AND ac.status = 'used' AND ac.used_at = ?
              AND i.status = 'consumed' AND i.consumed_at = ?
         ) THEN 1 ELSE 0 END)`
      ).bind(intentHash, artifactId, activationCodeId, userId, requestedProfileId, claimAt,
             activationCodeId, intentId, artifactId, userId, requestedProfileId,
             claimAt, claimAt, claimAt),
    ])
  } catch (error) {
    console.error('[POST /me/artifacts/activate-direct] atomic claim rejected:', error)
    return c.json({ ok: false, error: 'No se pudo completar la vinculación. El producto no fue consumido; vuelve a intentarlo.' }, 409)
  }

  const row = await c.env.DB.prepare(
    `SELECT a.id, a.public_code, a.product_type, a.status, a.profile_id,
            a.activated_at, a.created_at, a.updated_at,
            p.slug as profile_slug, p.name as profile_name,
            p.is_active as profile_is_active, p.is_published as profile_is_published
       FROM intap_artifacts a
       JOIN profiles p ON p.id = a.profile_id
      WHERE a.id = ? AND a.owner_user_id = ? AND a.profile_id = ?
        AND a.status = 'activated' LIMIT 1`
  ).bind(artifactId, userId, requestedProfileId).first()

  if (!row) return c.json({ ok: false, error: 'La activación se completó pero no pudo verificarse el vínculo final.' }, 500)

  return c.json({
    ok: true,
    data: {
      ...artifactPublicResponse(c, row),
      profile_is_active: (row as any).profile_is_active,
      profile_is_published: (row as any).profile_is_published,
    },
  }, 201)
})

'''
    if activate_marker not in source:
        raise SystemExit('activate insertion marker not found')
    source = source.replace(activate_marker, block + activate_marker, 1)

path.write_text(source)
print('Applied activation v2 public-code-first API endpoints.')
