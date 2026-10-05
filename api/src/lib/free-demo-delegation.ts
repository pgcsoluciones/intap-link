export const FREE_DEMO_DELEGATION_HEADER='X-Kawvo-Free-Demo-Id'

export type FreeDemoDelegation={
  demoId:string
  profileId:string
  effectiveUserId:string
  slug:string
  status:string
  actorUserId:string
}

function requestedDemoId(c:any){
  return String(c.req.header(FREE_DEMO_DELEGATION_HEADER)||'').trim()
}

function to12Hour(value:unknown){
  const raw=String(value||'').trim()
  if(/\b(?:AM|PM)\b/i.test(raw))return raw.replace(/\bam\b/gi,'AM').replace(/\bpm\b/gi,'PM')
  const m=raw.match(/^(\d{1,2}):(\d{2})$/)
  if(!m)return raw
  const hour=Number(m[1]),minute=m[2],period=hour>=12?'PM':'AM',display=hour%12||12
  return `${display}:${minute} ${period}`
}
function normalizeDemoScheduleTemplate(value:unknown){
  let data:any={}
  try{const parsed=JSON.parse(String(value||'{}'));data=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return null}
  const schedule=Array.isArray(data.free_schedule)?data.free_schedule:null
  if(!schedule)return null
  let changed=false
  const normalized=schedule.map((item:any)=>{
    const hours=String(item?.hours||'').trim()
    const parts=hours.split(/\s*-\s*/)
    if(parts.length!==2)return item
    const next=`${to12Hour(parts[0])} - ${to12Hour(parts[1])}`
    if(next!==hours)changed=true
    return {...item,hours:next}
  })
  return changed?JSON.stringify({...data,free_schedule:normalized}):null
}

function parseTemplate(value:unknown){
  try{const parsed=JSON.parse(String(value||'{}'));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return{}}
}

export async function resolveFreeDemoDelegation(c:any,actorUserId:string):Promise<FreeDemoDelegation|null>{
  const demoId=requestedDemoId(c)
  if(!demoId)return null
  if(!/^[a-f0-9-]{20,80}$/i.test(demoId))throw Object.assign(new Error('Delegación Demo inválida.'),{status:400,code:'invalid_free_demo_delegation'})

  const admin=await c.env.DB.prepare("SELECT role FROM admin_users WHERE user_id=? LIMIT 1").bind(actorUserId).first()
  if(String((admin as any)?.role||'')!=='super_admin')throw Object.assign(new Error('Solo SuperAdmin puede administrar esta Demo.'),{status:403,code:'free_demo_delegation_forbidden'})

  const row=await c.env.DB.prepare(`
    SELECT d.id demo_id,d.profile_id,d.synthetic_owner_user_id,d.status,d.published_at,
           p.slug,p.plan_id,p.is_active,p.user_id,p.template_data
      FROM free_demo_v2_profiles d
      JOIN profiles p ON p.id=d.profile_id
     WHERE d.id=?
       AND d.published_at IS NOT NULL
       AND d.status IN ('draft','published','claim_ready')
       AND p.plan_id='free'
       AND p.is_active=1
       AND p.user_id=d.synthetic_owner_user_id
     LIMIT 1
  `).bind(demoId).first()

  if(!row)throw Object.assign(new Error('Esta Demo no está disponible para administración delegada.'),{status:409,code:'free_demo_delegation_unavailable'})

  const normalizedTemplate=normalizeDemoScheduleTemplate((row as any).template_data)
  const profileId=String((row as any).profile_id)
  let template=parseTemplate(normalizedTemplate||((row as any).template_data))
  if(normalizedTemplate){
    await c.env.DB.prepare("UPDATE profiles SET template_data=?,updated_at=datetime('now') WHERE id=?").bind(normalizedTemplate,profileId).run()
  }

  if(template.free_demo_v2_bank_seeded!==true){
    const countRow=await c.env.DB.prepare("SELECT COUNT(*) AS n FROM profile_bank_accounts WHERE profile_id=?").bind(profileId).first()
    const count=Number((countRow as any)?.n||0)
    const statements:any[]=[
      c.env.DB.prepare("INSERT OR IGNORE INTO profile_modules(profile_id,module_code,expires_at,activated_at,assignment_reason) VALUES(?,'bank_accounts',NULL,datetime('now'),'promotion:free-demo-v2')").bind(profileId),
      c.env.DB.prepare("INSERT INTO profile_bank_settings(profile_id,is_enabled,updated_at) VALUES(?,1,datetime('now')) ON CONFLICT(profile_id) DO UPDATE SET is_enabled=1,updated_at=datetime('now')").bind(profileId),
    ]
    if(count===0){
      statements.push(c.env.DB.prepare("INSERT OR IGNORE INTO profile_bank_accounts(id,profile_id,bank_code,bank_name,account_number,account_type,currency,holder_name,holder_id_type,holder_id_number,display_mode,sort_order,is_active,created_at,updated_at) VALUES(?,?,NULL,'Banco de demostración','0000000000','savings','DOP','Cuenta de demostración','rnc','000000001','masked',0,1,datetime('now'),datetime('now'))").bind('demo-v2:'+String((row as any).demo_id)+':bank:sample',profileId))
    }
    template={...template,free_demo_v2_bank_seeded:true}
    statements.push(c.env.DB.prepare("UPDATE profiles SET template_data=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(template),profileId))
    await c.env.DB.batch(statements)
  }

  return{
    demoId:String((row as any).demo_id),
    profileId:String((row as any).profile_id),
    effectiveUserId:String((row as any).synthetic_owner_user_id),
    slug:String((row as any).slug||''),
    status:String((row as any).status||''),
    actorUserId,
  }
}

export async function applyFreeDemoDelegation(c:any,actorUserId:string){
  const delegation=await resolveFreeDemoDelegation(c,actorUserId)
  if(!delegation)return actorUserId
  c.set('freeDemoId',delegation.demoId)
  c.set('freeDemoProfileId',delegation.profileId)
  c.set('freeDemoActorUserId',actorUserId)
  c.set('freeDemoDelegated',true)
  return delegation.effectiveUserId
}

export function freeDemoDelegationError(c:any,error:any){
  const status=Number(error?.status||500)
  return c.json({ok:false,error:String(error?.message||'No pudimos validar la administración delegada.'),code:String(error?.code||'free_demo_delegation_error')},status as any)
}
