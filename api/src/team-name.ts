import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function sessionUserId(c: any): Promise<string | null> {
  const raw = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!raw) return null
  const row = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(await sha256Hex(raw)).first()
  return row ? String((row as any).user_id || '') : null
}

async function requireTeamNameAuth(c: any, next: any) {
  const userId = await sessionUserId(c)
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  await next()
}

function normalizeTeamName(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80)
}

function normalizeCompanyName(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120)
}

function readObject(raw: unknown): Record<string, any> {
  try {
    const parsed = JSON.parse(String(raw || '{}'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

async function writeTeamPresentationSettings(c: any, teamId: string, masterProfileId: string, companyName: string, showBankAccounts?: boolean) {
  const [master, masterBankSetting, members] = await Promise.all([
    c.env.DB.prepare(`SELECT template_data FROM profiles WHERE id=? LIMIT 1`).bind(masterProfileId).first(),
    c.env.DB.prepare(`SELECT is_enabled FROM profile_bank_settings WHERE profile_id=? LIMIT 1`).bind(masterProfileId).first(),
    c.env.DB.prepare(`
      SELECT p.id,p.template_data
        FROM team_members tm
        JOIN profiles p ON p.id=tm.profile_id
       WHERE tm.team_id=?
    `).bind(teamId).all(),
  ])

  const masterTemplate = readObject((master as any)?.template_data)
  masterTemplate.team_company_name = companyName
  if (typeof showBankAccounts === 'boolean') masterTemplate.team_show_bank_accounts = showBankAccounts

  const statements: any[] = [
    c.env.DB.prepare(`UPDATE profiles SET template_data=?,updated_at=datetime('now') WHERE id=?`).bind(JSON.stringify(masterTemplate), masterProfileId),
  ]
  const inheritedBankEnabled = masterBankSetting ? Number((masterBankSetting as any).is_enabled || 0) === 1 : true

  for (const row of members.results as any[]) {
    const memberTemplate = readObject(row.template_data)
    memberTemplate.team_company_name = companyName
    if (typeof showBankAccounts === 'boolean') memberTemplate.team_show_bank_accounts = showBankAccounts
    statements.push(c.env.DB.prepare(`UPDATE profiles SET template_data=?,updated_at=datetime('now') WHERE id=?`).bind(JSON.stringify(memberTemplate), String(row.id)))

    if (typeof showBankAccounts === 'boolean') {
      const enabled = showBankAccounts && inheritedBankEnabled ? 1 : 0
      statements.push(c.env.DB.prepare(`
        INSERT INTO profile_bank_settings(profile_id,is_enabled,updated_at)
        VALUES(?,?,datetime('now'))
        ON CONFLICT(profile_id) DO UPDATE SET is_enabled=excluded.is_enabled,updated_at=datetime('now')
      `).bind(String(row.id), enabled))
    }
  }
  if (statements.length) await c.env.DB.batch(statements)
}

app.put('/api/v1/me/team/name', requireTeamNameAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }

  const name = normalizeTeamName(body.name)
  if (name.length < 2) return c.json({ ok: false, error: 'El nombre del Team debe tener al menos 2 caracteres.' }, 400)

  const team = await c.env.DB.prepare(
    `SELECT id FROM team_workspaces WHERE owner_user_id = ? LIMIT 1`,
  ).bind(userId).first()
  if (!team) return c.json({ ok: false, error: 'Team no encontrado.' }, 404)

  const teamId = String((team as any).id)
  await c.env.DB.prepare(
    `UPDATE team_workspaces SET name = ?, name_confirmed = 1, updated_at = datetime('now') WHERE id = ? AND owner_user_id = ?`,
  ).bind(name, teamId, userId).run()

  return c.json({ ok: true, data: { team_id: teamId, name, name_confirmed: true } })
})

app.get('/api/v1/me/team/name', requireTeamNameAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const row = await c.env.DB.prepare(
    `SELECT tw.id AS team_id, tw.name AS team_name, tw.name_confirmed, mp.name AS master_name, mp.slug AS master_slug,
            CASE WHEN tw.owner_user_id = ? THEN 'master' ELSE 'member' END AS role
       FROM team_workspaces tw
       JOIN profiles mp ON mp.id = tw.master_profile_id
       LEFT JOIN team_members tm ON tm.team_id = tw.id AND tm.user_id = ?
      WHERE tw.owner_user_id = ? OR tm.user_id = ?
      LIMIT 1`,
  ).bind(userId, userId, userId, userId).first()

  if (!row) return c.json({ ok: false, error: 'Team no encontrado.' }, 404)
  return c.json({ ok: true, data: {
    team_id: String((row as any).team_id),
    team_name: String((row as any).team_name || ''),
    master_name: String((row as any).master_name || ''),
    master_slug: String((row as any).master_slug || ''),
    name_confirmed: Number((row as any).name_confirmed || 0) === 1,
    role: String((row as any).role || ''),
  } })
})

app.get('/api/v1/me/team/settings', requireTeamNameAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const row = await c.env.DB.prepare(`
    SELECT tw.id team_id,tw.name team_name,tw.master_profile_id,mp.template_data
      FROM team_workspaces tw
      JOIN profiles mp ON mp.id=tw.master_profile_id
     WHERE tw.owner_user_id=? AND tw.status='active'
     LIMIT 1
  `).bind(userId).first()
  if (!row) return c.json({ ok: false, error: 'Team no encontrado.' }, 404)
  const template = readObject((row as any).template_data)
  const showBankAccounts = template.team_show_bank_accounts !== false && String(template.team_show_bank_accounts).toLowerCase() !== 'false'
  return c.json({ ok: true, data: {
    company_name: normalizeCompanyName(template.team_company_name),
    show_bank_accounts: showBankAccounts,
  } })
})

