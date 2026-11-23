import { readIntapSelection, matchesActiveIntapTab } from './intap-active-account'
import { sponsoredMultiProfileAccess } from './sponsored-multiprofile-access'

// G7.2-A: read-only, Preview-only, bounded queries. Legacy G5 endpoints and writes stay intact.
type Scope={userId:string;sponsorId:string}
type Auth=(c:any)=>Promise<Scope|null>
type Resource='sellers'|'assignments'
function bad(message='Parámetros de consulta inválidos.'){return Object.assign(new Error(message),{status:400})}
const normalize=(x:string)=>x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')
const escapeLike=(s:string)=>s.replace(/[\\%_]/g,'\\const escapeLike=(s:string)=>s.replace(/[\\%_]/g,'\\$&')
')
function sqlFold(input:string){
 let expr='lower('+input+')'
 for(const [accent,plain] of Object.entries({'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n'}))expr="replace("+expr+",'"+accent+"','"+plain+"')"
 for(const mark of [768,769,771,776])expr="replace("+expr+",char("+mark+"),'')"
 return expr
}
function argsFor(c:any){
 const p=new URL(c.req.url).searchParams
 const allowed=new Set(['q','state','limit','page'])
 for(const k of p.keys())if(!allowed.has(k)||p.getAll(k).length!==1)throw bad()
 const qRaw=p.get('q')||'',q=normalize(qRaw),state=p.get('state')||'all'
 const rawLimit=p.get('limit')||'10',rawPage=p.get('page')||'1'
 if(qRaw.length>160||q.length>160||q.split(' ').length>12||!['all','active','inactive'].includes(state)
   ||!/^(?:[1-9]|1[0-9]|2[0-5])$/.test(rawLimit)
   ||!/^[1-9]\d{0,3}$/.test(rawPage))throw bad()
 const limit=Number(rawLimit),page=Number(rawPage)
 return {q,state,limit,page,offset:(page-1)*limit}
}
const LIKE=" ESCAPE '\\'"
function clausesFor(resource:Resource,sponsorId:string,q:string,state:string){
 const clauses=[resource==='sellers'?'r.sponsor_id=?':'a.sponsor_id=?'],bind:any[]=[sponsorId]
 if(state!=='all'){clauses.push((resource==='sellers'?'r.active':'a.active')+'=?');bind.push(state==='active'?1:0)}
 if(q){
  const expression=resource==='sellers'
   ?"COALESCE(r.first_name,'')||' '||COALESCE(r.last_name,'')||' '||COALESCE(r.employee_code,'')||' '||COALESCE(r.whatsapp,'')||' '||COALESCE(r.email,'')||' '||COALESCE(r.zone,'')||' '||COALESCE(r.territory,'')"
   :"COALESCE(ia.public_code,'')||' '||COALESCE(a.group_label,'')||' '||COALESCE(r.first_name,'')||' '||COALESCE(r.last_name,'')"
  for(const token of q.split(' ')){clauses.push(sqlFold(expression)+' LIKE ?'+LIKE);bind.push('%'+escapeLike(token)+'%')}
 }
 return {where:clauses.join(' AND '),bind}
}
const FROM={
 sellers:'FROM sponsor_sales_representatives r',
 assignments:'FROM sponsor_sales_assignments a JOIN sponsor_artifacts sa ON sa.artifact_id=a.artifact_id AND sa.sponsor_id=a.sponsor_id JOIN intap_artifacts ia ON ia.id=sa.artifact_id JOIN sponsor_sales_representatives r ON r.id=a.representative_id AND r.sponsor_id=a.sponsor_id'
}
const FIELDS={
 sellers:'r.id,r.employee_code,r.first_name,r.last_name,r.whatsapp,r.email,r.zone,r.territory,r.active,r.created_at',
 assignments:"a.id,a.artifact_id,a.representative_id,a.group_label,a.active,a.assigned_at,a.ended_at,ia.public_code,(r.first_name || ' ' || r.last_name) AS representative_name"
}
const ORDER={
 sellers:'r.active DESC,r.first_name COLLATE NOCASE ASC,r.last_name COLLATE NOCASE ASC,r.id ASC',
 assignments:'a.assigned_at DESC,a.id DESC'
}
export async function commercialPage(c:any,resource:Resource,authorized:Auth){
 c.header('Cache-Control','no-store')
 c.header('Vary','Cookie, X-Intap-Account-Tab')
 try{
  const scope=await authorized(c)
  if(!scope)return c.json({ok:false,error:'Acceso comercial no autorizado.'},403)
  if(await sponsoredMultiProfileAccess(c,scope.userId)){
   const selection=await readIntapSelection(c)
   if(selection?.kind!=='sponsor'||selection.id!==scope.sponsorId)
    return c.json({ok:false,error:'Selecciona el patrocinador desde Multicuenta.'},403)
   if(!matchesActiveIntapTab(c,selection))
    return c.json({ok:false,error:'La pestaña no administra la cuenta activa.',code:'intap_account_tab_stale'},409)
  }
  const {q,state,limit,page,offset}=argsFor(c)
  const {where,bind}=clausesFor(resource,scope.sponsorId,q,state)
  const from=FROM[resource]
  const count=await c.env.DB.prepare('SELECT COUNT(*) AS n '+from+' WHERE '+where).bind(...bind).first()
  const total=Number(count?.n||0)
  if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid count')
  const res=await c.env.DB.prepare('SELECT '+FIELDS[resource]+' '+from+' WHERE '+where+' ORDER BY '+ORDER[resource]+' LIMIT ? OFFSET ?').bind(...bind,limit,offset).all()
  if(res.success===false)throw Error('D1 read failed')
  return c.json({ok:true,data:{
   version:'g7.2-a',resource,tenant_id:scope.sponsorId,items:res.results||[],
   total,page,limit,from:total&&offset<total?offset+1:0,
   to:Math.min(total,offset+(res.results||[]).length),
   has_previous:page>1,has_more:offset+limit<total,
   reset_required:page>1&&total>0&&offset>=total
  }})
 }catch(e){
  const invalid=(e as any)?.status===400
  return c.json({ok:false,error:invalid?(e as Error).message:'No pudimos consultar el listado comercial. Intenta de nuevo.'},invalid?400:503)
 }
}
export function registerSponsorCommercialPages(app:any,authorized:Auth){
 for(const resource of ['sellers','assignments'] as const)
  app.get('/api/v1/sponsor/commercial/'+resource+'/page',
   async(c:any,next:any)=>String(c.env.ENVIRONMENT||'').toLowerCase()==='preview'?next():c.json({ok:false,error:'Not found'},404),
   (c:any)=>commercialPage(c,resource,authorized))
}
