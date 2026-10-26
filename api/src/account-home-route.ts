import app from './index'
import { cookieNames } from './lib/cookies'
import { listOwnedSponsoredBeneficiaryProfiles, sponsoredMultiProfileAccess, setMedicalContextCookie, listSponsorAccounts, resolveSponsorMembership, setSponsorContext } from './sponsored-multiprofile-access'
import { clearIntapSelection, readIntapSelection, setIntapSelection, matchesActiveIntapTab, type IntapAccountKind } from './intap-active-account'

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

  // Medical-only accounts receive their own home. Keep classic Link/Free/Sponsored precedence
  // whenever this user also owns a standard public profile (including the multiaccount operator).
  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const email=String((user as any)?.email||'').trim().toLowerCase()
  if(email==='intapcard@gmail.com'){
    // El login sin un código de activación explícito siempre muestra todas las cuentas.
    return c.json({ok:true,data:{kind:'multiaccount',route:'/admin/accounts'}})
  }
  if(email!=='intapcard@gmail.com'){
    const [medicalProfile,medicalMaster]=await Promise.all([
      c.env.DB.prepare('SELECT id,slug FROM medical_profiles WHERE user_id=? ORDER BY created_at ASC LIMIT 1').bind(userId).first().catch(()=>null),
      c.env.DB.prepare("SELECT sponsor_id FROM medical_sponsor_masters WHERE claimed_by_user_id=? AND status='claimed' LIMIT 1").bind(userId).first().catch(()=>null)
    ])
    if(medicalProfile||medicalMaster){
      const [regularProfile,regularSponsored]=await Promise.all([
        c.env.DB.prepare('SELECT id FROM profiles WHERE user_id=? LIMIT 1').bind(userId).first(),
        c.env.DB.prepare('SELECT id FROM sponsored_profiles WHERE user_id=? LIMIT 1').bind(userId).first()
      ])
      if(!regularProfile&&!regularSponsored&&medicalProfile){
      return c.json({ok:true,data:{kind:'kawmed',route:'/admin/medical',medical_profile_id:String((medicalProfile as any).id||''),public_route:'/m/'+String((medicalProfile as any).slug||'')}})
    }
      if(!regularProfile&&!regularSponsored&&medicalMaster){
      return c.json({ok:true,data:{kind:'kawmed_sponsor',route:'/admin/sponsor/kawmed',sponsor_id:String((medicalMaster as any).sponsor_id||'')}})
      }
    }
  }

  const sponsorMembership=await c.env.DB.prepare(
    `SELECT sm.sponsor_id,sm.role,st.is_active
       FROM sponsor_members sm
       LEFT JOIN sponsor_tenants st ON st.id=sm.sponsor_id
      WHERE sm.user_id=? AND sm.status='active'
      ORDER BY CASE WHEN sm.role='owner' THEN 0 ELSE 1 END
      LIMIT 1`
  ).bind(userId).first()

  if(sponsorMembership){
    const masterProfile=await c.env.DB.prepare(
      `SELECT id,username,status FROM sponsored_profiles WHERE sponsor_id=? AND user_id=? AND profile_role='sponsor_owner' ORDER BY created_at ASC LIMIT 1`
    ).bind(String((sponsorMembership as any).sponsor_id||''),userId).first()
    return c.json({ok:true,data:{
      kind:'sponsor',
      route:'/admin/sponsor',
      role:String((sponsorMembership as any).role||'member'),
      profile_id:masterProfile?String((masterProfile as any).id||''):null,
      username:masterProfile?String((masterProfile as any).username||''):null,
      public_route:masterProfile&&String((masterProfile as any).username||'')?'/p/'+String((masterProfile as any).username||''):null,
      agenda_route:masterProfile?'/admin/sponsored/agenda?scope=master':null,
    }})
  }

  if(await sponsoredMultiProfileAccess(c,userId)){
    const profiles=await listOwnedSponsoredBeneficiaryProfiles(c,userId)
    if(profiles.length>1){
      return c.json({ok:true,data:{kind:'sponsored',route:'/admin/sponsored/select',role:'beneficiary',profiles_count:profiles.length,multiple_profiles:true}})
    }
  }

  const sponsored=await c.env.DB.prepare(
    `SELECT id,profile_role,status,username
       FROM sponsored_profiles
      WHERE user_id=?
        AND COALESCE(profile_role,'beneficiary')='beneficiary'
      ORDER BY created_at DESC
      LIMIT 1`
  ).bind(userId).first()

  if(sponsored){
    const role=String((sponsored as any).profile_role||'beneficiary')
    const sponsoredId=String((sponsored as any).id||'')
    const username=String((sponsored as any).username||'')
    return c.json({ok:true,data:{
      kind:role==='sponsor_owner'?'sponsor':'sponsored',
      route:role==='sponsor_owner'?'/admin/sponsor':'/admin/sponsored',
      role,
      status:String((sponsored as any).status||'draft'),
      profile_id:sponsoredId,
      username,
      public_route:username?'/p/'+username:null,
      agenda_route:role==='sponsor_owner'?'/admin/sponsored/agenda?scope=master':'/admin/sponsored/agenda',
    }})
  }

  const profile=await c.env.DB.prepare(
    `SELECT id,plan_id,slug FROM profiles WHERE user_id=? ORDER BY created_at ASC LIMIT 1`
  ).bind(userId).first()

  if(profile){
    const planId=String((profile as any).plan_id||'free').trim().toLowerCase()
    const slug=String((profile as any).slug||'')
    if(planId==='free')return c.json({ok:true,data:{kind:'free',route:'/admin/free',plan_id:planId,public_route:slug?'/'+slug:null,agenda_route:'/admin/free/agenda'}})
    return c.json({ok:true,data:{kind:planId.includes('med')?'med':'paid',route:'/admin',plan_id:planId,public_route:slug?'/'+slug:null,agenda_route:null}})
  }

  return c.json({ok:true,data:{kind:'none',route:'/admin/free/onboarding/welcome'}})
})