app.put('/api/v1/me/team/settings', requireTeamNameAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }

  const hasCompanyName = Object.prototype.hasOwnProperty.call(body, 'company_name')
  const hasBankVisibility = typeof body.show_bank_accounts === 'boolean'
  if (!hasCompanyName && !hasBankVisibility) return c.json({ ok: false, error: 'No hay cambios para guardar.' }, 400)

  const row = await c.env.DB.prepare(`
    SELECT tw.id team_id,tw.master_profile_id,mp.template_data
      FROM team_workspaces tw
      JOIN profiles mp ON mp.id=tw.master_profile_id
     WHERE tw.owner_user_id=? AND tw.status='active'
     LIMIT 1
  `).bind(userId).first()
  if (!row) return c.json({ ok: false, error: 'Team no encontrado.' }, 404)

  const currentTemplate = readObject((row as any).template_data)
  const currentCompanyName = normalizeCompanyName(currentTemplate.team_company_name)
  const companyName = hasCompanyName ? normalizeCompanyName(body.company_name) : currentCompanyName
  if (hasCompanyName && companyName.length < 2) return c.json({ ok: false, error: 'Escribe el nombre de la empresa.' }, 400)
  const showBankAccounts = hasBankVisibility
    ? Boolean(body.show_bank_accounts)
    : currentTemplate.team_show_bank_accounts !== false && String(currentTemplate.team_show_bank_accounts).toLowerCase() !== 'false'

  const teamId = String((row as any).team_id)
  await writeTeamPresentationSettings(c, teamId, String((row as any).master_profile_id), companyName, showBankAccounts)
  return c.json({ ok: true, data: { company_name: companyName, show_bank_accounts: showBankAccounts } })
})

app.post('/api/v1/public/team/name', async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const teamId = String(body.team_id || '').trim()
  if (!teamId) return c.json({ ok: false, error: 'Team no identificado.' }, 400)

  const row = await c.env.DB.prepare(
    `SELECT tw.id AS team_id, tw.name AS team_name, mp.name AS master_name, mp.slug AS master_slug
       FROM team_workspaces tw
       JOIN profiles mp ON mp.id = tw.master_profile_id
      WHERE tw.id = ? AND tw.status = 'active'
      LIMIT 1`,
  ).bind(teamId).first()

  if (!row) return c.json({ ok: false, error: 'Team no disponible.' }, 404)
  return c.json({ ok: true, data: {
    team_id: String((row as any).team_id),
    team_name: String((row as any).team_name || (row as any).master_name || 'Mi Team'),
    master_name: String((row as any).master_name || ''),
    master_slug: String((row as any).master_slug || ''),
  } })
})

export default app
