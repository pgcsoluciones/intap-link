import { cookieNames } from './lib/cookies'

const hashToken=async(raw:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join('')
const normalize=(value:unknown)=>String(value||'').trim().toLowerCase()
export async function sessionActor(c:any){
 const raw=String(c.req.header('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieNames(c.env).session+'='))?.split('=').slice(1).join('=')||''
 if(!raw)return null
 return c.env.DB.prepare("SELECT u.id,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_hash=? AND s.revoked_at IS NULL AND s.expires_at>datetime('now') LIMIT 1").bind(await hashToken(decodeURIComponent(raw))).first()
}
export function delegateHeader(c:any){return String(c.req.header('X-KawMed-Delegate')||'').trim()}
export async function liveGuestProfile(c:any,userId:string){
 const requested=delegateHeader(c)
 if(!requested||!userId)return null
 const byId=/^i-[a-f0-9-]{36}$/.test(requested)
 const byToken=/^[a-f0-9]{64}$/.test(requested)
 if(!byId&&!byToken)return null
 const key=byId?requested.slice(2):await hashToken(requested)
 const where=byId?'i.id=?':'i.token_hash=?'
 const row=await c.env.DB.prepare(`SELECT p.* FROM kawmed_demo_live_access g
 JOIN kawmed_demo_invitations i ON i.id=g.invitation_id
 JOIN medical_profiles p ON p.id=g.medical_profile_id AND p.user_id=g.owner_user_id
 JOIN users guest ON guest.id=?
 JOIN users owner ON owner.id=g.owner_user_id
 WHERE ${where} AND lower(i.invited_email)=lower(guest.email)
 AND lower(owner.email)='intapcard@gmail.com'
 AND i.status IN ('pending','active') AND datetime(i.expires_at)>datetime('now')
 LIMIT 1`).bind(userId,key).first()
 return row||null
}
export async function liveGuestInvitation(c:any,guestEmail:string,requested:string){
 const byId=/^i-[a-f0-9-]{36}$/.test(requested)
 const byToken=/^[a-f0-9]{64}$/.test(requested)
 if(!byId&&!byToken)return null
 const key=byId?requested.slice(2):await hashToken(requested)
 const field=byId?'i.id':'i.token_hash'
 return c.env.DB.prepare(`SELECT i.id,i.expires_at,i.invited_email,g.medical_profile_id
 FROM kawmed_demo_invitations i JOIN kawmed_demo_live_access g ON g.invitation_id=i.id
 JOIN medical_profiles p ON p.id=g.medical_profile_id AND p.user_id=g.owner_user_id
 JOIN users owner ON owner.id=g.owner_user_id
 WHERE ${field}=? AND lower(i.invited_email)=? AND lower(owner.email)='intapcard@gmail.com'
 AND i.status IN ('pending','active') AND datetime(i.expires_at)>datetime('now') LIMIT 1`).bind(key,normalize(guestEmail)).first()
}