/**
 * Contexto de patrocinador con verificación de membresía.
 * Los selectores existentes ya consumen estas rutas.
 */
app.get('/api/v1/sponsor/accounts',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'No autorizado.'},403)
  const accounts=await listSponsorAccounts(c,userId)
  const current=await resolveSponsorMembership(c,userId)
  return c.json({ok:true,data:{accounts,current_sponsor_id:String((current as any)?.sponsor_id||'')}})
})
app.post('/api/v1/sponsor/context',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'No autorizado.'},403)
  const body=await c.req.json().catch(()=>({}))
  const sponsorId=String(body.sponsor_id||'').trim()
  if(!sponsorId||sponsorId.length>80)return c.json({ok:false,error:'Patrocinador inválido.'},422)
  if(await sponsoredMultiProfileAccess(c,userId)){
    const active=await readIntapSelection(c)
    if(!active||!['sponsor','medical_master'].includes(active.kind)||active.id!==sponsorId||!matchesActiveIntapTab(c,active))
      return c.json({ok:false,error:'Cambiar de cuenta requiere volver al directorio Multicuenta.'},403)
  }
  if(!(await setSponsorContext(c,userId,sponsorId)))return c.json({ok:false,error:'No perteneces a este patrocinador.'},403)
  return c.json({ok:true,data:{sponsor_id:sponsorId}})
})

