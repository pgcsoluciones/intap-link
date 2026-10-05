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

export async function resolveFreeDemoDelegation(c:any,actorUserId:string):Promise<FreeDemoDelegation|null>{
  const demoId=requestedDemoId(c)
  if(!demoId)return null
  if(!/^[a-f0-9-]{20,80}$/i.test(demoId))throw Object.assign(new Error('Delegación Demo inválida.'),{status:400,code:'invalid_free_demo_delegation'})

  const admin=await c.env.DB.prepare("SELECT role FROM admin_users WHERE user_id=? LIMIT 1").bind(actorUserId).first()
  if(String((admin as any)?.role||'')!=='super_admin')throw Object.assign(new Error('Solo SuperAdmin puede administrar esta Demo.'),{status:403,code:'free_demo_delegation_forbidden'})

  const row=await c.env.DB.prepare(`
    SELECT d.id demo_id,d.profile_id,d.synthetic_owner_user_id,d.status,d.published_at,
           p.slug,p.plan_id,p.is_active,p.user_id
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
