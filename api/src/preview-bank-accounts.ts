import app from './preview-entry'

type AccountType = 'savings' | 'checking'
type Currency = 'DOP' | 'USD'
type HolderIdType = 'cedula' | 'rnc'

const FAIR_CUTOFF_UTC = '2026-09-06 04:00:00'

function cleanAccountNumber(value: unknown): string {
  return String(value || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 40)
}

function cleanHolderId(value: unknown): string {
  return String(value || '').replace(/\D/g, '').slice(0, 20)
}

function maskAccountNumber(value: string): string {
  const clean = cleanAccountNumber(value)
  if (!clean) return ''
  const last4 = clean.slice(-4)
  const hiddenLength = Math.max(4, clean.length - last4.length)
  const hidden = 'X'.repeat(hiddenLength)
  return `${hidden}${last4}`.replace(/(.{4})/g, '$1 ').trim()
}

function normalizeHolderIdType(value: unknown): HolderIdType | null {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'cedula' || raw === 'cédula') return 'cedula'
  if (raw === 'rnc') return 'rnc'
  return null
}

async function bankAccess(c: any, profileId: string, planId: string) {
  if (String(planId || 'free') !== 'free') return true

  const moduleRow = await c.env.DB.prepare(
    `SELECT profile_id FROM profile_modules
      WHERE profile_id = ?
        AND module_code = 'bank_accounts'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      LIMIT 1`,
  ).bind(profileId).first()
  if (moduleRow) return true

  const promo = await c.env.DB.prepare(
    `SELECT CASE WHEN datetime('now') < ? THEN 1 ELSE 0 END AS active`,
  ).bind(FAIR_CUTOFF_UTC).first()

  return Number((promo as any)?.active || 0) === 1
}

// Estas rutas solo existen en Preview. preview-frontdoor-entry valida previamente
// kawvo_preview_session contra el slug cuando ?preview=1 está presente.
app.get('/api/v1/public/profiles/:slug/preview-bank-accounts', async (c: any) => {
  if (c.req.query('preview') !== '1') {
    return c.json({ ok: false, error: 'preview_session_required' }, 403)
  }

  const slug = String(c.req.param('slug') || '').trim().toLowerCase()
  const profile = await c.env.DB.prepare(
    `SELECT id, plan_id, is_active FROM profiles WHERE lower(slug) = ? LIMIT 1`,
  ).bind(slug).first()

  if (!profile || !(profile as any).is_active) {
    return c.json({ ok: false, error: 'Perfil no disponible' }, 404)
  }

  const profileId = String((profile as any).id)
  const allowed = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!allowed) return c.json({ ok: true, data: { enabled: false, items: [] } })

  const settings = await c.env.DB.prepare(
    `SELECT is_enabled FROM profile_bank_settings WHERE profile_id = ? LIMIT 1`,
  ).bind(profileId).first()
  const enabled = settings ? Boolean((settings as any).is_enabled) : true
  if (!enabled) return c.json({ ok: true, data: { enabled: false, items: [] } })

  const rows = await c.env.DB.prepare(
    `SELECT id, bank_code, bank_name, account_number, account_type, currency,
            holder_name, holder_id_type, display_mode, sort_order
       FROM profile_bank_accounts
      WHERE profile_id = ? AND is_active = 1
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 3`,
  ).bind(profileId).all()

  return c.json({
    ok: true,
    data: {
      enabled: true,
      items: (rows.results as any[]).map((row) => {
        const accountNumber = String(row.account_number || '')
        return {
          id: row.id,
          bank_code: row.bank_code || null,
          bank_name: row.bank_name,
          account_type: row.account_type as AccountType,
          currency: row.currency as Currency,
          holder_name: row.holder_name,
          holder_id_type: normalizeHolderIdType(row.holder_id_type),
          display_mode: row.display_mode,
          display_number: row.display_mode === 'visible' ? accountNumber : maskAccountNumber(accountNumber),
          copy_value: accountNumber,
        }
      }),
    },
  })
})

app.get('/api/v1/public/profiles/:slug/preview-bank-accounts/:id/holder-id', async (c: any) => {
  if (c.req.query('preview') !== '1') {
    return c.json({ ok: false, error: 'preview_session_required' }, 403)
  }

  const slug = String(c.req.param('slug') || '').trim().toLowerCase()
  const profile = await c.env.DB.prepare(
    `SELECT id, plan_id, is_active FROM profiles WHERE lower(slug) = ? LIMIT 1`,
  ).bind(slug).first()

  if (!profile || !(profile as any).is_active) {
    return c.json({ ok: false, error: 'Perfil no disponible' }, 404)
  }

  const profileId = String((profile as any).id)
  const allowed = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!allowed) return c.json({ ok: false, error: 'Datos no disponibles' }, 404)

  const settings = await c.env.DB.prepare(
    `SELECT is_enabled FROM profile_bank_settings WHERE profile_id = ? LIMIT 1`,
  ).bind(profileId).first()
  if (settings && !Boolean((settings as any).is_enabled)) {
    return c.json({ ok: false, error: 'Datos no disponibles' }, 404)
  }

  const row = await c.env.DB.prepare(
    `SELECT holder_id_type, holder_id_number
       FROM profile_bank_accounts
      WHERE id = ? AND profile_id = ? AND is_active = 1
      LIMIT 1`,
  ).bind(c.req.param('id'), profileId).first()

  const idType = normalizeHolderIdType((row as any)?.holder_id_type)
  const idNumber = cleanHolderId((row as any)?.holder_id_number)
  if (!row || !idType || !idNumber) {
    return c.json({ ok: false, error: 'Identificación no disponible' }, 404)
  }

  return c.json({ ok: true, data: { type: idType, copy_value: idNumber } })
})

export default app