/** Directorio de cuentas del operador especial; nunca aceptar un user_id del cliente. */
app.get('/api/v1/me/intapcard/accounts',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'No autorizado.'},403)
  const [doctors,beneficiaries,sponsors,free,trials]=await Promise.all([
    c.env.DB.prepare(`SELECT mp.id,mp.name,mp.slug,mp.status,
      (SELECT mac.code FROM medical_access_codes mac WHERE mac.medical_profile_id=mp.id AND mac.claimed_by_user_id=? AND mac.status='claimed' LIMIT 1) AS med_code,
      (SELECT st.name FROM medical_profile_sponsors mps JOIN sponsor_tenants st ON st.id=mps.sponsor_id WHERE mps.medical_profile_id=mp.id AND mps.enabled=1 LIMIT 1) AS sponsor_name
      FROM medical_profiles mp WHERE mp.user_id=? ORDER BY mp.created_at DESC`).bind(userId,userId).all(),
    c.env.DB.prepare(`SELECT sp.id,sp.business_name,sp.username,sp.status,st.name AS sponsor_name
      FROM sponsored_profiles sp LEFT JOIN sponsor_tenants st ON st.id=sp.sponsor_id
      WHERE sp.user_id=? AND COALESCE(sp.profile_role,'beneficiary')='beneficiary' ORDER BY sp.created_at DESC`).bind(userId).all(),
    c.env.DB.prepare(`SELECT sm.sponsor_id,st.name,sm.role,
      EXISTS(SELECT 1 FROM sponsored_profiles sp WHERE sp.sponsor_id=st.id AND sp.user_id=? AND sp.profile_role='sponsor_owner') AS normal_master,
      EXISTS(SELECT 1 FROM medical_sponsor_masters msm WHERE msm.sponsor_id=st.id AND msm.claimed_by_user_id=? AND msm.status='claimed') AS medical_master
      FROM sponsor_members sm JOIN sponsor_tenants st ON st.id=sm.sponsor_id
      WHERE sm.user_id=? AND sm.status='active' AND st.is_active=1 ORDER BY st.name`).bind(userId,userId,userId).all(),
    c.env.DB.prepare('SELECT id,name,slug,plan_id FROM profiles WHERE user_id=? ORDER BY created_at DESC').bind(userId).all(),
    c.env.DB.prepare('SELECT id,name,slug,status FROM trial_profiles WHERE owner_user_id=? ORDER BY created_at DESC').bind(userId).all()
  ])
  const items:any[]=[]
  for(const p of doctors.results||[])items.push({id:p.id,kind:'medical',title:p.name||p.slug||'KawMed',detail:p.med_code||p.slug||'',sponsor:p.sponsor_name||'',status:p.status})
  for(const p of beneficiaries.results||[])items.push({id:p.id,kind:'sponsored',title:p.business_name||p.username||'Perfil patrocinado',detail:p.username||'',sponsor:p.sponsor_name||'',status:p.status})
  for(const p of sponsors.results||[]){
    if(Number(p.normal_master))items.push({id:p.sponsor_id,kind:'sponsor',title:p.name,detail:'Master Kawvo Link'})
    if(Number(p.medical_master))items.push({id:p.sponsor_id,kind:'medical_master',title:p.name,detail:'Master KawMed'})
  }
  for(const p of free.results||[]){
    const isFree=String(p.plan_id||'free').toLowerCase()==='free'
    items.push({id:p.id,kind:isFree?'free':'paid',title:p.name||p.slug||(isFree?'Free':'Kawvo Link'),detail:p.slug||'',status:p.plan_id})
  }
  for(const p of trials.results||[])items.push({id:p.id,kind:'trial',title:p.name||p.slug||'Trial',detail:p.slug||'',status:p.status})
  return c.json({ok:true,data:{items}})
})

/**
 * Central, explicit selection. A stored sponsor_id or doctor cookie alone NEVER
 * establishes which account Intapcard is currently administering.
 */
