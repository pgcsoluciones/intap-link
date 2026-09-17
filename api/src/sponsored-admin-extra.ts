import app from './index'
import { requireSuperAdmin } from './lib/admin-auth'

function clean(value:unknown,max=180){return String(value??'').trim().slice(0,max)}

app.get('/api/v1/superadmin/sponsors/:id/members',requireSuperAdmin('viewer'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'')
  const result=await c.env.DB.prepare(`SELECT sm.user_id,sm.role,sm.status,u.email,u.name FROM sponsor_members sm LEFT JOIN users u ON u.id=sm.user_id WHERE sm.sponsor_id=? ORDER BY sm.created_at ASC`).bind(sponsorId).all()
  return c.json({ok:true,data:result.results||[]})
})

app.post('/api/v1/superadmin/sponsors/:id/members',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'');const body=await c.req.json().catch(()=>({}));const email=clean(body.email,180).toLowerCase();const role=['owner','admin','viewer'].includes(String(body.role))?String(body.role):'owner'
  if(!email)return c.json({ok:false,error:'Correo requerido.'},422)
  const user=await c.env.DB.prepare(`SELECT id,email FROM users WHERE lower(email)=? LIMIT 1`).bind(email).first()
  if(!user)return c.json({ok:false,error:'Ese correo todavía no tiene una cuenta Kawvo.'},404)
  await c.env.DB.prepare(`INSERT INTO sponsor_members (sponsor_id,user_id,role,status) VALUES (?,?,?,'active') ON CONFLICT(sponsor_id,user_id) DO UPDATE SET role=excluded.role,status='active'`).bind(sponsorId,String((user as any).id),role).run()
  return c.json({ok:true,data:{user_id:(user as any).id,email:(user as any).email,role}})
})

app.delete('/api/v1/superadmin/sponsors/:id/members/:userId',requireSuperAdmin('super_admin'),async(c:any)=>{
  await c.env.DB.prepare(`UPDATE sponsor_members SET status='inactive' WHERE sponsor_id=? AND user_id=?`).bind(String(c.req.param('id')||''),String(c.req.param('userId')||'')).run()
  return c.json({ok:true})
})

app.get('/api/v1/superadmin/sponsors/:id/modules',requireSuperAdmin('viewer'),async(c:any)=>{
  const result=await c.env.DB.prepare(`SELECT module_code,enabled FROM sponsor_module_grants WHERE sponsor_id=? ORDER BY module_code`).bind(String(c.req.param('id')||'')).all()
  return c.json({ok:true,data:result.results||[]})
})

export default app
