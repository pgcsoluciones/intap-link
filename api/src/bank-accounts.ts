import app from './preview-entry'
import { cookieNames } from './lib/cookies'

type AccountType = 'savings' | 'checking'
type Currency = 'DOP' | 'USD'
type DisplayMode = 'masked' | 'visible'
type HolderIdType = 'cedula' | 'rnc'

const MAX_BANK_ACCOUNTS = 3
const FAIR_CUTOFF_UTC = '2026-09-06 04:00:00'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requireBankAuth(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', String((session as any).user_id || ''))
  await next()
}

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

function normalizeAccountType(value: unknown): AccountType | null {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'savings' || raw === 'ahorros' || raw === 'ahorro') return 'savings'
  if (raw === 'checking' || raw === 'corriente') return 'checking'
  return null
}

function normalizeCurrency(value: unknown): Currency | null {
  const raw = String(value || '').trim().toUpperCase()
  return raw === 'DOP' || raw === 'USD' ? raw : null
}

function normalizeDisplayMode(value: unknown): DisplayMode | null {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'masked' || raw === 'visible' ? raw : null
}

function normalizeHolderIdType(value: unknown): HolderIdType | null {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'cedula' || raw === 'cédula') return 'cedula'
  if (raw === 'rnc') return 'rnc'
  return null
}

async function bankAccess(c: any, profileId: string, planId: string) {
  if (String(planId || 'free') !== 'free') {
    return { allowed: true, source: 'plan' as const }
  }

  const moduleRow = await c.env.DB.prepare(
    `SELECT profile_id FROM profile_modules
      WHERE profile_id = ?
        AND module_code = 'bank_accounts'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      LIMIT 1`,
  ).bind(profileId).first()

  if (moduleRow) return { allowed: true, source: 'fair' as const }

  const promo = await c.env.DB.prepare(
    `SELECT CASE WHEN datetime('now') < ? THEN 1 ELSE 0 END AS active`,
  ).bind(FAIR_CUTOFF_UTC).first()

  if (Number((promo as any)?.active || 0) === 1) {
    return { allowed: true, source: 'fair' as const }
  }

  return { allowed: false, source: null, locked_reason: 'plan_required' as const }
}