async function ownedChoice(c:any,userId:string,kind:IntapAccountKind,id:string){
  let query='', params:any[]=[id,userId]
  switch(kind){
    case 'medical':query='SELECT 1 FROM medical_profiles WHERE id=? AND user_id=? LIMIT 1';break
    case 'sponsored':query="SELECT 1 FROM sponsored_profiles WHERE id=? AND user_id=? AND COALESCE(profile_role,'beneficiary')='beneficiary' LIMIT 1";break
    case 'free':query="SELECT 1 FROM profiles WHERE id=? AND user_id=? AND LOWER(COALESCE(plan_id,'free'))='free' LIMIT 1";break
    case 'paid':query="SELECT 1 FROM profiles WHERE id=? AND user_id=? AND LOWER(COALESCE(plan_id,'free'))<>'free' LIMIT 1";break
    case 'trial':query='SELECT 1 FROM trial_profiles WHERE id=? AND owner_user_id=? LIMIT 1';break
    case 'sponsor':query=`SELECT 1 FROM sponsor_members sm JOIN sponsor_tenants st ON st.id=sm.sponsor_id
      WHERE sm.sponsor_id=? AND sm.user_id=? AND sm.status='active' AND st.is_active=1
      AND EXISTS(SELECT 1 FROM sponsored_profiles sp WHERE sp.sponsor_id=sm.sponsor_id AND sp.user_id=sm.user_id AND sp.profile_role='sponsor_owner') LIMIT 1`;break
    case 'medical_master':query=`SELECT 1 FROM sponsor_members sm JOIN sponsor_tenants st ON st.id=sm.sponsor_id
      WHERE sm.sponsor_id=? AND sm.user_id=? AND sm.status='active' AND st.is_active=1
      AND EXISTS(SELECT 1 FROM medical_sponsor_masters msm WHERE msm.sponsor_id=sm.sponsor_id AND msm.claimed_by_user_id=sm.user_id AND msm.status='claimed') LIMIT 1`;break
  }
  if(!query)return false
  const row=await c.env.DB.prepare(query).bind(...params).first()
  return Boolean(row)
}
const accountRoute:Record<IntapAccountKind,string>={
  medical:'/admin/medical',medical_master:'/admin/sponsor/kawmed',
  sponsor:'/admin/sponsor',sponsored:'/admin/sponsored',
  free:'/admin/free',paid:'/admin?account=paid',trial:'/trial/login'
}
app.get('/api/v1/me/intapcard/active-account',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'No autorizado.'},403)
  const selected=await readIntapSelection(c)
  if(!selected||!(await ownedChoice(c,userId,selected.kind,selected.id)))return c.json({ok:true,data:{active:null}})
  return c.json({ok:true,data:{active:{kind:selected.kind,id:selected.id,route:accountRoute[selected.kind]},tab_session_valid:matchesActiveIntapTab(c,selected),
    // A genuinely new tab may attach to the already-selected account; a tab
    // presenting a stale token is NEVER silently refreshed.
    new_tab_token:!String(c.req.header('X-Intap-Account-Tab')||'').trim()?selected.tabToken:null}})
})
app.post('/api/v1/me/intapcard/active-account',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'No autorizado.'},403)
  const body=await c.req.json().catch(()=>({}))
  const kind=String(body.kind||'') as IntapAccountKind
  const id=String(body.id||'')
  if(!/^[a-f0-9-]{36}$/i.test(id)||!(await ownedChoice(c,userId,kind,id)))return c.json({ok:false,error:'No tienes acceso a esa cuenta.'},403)
  // Persist backing contexts ONLY for the chosen category; no cross-category inference.
  if(kind==='medical')setMedicalContextCookie(c,id)
  if((kind==='sponsor'||kind==='medical_master')&&!(await setSponsorContext(c,userId,id)))
    return c.json({ok:false,error:'No tienes acceso a ese patrocinador.'},403)
  const tabToken=await setIntapSelection(c,{kind,id})
  if(!tabToken)return c.json({ok:false,error:'Sesión inválida. Inicia sesión nuevamente.'},401)
  return c.json({ok:true,data:{kind,id,route:accountRoute[kind],tab_token:tabToken}})
})
app.post('/api/v1/me/intapcard/leave-account',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'No autorizado.'},403)
  clearIntapSelection(c)
  return c.json({ok:true,data:{route:'/admin/accounts'}})
})

app.post('/api/v1/me/intapcard/medical-context',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'No autorizado.'},403)
  const body=await c.req.json().catch(()=>({}))
  const profileId=String(body.profile_id||'')
  if(!/^[a-f0-9-]{36}$/i.test(profileId))return c.json({ok:false,error:'Perfil inválido.'},422)
  const profile=await c.env.DB.prepare('SELECT id FROM medical_profiles WHERE id=? AND user_id=? LIMIT 1').bind(profileId,userId).first()
  if(!profile)return c.json({ok:false,error:'Este perfil no pertenece a la cuenta.'},403)
  const active=await readIntapSelection(c)
  if(!active||active.kind!=='medical'||active.id!==profileId||!matchesActiveIntapTab(c,active))
    return c.json({ok:false,error:'Vuelve al directorio Multicuenta para seleccionar este médico.'},403)
  setMedicalContextCookie(c,profileId)
  return c.json({ok:true,data:{route:'/admin/medical'}})
})

export default app
