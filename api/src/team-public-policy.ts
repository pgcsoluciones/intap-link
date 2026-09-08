import app from './index'
import { syncTeamMemberFromMaster } from './team-master-sync'

function readObject(raw: unknown): Record<string, any> {
  try {
    const parsed = JSON.parse(String(raw || '{}'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

app.get('/api/v1/public/team/member-access/policy', async (c: any) => {
  const slug = String(c.req.query('slug') || '').trim().toLowerCase()
  if (!slug) return c.json({ ok: false, error: 'Perfil requerido.' }, 400)

  let row = await c.env.DB.prepare(`
    SELECT tm.id,tm.profile_id,tm.admin_role,tm.status,tw.name team_name,tw.status team_status,p.is_active,p.is_published,p.template_data
      FROM profiles p
      JOIN team_members tm ON tm.profile_id=p.id
      JOIN team_workspaces tw ON tw.id=tm.team_id
     WHERE lower(p.slug)=lower(?)
     LIMIT 1
  `).bind(slug).first()

  if (!row) return c.json({ ok: true, data: { team_member: false, login_enabled: false, role: null, team_name: '', internal_team_name: '', company_name: '', synchronized: false } })

  const sync = await syncTeamMemberFromMaster(c, String((row as any).profile_id)).catch((error) => {
    console.error('[team/public-policy] master sync failed', error)
    return { team_member: true, changed: false }
  })

  row = await c.env.DB.prepare(`
    SELECT tm.id,tm.profile_id,tm.admin_role,tm.status,tw.name team_name,tw.status team_status,p.is_active,p.is_published,p.template_data
      FROM profiles p
      JOIN team_members tm ON tm.profile_id=p.id
      JOIN team_workspaces tw ON tw.id=tm.team_id
     WHERE lower(p.slug)=lower(?)
     LIMIT 1
  `).bind(slug).first()

  if (!row) return c.json({ ok: true, data: { team_member: false, login_enabled: false, role: null, team_name: '', internal_team_name: '', company_name: '', synchronized: false } })

  const internalTeamName = String((row as any).team_name || '').trim()
  const template = readObject((row as any).template_data)
  const companyName = String(template.team_company_name || '').trim()
  const showBankAccounts = template.team_show_bank_accounts !== false && String(template.team_show_bank_accounts).toLowerCase() !== 'false'
  if (!showBankAccounts) {
    await c.env.DB.prepare(`
      INSERT INTO profile_bank_settings(profile_id,is_enabled,updated_at)
      VALUES(?,0,datetime('now'))
      ON CONFLICT(profile_id) DO UPDATE SET is_enabled=0,updated_at=datetime('now')
    `).bind(String((row as any).profile_id)).run()
  }

  const role = String((row as any).admin_role || 'member')
  const usable = String((row as any).status || '') === 'active'
    && String((row as any).team_status || '') === 'active'
    && Number((row as any).is_active) === 1
    && Number((row as any).is_published) === 1
  const loginEnabled = usable && (role === 'editor' || role === 'subadmin')

  return c.json({ ok: true, data: {
    team_member: true,
    login_enabled: loginEnabled,
    role: loginEnabled ? role : 'member',
    // team_name se conserva como alias público por compatibilidad con la Graph Card.
    // El nombre operativo/interno del Team viaja separado.
    team_name: companyName,
    internal_team_name: internalTeamName,
    company_name: companyName,
    show_bank_accounts: showBankAccounts,
    synchronized: Boolean((sync as any)?.changed),
  } })
})

export default app
