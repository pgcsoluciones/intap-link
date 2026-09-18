import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input:string){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')
}
function parseCookie(header:string,name:string){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match?decodeURIComponent(match[1]):null
}
async function sessionUserId(c:any){
  const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session)
  if(!raw)return null
  const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first()
  return row?String((row as any).user_id||''):null
}
async function requireUser(c:any,next:any){
  const userId=await sessionUserId(c)
  if(!userId)return c.json({ok:false,error:'Unauthorized'},401)
  c.set('userId',userId)
  await next()
}

app.get('/api/v1/me/home-route',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')

  const sponsorMembership=await c.env.DB.prepare(
    `SELECT sm.sponsor_id,sm.role,st.is_active
       FROM sponsor_members sm
       LEFT JOIN sponsor_tenants st ON st.id=sm.sponsor_id
      WHERE sm.user_id=? AND sm.status='active'
      ORDER BY CASE WHEN sm.role='owner' THEN 0 ELSE 1 END
      LIMIT 1`
  ).bind(userId).first()

  if(sponsorMembership){
    return c.json({ok:true,data:{kind:'sponsor',route:'/admin/sponsor',role:String((sponsorMembership as any).role||'member')}})
  }

  const sponsored=await c.env.DB.prepare(
    `SELECT id,profile_role,status,username
       FROM sponsored_profiles
      WHERE user_id=?
      ORDER BY CASE WHEN profile_role='beneficiary' THEN 0 ELSE 1 END,created_at DESC
      LIMIT 1`
  ).bind(userId).first()

  if(sponsored){
    const role=String((sponsored as any).profile_role||'beneficiary')
    return c.json({ok:true,data:{kind:role==='sponsor_owner'?'sponsor':'sponsored',route:role==='sponsor_owner'?'/admin/sponsor':'/admin/sponsored',role,status:String((sponsored as any).status||'draft')}})
  }

  const profile=await c.env.DB.prepare(
    `SELECT id,plan_id,slug FROM profiles WHERE user_id=? ORDER BY created_at ASC LIMIT 1`
  ).bind(userId).first()

  if(profile){
    const planId=String((profile as any).plan_id||'free').trim().toLowerCase()
    if(planId==='free')return c.json({ok:true,data:{kind:'free',route:'/admin/free',plan_id:planId}})
    return c.json({ok:true,data:{kind:planId.includes('med')?'med':'paid',route:'/admin',plan_id:planId}})
  }

  return c.json({ok:true,data:{kind:'none',route:'/admin/free/onboarding/welcome'}})
})

export default app
