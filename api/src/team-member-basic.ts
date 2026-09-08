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
async function userId(c: any) {
  const raw = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!raw) return null
  const row = await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first()
  return row ? String((row as any).user_id || '') : null
}
async function requireAuth(c: any, next: any) {
  const id = await userId(c)
  if (!id) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', id)
  await next()
}

app.get('/api/v1/me/team/members/:id/basic', requireAuth, async (c: any) => {
  const requester = c.get('userId') as string
  const access = await c.env.DB.prepare(`
    SELECT tw.id team_id,
           CASE WHEN tw.owner_user_id=? THEN 'master' ELSE COALESCE(tm.admin_role,'member') END access_role
      FROM team_workspaces tw
      LEFT JOIN team_members tm ON tm.team_id=tw.id AND tm.user_id=?
     WHERE tw.owner_user_id=? OR tm.user_id=?
     LIMIT 1
  `).bind(requester,requester,requester,requester).first()
  if (!access || !['master','editor','subadmin'].includes(String((access as any).access_role || ''))) return c.json({ ok:false,error:'Tu rol no permite editar miembros.' },403)

  const row = await c.env.DB.prepare(`
    SELECT tm.id,tm.admin_role,tm.permissions_json,tm.status,p.name,p.template_data,pc.phone,pc.email,pc.whatsapp,u.email account_email,a.public_code product_code
      FROM team_members tm
      JOIN profiles p ON p.id=tm.profile_id
      JOIN users u ON u.id=tm.user_id
      JOIN intap_artifacts a ON a.id=tm.artifact_id
      LEFT JOIN profile_contact pc ON pc.profile_id=tm.profile_id
     WHERE tm.id=? AND tm.team_id=?
     LIMIT 1
  `).bind(String(c.req.param('id') || ''),String((access as any).team_id)).first()
  if (!row) return c.json({ ok:false,error:'Miembro no encontrado.' },404)
  let template:any={}; try{template=JSON.parse(String((row as any).template_data||'{}'))||{}}catch{template={}}
  let permissions:string[]=[]; try{const parsed=JSON.parse(String((row as any).permissions_json||'[]'));permissions=Array.isArray(parsed)?parsed.map(String):[]}catch{}
  return c.json({ ok:true,data:{
    id:String((row as any).id),
    admin_role:String((row as any).admin_role||'member'),
    status:String((row as any).status||'active'),
    permissions,
    name:String((row as any).name||''),
    role:String(template.role||''),
    phone:String((row as any).phone||''),
    email:String((row as any).email||''),
    whatsapp:String((row as any).whatsapp||''),
    account_email:String((row as any).account_email||''),
    product_code:String((row as any).product_code||''),
  }})
})

export default app
