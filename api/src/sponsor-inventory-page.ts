import { resolveSponsorMembership, sponsoredMultiProfileAccess } from './sponsored-multiprofile-access'
import { readIntapSelection, matchesActiveIntapTab } from './intap-active-account'

// G7.1: SELECT-only inventory. Commercial assignment tables are not part of this schema.
const FROM=`FROM sponsor_artifacts sa JOIN intap_artifacts a ON a.id=sa.artifact_id
 LEFT JOIN sponsored_profiles sp ON sp.id=sa.sponsored_profile_id AND sp.sponsor_id=sa.sponsor_id AND sp.artifact_id=sa.artifact_id
 LEFT JOIN users u ON u.id=COALESCE(sp.user_id,sa.beneficiary_user_id)
 LEFT JOIN sponsor_batches b ON b.id=sa.batch_id AND b.sponsor_id=sa.sponsor_id`
const FIELDS=`sa.artifact_id,sa.created_at,a.public_code,a.product_type,sa.status,sa.artifact_role,sa.activated_at,
 sp.username,sp.business_name,sp.phone AS business_phone,sp.whatsapp AS business_whatsapp,u.email,sp.status AS profile_status,b.name AS batch_name,b.city,b.zone`
const BASE="sa.sponsor_id=? AND COALESCE(sa.artifact_role,'beneficiary')<>'master'"
type Key=[string,string]
type Cursor={v:1;t:string;f:string;l:number;a:Key;k:Key;d:'next'|'previous'}
function invalid(message='Consulta de inventario inválida.'){return Object.assign(new Error(message),{status:400})}
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')
function sqlNormalize(s:string){for(const [a,b] of Object.entries({'Á':'a','É':'e','Í':'i','Ó':'o','Ú':'u','Ü':'u','Ñ':'n','á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n'}))s=`replace(${s},'${a}','${b}')`;for(const mark of [768,769,771,776])s=`replace(${s},char(${mark}),'')`;return `lower(${s})`}
function encode(c:Cursor){return btoa(JSON.stringify(c)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function key(row:any):Key{return [String(row.created_at),String(row.artifact_id)]}
const keyValid=(v:any):v is Key=>Array.isArray(v)&&v.length===2&&typeof v[0]==='string'&&/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?Z?$/.test(v[0])&&typeof v[1]==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(v[1])
function decode(raw:string,tenant:string,fingerprint:string,limit:number):Cursor{
 try{if(raw.length>2048||!/^[A-Za-z0-9_-]+$/.test(raw))throw invalid();const c=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')))
  if(c.v!==1||c.t!==tenant||c.f!==fingerprint||c.l!==limit||!keyValid(c.a)||!keyValid(c.k)||!['next','previous'].includes(c.d))throw invalid()
  return c
 }catch{throw invalid('El cursor no corresponde a esta cuenta o búsqueda. Vuelve a la primera página.')}
}
const before=(column:string)=>`(sa.created_at<${column} OR (sa.created_at=${column} AND sa.artifact_id<?))`
const after=(column:string)=>`(sa.created_at>${column} OR (sa.created_at=${column} AND sa.artifact_id>?))`
function anchorWhere(){return '(sa.created_at<? OR (sa.created_at=? AND sa.artifact_id<=?))'}
const bindKey=(k:Key)=>[k[0],k[0],k[1]]

export async function sponsorInventoryPage(c:any){
 c.header('Cache-Control','no-store');c.header('Vary','Cookie, X-Intap-Account-Tab')
 try{
  const user=String(c.get('userId')||'')
  if(await sponsoredMultiProfileAccess(c,user)){
   const active=await readIntapSelection(c)
   if(active?.kind!=='sponsor')return c.json({ok:false,error:'Selecciona el patrocinador desde Multicuenta.'},403)
   if(!matchesActiveIntapTab(c,active))return c.json({ok:false,error:'La pestaña no administra la cuenta activa.',code:'intap_account_tab_stale'},409)
  }
  const membership=await resolveSponsorMembership(c,user)
  if(!membership||!['owner','admin'].includes(String(membership.role)))return c.json({ok:false,error:'No tienes permiso para consultar este inventario.'},403)
  const tenant=String(membership.sponsor_id),url=new URL(c.req.url),p=url.searchParams
  const allowed=new Set(['summary','q','status','limit','cursor'])
  for(const name of p.keys())if(!allowed.has(name)||p.getAll(name).length!==1)throw invalid()
  const qRaw=p.get('q')||'',q=normalize(qRaw),status=p.get('status')||'all',rawLimit=p.get('limit')||'10',summary=p.get('summary')==='1'
  if(qRaw.length>160||q.length>160||q.split(' ').length>12||!['all','available','activated','published','inactive'].includes(status)||!/^\d{1,2}$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>25||p.has('summary')&&!summary)throw invalid()
  if(summary&&(q||status!=='all'||p.has('cursor'))||p.has('cursor')&&!p.get('cursor'))throw invalid()
  const limit=Number(rawLimit)
  if(summary){
   const total:any=await c.env.DB.prepare(`SELECT COUNT(*) AS total,SUM(sa.status='activated') AS active,SUM(sa.status='available') AS pending,SUM(sp.status='published') AS published ${FROM} WHERE ${BASE}`).bind(tenant).first()
   const master=await c.env.DB.prepare(`SELECT ${FIELDS} ${FROM} WHERE sa.sponsor_id=? AND sa.artifact_role='master' ORDER BY sa.created_at DESC,sa.artifact_id DESC LIMIT 1`).bind(tenant).first()
   return c.json({ok:true,data:{version:'g7.1',tenant_id:tenant,totals:{total:Number(total?.total||0),active:Number(total?.active||0),pending:Number(total?.pending||0),published:Number(total?.published||0)},master:master||null}})
  }
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({q,status}))))).map(v=>v.toString(16).padStart(2,'0')).join('')
  const cursor=p.get('cursor')?decode(p.get('cursor')!,tenant,fingerprint,limit):null
  const clauses=[BASE],args:any[]=[tenant]
  if(status!=='all'){clauses.push(status==='published'?"sp.status='published'":'sa.status=?');if(status!=='published')args.push(status)}
  if(q){const hay=sqlNormalize("COALESCE(a.public_code,'')||' '||COALESCE(a.product_type,'')||' '||COALESCE(sp.business_name,'')||' '||COALESCE(u.email,'')||' '||COALESCE(sp.username,'')||' '||COALESCE(sp.phone,'')||' '||COALESCE(sp.whatsapp,'')||' '||COALESCE(b.name,'')||' '||COALESCE(b.city,'')||' '||COALESCE(b.zone,'')")
   // Same bound literal token predicates for count and rows. %, _ and backslash are not wildcards.
   for(const token of q.split(' ')){clauses.push(`${hay} LIKE ? ESCAPE '\\'`);args.push('%'+token.replace(/[\\%_]/g,'\\$&')+'%')}
  }
  if(cursor){clauses.push(anchorWhere());args.push(...bindKey(cursor.a))}
  const where=clauses.join(' AND '),paging=cursor?' AND '+(cursor.d==='next'?before('?'):after('?')):'',ascending=cursor?.d==='previous'
  const result=await c.env.DB.prepare(`SELECT ${FIELDS} ${FROM} WHERE ${where}${paging} ORDER BY sa.created_at ${ascending?'ASC':'DESC'},sa.artifact_id ${ascending?'ASC':'DESC'} LIMIT ?`).bind(...args,...(cursor?bindKey(cursor.k):[]),limit+1).all()
  if(result.success===false)throw Error('D1 read failed')
  const rows=(result.results||[]).slice(0,limit);if(ascending)rows.reverse()
  const anchor=cursor?.a||(rows.length?key(rows[0]):null)
  const scopeWhere=cursor||!anchor?where:where+' AND '+anchorWhere(),scopeArgs=cursor||!anchor?args:[...args,...bindKey(anchor!)]
  const counted:any=await c.env.DB.prepare(`SELECT COUNT(*) AS total ${FROM} WHERE ${scopeWhere}`).bind(...scopeArgs).first(),total=Number(counted?.total||0)
  let preceding=0
  if(rows.length){const prior:any=await c.env.DB.prepare(`SELECT COUNT(*) AS total ${FROM} WHERE ${scopeWhere} AND ${after('?')}`).bind(...scopeArgs,...bindKey(key(rows[0]))).first();preceding=Number(prior?.total||0)}
  const common={v:1 as const,t:tenant,f:fingerprint,l:limit,a:anchor!}
  return c.json({ok:true,data:{version:'g7.1',tenant_id:tenant,items:rows,total,limit,from:rows.length?preceding+1:0,to:preceding+rows.length,
   next_cursor:rows.length&&preceding+rows.length<total?encode({...common,k:key(rows[rows.length-1]),d:'next'}):null,
   previous_cursor:rows.length&&preceding>0?encode({...common,k:key(rows[0]),d:'previous'}):null,reset_required:Boolean(cursor&&!rows.length&&total)}})
 }catch(e){const bad=(e as any)?.status===400;return c.json({ok:false,error:bad?(e as Error).message:'No pudimos consultar el inventario. Intenta de nuevo.'},bad?400:503)}
}

export function registerSponsorInventoryPage(app:any,requireUser:any){
 app.get('/api/v1/sponsor/artifacts/page',async(c:any,next:any)=>String(c.env.ENVIRONMENT||'').toLowerCase()==='preview'?next():c.json({ok:false,error:'Not found'},404),requireUser,sponsorInventoryPage)
}