async function ownerProfile(c: any, userId: string) {
  return c.env.DB.prepare(
    `SELECT id, plan_id, is_published, slug FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()
}

function serializeOwnerAccount(row: any) {
  const accountNumber = String(row.account_number || '')
  return {
    id: row.id,
    bank_code: row.bank_code || null,
    bank_name: row.bank_name,
    account_number: accountNumber,
    display_number: row.display_mode === 'visible' ? accountNumber : maskAccountNumber(accountNumber),
    account_type: row.account_type,
    currency: row.currency,
    holder_name: row.holder_name,
    holder_id_type: row.holder_id_type || null,
    holder_id_number: String(row.holder_id_number || ''),
    display_mode: row.display_mode,
    sort_order: Number(row.sort_order || 0),
    is_active: Boolean(row.is_active),
  }
}

app.get('/api/v1/me/bank-accounts', requireBankAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const profile = await ownerProfile(c, userId)
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = String((profile as any).id)
  const access = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  const settings = await c.env.DB.prepare(
    `SELECT is_enabled FROM profile_bank_settings WHERE profile_id = ? LIMIT 1`,
  ).bind(profileId).first()

  const rows = access.allowed
    ? await c.env.DB.prepare(
        `SELECT id, bank_code, bank_name, account_number, account_type, currency,
                holder_name, holder_id_type, holder_id_number, display_mode, sort_order, is_active
           FROM profile_bank_accounts
          WHERE profile_id = ?
          ORDER BY sort_order ASC, created_at ASC`,
      ).bind(profileId).all()
    : { results: [] }

  return c.json({
    ok: true,
    data: {
      access,
      enabled: settings ? Boolean((settings as any).is_enabled) : true,
      max_accounts: MAX_BANK_ACCOUNTS,
      items: (rows.results as any[]).map(serializeOwnerAccount),
    },
  })
})

app.put('/api/v1/me/bank-accounts/settings', requireBankAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const profile = await ownerProfile(c, userId)
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = String((profile as any).id)
  const access = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!access.allowed) return c.json({ ok: false, error: 'Cuentas bancarias disponibles en Plan Básico.' }, 403)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const enabled = body.enabled ? 1 : 0

  await c.env.DB.prepare(
    `INSERT INTO profile_bank_settings (profile_id, is_enabled, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(profile_id) DO UPDATE SET is_enabled = excluded.is_enabled, updated_at = datetime('now')`,
  ).bind(profileId, enabled).run()

  return c.json({ ok: true, enabled: Boolean(enabled) })
})

app.post('/api/v1/me/bank-accounts', requireBankAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const profile = await ownerProfile(c, userId)
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = String((profile as any).id)
  const access = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!access.allowed) return c.json({ ok: false, error: 'Cuentas bancarias disponibles en Plan Básico.' }, 403)

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM profile_bank_accounts WHERE profile_id = ?`,
  ).bind(profileId).first()
  if (Number((countRow as any)?.n || 0) >= MAX_BANK_ACCOUNTS) {
    return c.json({ ok: false, error: 'Puedes agregar un máximo de 3 cuentas.' }, 409)
  }

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const bankName = String(body.bank_name || '').trim().slice(0, 80)
  const bankCode = String(body.bank_code || '').trim().slice(0, 40) || null
  const accountNumber = cleanAccountNumber(body.account_number)
  const accountType = normalizeAccountType(body.account_type)
  const currency = normalizeCurrency(body.currency)
  const holderName = String(body.holder_name || '').trim().slice(0, 120)
  const holderIdType = normalizeHolderIdType(body.holder_id_type)
  const holderIdNumber = cleanHolderId(body.holder_id_number)
  const displayMode = normalizeDisplayMode(body.display_mode || 'masked')

  if (!bankName) return c.json({ ok: false, error: 'Selecciona el banco.' }, 400)
  if (accountNumber.length < 4) return c.json({ ok: false, error: 'Número de cuenta no válido.' }, 400)
  if (!accountType) return c.json({ ok: false, error: 'Tipo de cuenta no válido.' }, 400)
  if (!currency) return c.json({ ok: false, error: 'Moneda no válida.' }, 400)
  if (!holderName) return c.json({ ok: false, error: 'Indica el titular de la cuenta.' }, 400)
  if (!holderIdType) return c.json({ ok: false, error: 'Selecciona si el titular usa Cédula o RNC.' }, 400)
  if (holderIdNumber.length < 9) return c.json({ ok: false, error: 'Indica un número de Cédula o RNC válido.' }, 400)
  if (!displayMode) return c.json({ ok: false, error: 'Modo de visualización no válido.' }, 400)

  const sortRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) AS n FROM profile_bank_accounts WHERE profile_id = ?`,
  ).bind(profileId).first()
  const id = crypto.randomUUID()
  const sortOrder = Number((sortRow as any)?.n ?? -1) + 1

  await c.env.DB.prepare(
    `INSERT INTO profile_bank_accounts
      (id, profile_id, bank_code, bank_name, account_number, account_type, currency,
       holder_name, holder_id_type, holder_id_number, display_mode, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
  ).bind(id, profileId, bankCode, bankName, accountNumber, accountType, currency, holderName, holderIdType, holderIdNumber, displayMode, sortOrder).run()

  const row = await c.env.DB.prepare(
    `SELECT * FROM profile_bank_accounts WHERE id = ? AND profile_id = ? LIMIT 1`,
  ).bind(id, profileId).first()

  return c.json({ ok: true, data: serializeOwnerAccount(row) }, 201)
})

