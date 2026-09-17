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

app.get('/api/v1/me/sponsored-profile/account',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  const user=await c.env.DB.prepare(`SELECT email FROM users WHERE id=? LIMIT 1`).bind(userId).first()
  const profile=await c.env.DB.prepare(`SELECT sp.id,sp.username,sp.status,sp.artifact_id,a.public_code,a.product_type FROM sponsored_profiles sp LEFT JOIN intap_artifacts a ON a.id=sp.artifact_id WHERE sp.user_id=? AND sp.profile_role='beneficiary' ORDER BY sp.created_at ASC LIMIT 1`).bind(userId).first()
  return c.json({ok:true,data:{email:String((user as any)?.email||''),profile:profile||null}})
})

app.post('/api/v1/me/sponsored-profile/unlink',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  const body=await c.req.json().catch(()=>({}))
  const confirmEmail=String(body?.confirm_email||'').trim().toLowerCase()
  const confirmPhrase=String(body?.confirm_phrase||'').trim().replace(/\s+/g,' ').toUpperCase()
  if(confirmPhrase!=='DESVINCULAR')return c.json({ok:false,error:'Escribe DESVINCULAR para confirmar.',code:'unlink_confirmation_required'},422)

  const user=await c.env.DB.prepare(`SELECT email FROM users WHERE id=? LIMIT 1`).bind(userId).first()
  const accountEmail=String((user as any)?.email||'').trim().toLowerCase()
  if(!accountEmail||confirmEmail!==accountEmail)return c.json({ok:false,error:'El correo debe coincidir con el correo de acceso de esta cuenta.',code:'unlink_email_mismatch'},422)

  const profile=await c.env.DB.prepare(`SELECT id,artifact_id,username FROM sponsored_profiles WHERE user_id=? AND profile_role='beneficiary' ORDER BY created_at ASC LIMIT 1`).bind(userId).first()
  if(!profile)return c.json({ok:false,error:'Esta cuenta no tiene un dispositivo patrocinado beneficiario vinculado.'},404)

  const profileId=String((profile as any).id||'')
  const artifactId=String((profile as any).artifact_id||'')
  if(!artifactId)return c.json({ok:false,error:'No encontramos el dispositivo asociado a este perfil.'},409)

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE sponsor_artifacts SET sponsored_profile_id=NULL,beneficiary_user_id=NULL,status='available',activated_at=NULL WHERE artifact_id=? AND sponsored_profile_id=?`).bind(artifactId,profileId),
    c.env.DB.prepare(`UPDATE intap_artifacts SET status='available',owner_user_id=NULL,activated_at=NULL,updated_at=datetime('now') WHERE id=? AND owner_user_id=?`).bind(artifactId,userId),
    c.env.DB.prepare(`UPDATE artifact_activation_codes SET status='active',used_at=NULL,expires_at=NULL WHERE id=(SELECT id FROM artifact_activation_codes WHERE artifact_id=? ORDER BY created_at DESC,id DESC LIMIT 1)`).bind(artifactId),
    c.env.DB.prepare(`DELETE FROM sponsored_profiles WHERE id=? AND user_id=? AND profile_role='beneficiary'`).bind(profileId,userId),
  ])

  return c.json({ok:true,data:{released:true,previous_username:String((profile as any).username||'')}})
})

export default app
