import app from './index'

app.get('/api/v1/public/team/member-access/policy', async (c: any) => {
  const slug = String(c.req.query('slug') || '').trim().toLowerCase()
  if (!slug) return c.json({ ok: false, error: 'Perfil requerido.' }, 400)

  const row = await c.env.DB.prepare(`
    SELECT tm.id,tm.admin_role,tm.status,tw.name team_name,tw.status team_status,p.is_active,p.is_published
      FROM profiles p
      JOIN team_members tm ON tm.profile_id=p.id
      JOIN team_workspaces tw ON tw.id=tm.team_id
     WHERE lower(p.slug)=lower(?)
     LIMIT 1
  `).bind(slug).first()

  if (!row) return c.json({ ok: true, data: { team_member: false, login_enabled: false, role: null, team_name: '' } })

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
    team_name: String((row as any).team_name || ''),
  } })
})

export default app