app.put('/api/v1/me/bank-accounts/:id', requireBankAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const profile = await ownerProfile(c, userId)
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = String((profile as any).id)
  const access = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!access.allowed) return c.json({ ok: false, error: 'Cuentas bancarias disponibles en Plan Básico.' }, 403)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const existing = await c.env.DB.prepare(
    `SELECT * FROM profile_bank_accounts WHERE id = ? AND profile_id = ? LIMIT 1`,
  ).bind(c.req.param('id'), profileId).first()
  if (!existing) return c.json({ ok: false, error: 'Cuenta no encontrada.' }, 404)

  const bankName = body.bank_name !== undefined ? String(body.bank_name || '').trim().slice(0, 80) : String((existing as any).bank_name)
  const bankCode = body.bank_code !== undefined ? (String(body.bank_code || '').trim().slice(0, 40) || null) : ((existing as any).bank_code || null)
  const accountNumber = body.account_number !== undefined ? cleanAccountNumber(body.account_number) : String((existing as any).account_number)
  const accountType = body.account_type !== undefined ? normalizeAccountType(body.account_type) : (existing as any).account_type as AccountType
  const currency = body.currency !== undefined ? normalizeCurrency(body.currency) : (existing as any).currency as Currency
  const holderName = body.holder_name !== undefined ? String(body.holder_name || '').trim().slice(0, 120) : String((existing as any).holder_name)
  const holderIdType = body.holder_id_type !== undefined ? normalizeHolderIdType(body.holder_id_type) : normalizeHolderIdType((existing as any).holder_id_type)
  const holderIdNumber = body.holder_id_number !== undefined ? cleanHolderId(body.holder_id_number) : cleanHolderId((existing as any).holder_id_number)
  const displayMode = body.display_mode !== undefined ? normalizeDisplayMode(body.display_mode) : (existing as any).display_mode as DisplayMode
  const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : Number((existing as any).is_active || 0)

  if (!bankName || accountNumber.length < 4 || !accountType || !currency || !holderName || !holderIdType || holderIdNumber.length < 9 || !displayMode) {
    return c.json({ ok: false, error: 'Revisa todos los datos requeridos de la cuenta, incluyendo Cédula o RNC.' }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE profile_bank_accounts SET
       bank_code = ?, bank_name = ?, account_number = ?, account_type = ?, currency = ?,
       holder_name = ?, holder_id_type = ?, holder_id_number = ?, display_mode = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ? AND profile_id = ?`,
  ).bind(bankCode, bankName, accountNumber, accountType, currency, holderName, holderIdType, holderIdNumber, displayMode, isActive, c.req.param('id'), profileId).run()

  const row = await c.env.DB.prepare(
    `SELECT * FROM profile_bank_accounts WHERE id = ? AND profile_id = ? LIMIT 1`,
  ).bind(c.req.param('id'), profileId).first()
  return c.json({ ok: true, data: serializeOwnerAccount(row) })
})

app.delete('/api/v1/me/bank-accounts/:id', requireBankAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const profile = await ownerProfile(c, userId)
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = String((profile as any).id)
  const access = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!access.allowed) return c.json({ ok: false, error: 'Cuentas bancarias disponibles en Plan Básico.' }, 403)

  const result = await c.env.DB.prepare(
    `DELETE FROM profile_bank_accounts WHERE id = ? AND profile_id = ?`,
  ).bind(c.req.param('id'), profileId).run()

  if (Number((result as any)?.meta?.changes || 0) !== 1) {
    return c.json({ ok: false, error: 'Cuenta no encontrada.' }, 404)
  }
  return c.json({ ok: true })
})

app.get('/api/v1/public/profiles/:slug/bank-accounts', async (c: any) => {
  const slug = String(c.req.param('slug') || '').trim().toLowerCase()
  const profile = await c.env.DB.prepare(
    `SELECT id, plan_id, is_published, is_active FROM profiles WHERE lower(slug) = ? LIMIT 1`,
  ).bind(slug).first()

  if (!profile || !(profile as any).is_active) {
    return c.json({ ok: false, error: 'Perfil no disponible' }, 404)
  }

  if (!(profile as any).is_published) {
    return c.json({ ok: true, data: { enabled: false, items: [] } })
  }

  const profileId = String((profile as any).id)
  const access = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!access.allowed) return c.json({ ok: true, data: { enabled: false, items: [] } })

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
          account_type: row.account_type,
          currency: row.currency,
          holder_name: row.holder_name,
          holder_id_type: row.holder_id_type || null,
          display_mode: row.display_mode,
          display_number: row.display_mode === 'visible' ? accountNumber : maskAccountNumber(accountNumber),
          copy_value: accountNumber,
        }
      }),
    },
  })
})

app.get('/api/v1/public/profiles/:slug/bank-accounts/:id/holder-id', async (c: any) => {
  const slug = String(c.req.param('slug') || '').trim().toLowerCase()
  const profile = await c.env.DB.prepare(
    `SELECT id, plan_id, is_published, is_active FROM profiles WHERE lower(slug) = ? LIMIT 1`,
  ).bind(slug).first()

  if (!profile || !(profile as any).is_active || !(profile as any).is_published) {
    return c.json({ ok: false, error: 'Perfil no disponible' }, 404)
  }

  const profileId = String((profile as any).id)
  const access = await bankAccess(c, profileId, String((profile as any).plan_id || 'free'))
  if (!access.allowed) return c.json({ ok: false, error: 'Datos no disponibles' }, 404)

  const settings = await c.env.DB.prepare(
    `SELECT is_enabled FROM profile_bank_settings WHERE profile_id = ? LIMIT 1`,
  ).bind(profileId).first()
  if (settings && !Boolean((settings as any).is_enabled)) return c.json({ ok: false, error: 'Datos no disponibles' }, 404)

  const row = await c.env.DB.prepare(
    `SELECT holder_id_type, holder_id_number
       FROM profile_bank_accounts
      WHERE id = ? AND profile_id = ? AND is_active = 1
      LIMIT 1`,
  ).bind(c.req.param('id'), profileId).first()

  const idType = normalizeHolderIdType((row as any)?.holder_id_type)
  const idNumber = cleanHolderId((row as any)?.holder_id_number)
  if (!row || !idType || !idNumber) return c.json({ ok: false, error: 'Identificación no disponible' }, 404)

  return c.json({ ok: true, data: { type: idType, copy_value: idNumber } })
})

export default app
