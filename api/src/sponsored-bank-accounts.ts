import app from './index'
import { cookieNames } from './lib/cookies'
import { resolveOwnedSponsoredProfile, sponsoredProfileScope } from './sponsored-profile-scope'

type AccountType='savings'|'checking'
type Currency='DOP'|'USD'
type DisplayMode='masked'|'visible'
type HolderIdType='cedula'|'rnc'

const MAX_ACTIVE_BANK_ACCOUNTS=3

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){for(const part of header.split(';')){const [key,...rest]=part.trim().split('=');if(key===name)return decodeURIComponent(rest.join('='))}return null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}

function clean(value:unknown,max=160){return String(value??'').trim().slice(0,max)}
function cleanAccountNumber(value:unknown){return String(value||'').replace(/[^0-9A-Za-z]/g,'').slice(0,40)}
function cleanHolderId(value:unknown){return String(value||'').replace(/\D/g,'').slice(0,20)}
function normalizeAccountType(value:unknown):AccountType|null{const raw=String(value||'').trim().toLowerCase();if(raw==='savings'||raw==='ahorros'||raw==='ahorro')return'savings';if(raw==='checking'||raw==='corriente')return'checking';return null}
function normalizeCurrency(value:unknown):Currency|null{const raw=String(value||'').trim().toUpperCase();return raw==='DOP'||raw==='USD'?raw as Currency:null}
function normalizeDisplayMode(value:unknown):DisplayMode|null{const raw=String(value||'').trim().toLowerCase();return raw==='masked'||raw==='visible'?raw as DisplayMode:null}
function normalizeHolderIdType(value:unknown):HolderIdType|null{const raw=String(value||'').trim().toLowerCase();if(raw==='cedula'||raw==='cédula')return'cedula';if(raw==='rnc')return'rnc';return null}
function maskAccountNumber(value:string){const number=cleanAccountNumber(value);if(!number)return'';const last4=number.slice(-4);const hidden='X'.repeat(Math.max(4,number.length-last4.length));return (hidden+last4).replace(/(.{4})/g,'$1 ').trim()}
async function bankModuleEnabled(c:any,sponsorId:string){const row=await c.env.DB.prepare("SELECT enabled FROM sponsor_module_grants WHERE sponsor_id=? AND module_code='bank_accounts' LIMIT 1").bind(sponsorId).first();return Number((row as any)?.enabled||0)===1}
async function sectionEnabled(c:any,profileId:string){const row=await c.env.DB.prepare('SELECT is_enabled FROM sponsored_bank_settings WHERE sponsored_profile_id=? LIMIT 1').bind(profileId).first();return row?Boolean((row as any).is_enabled):true}
function serializeOwner(row:any){const accountNumber=String(row.account_number||'');return{id:row.id,bank_code:row.bank_code||null,bank_name:row.bank_name,account_number:accountNumber,display_number:row.display_mode==='visible'?accountNumber:maskAccountNumber(accountNumber),account_type:row.account_type,currency:row.currency,holder_name:row.holder_name,holder_id_type:row.holder_id_type||null,holder_id_number:String(row.holder_id_number||''),display_mode:row.display_mode||'masked',sort_order:Number(row.sort_order||0),is_active:Boolean(row.is_active)}}

app.get('/api/v1/me/sponsored-profile/bank-accounts',requireUser,async(c:any)=>{
  const profile=await resolveOwnedSponsoredProfile(c,String(c.get('userId')||''),sponsoredProfileScope(c))
  if(!profile)return c.json({ok:true,data:{access:{allowed:false},enabled:false,items:[],max_accounts:MAX_ACTIVE_BANK_ACCOUNTS}})
  const sponsorId=String((profile as any).sponsor_id)
  const allowed=await bankModuleEnabled(c,sponsorId)
  if(!allowed)return c.json({ok:true,data:{access:{allowed:false},enabled:false,items:[],max_accounts:MAX_ACTIVE_BANK_ACCOUNTS}})
  const profileId=String((profile as any).id)
  const enabled=await sectionEnabled(c,profileId)
  const rows=await c.env.DB.prepare('SELECT id,bank_code,bank_name,account_number,account_type,currency,holder_name,holder_id_type,holder_id_number,display_mode,sort_order,is_active FROM sponsored_bank_accounts WHERE sponsored_profile_id=? AND is_active=1 ORDER BY sort_order ASC,created_at ASC').bind(profileId).all()
  return c.json({ok:true,data:{access:{allowed:true},enabled,max_accounts:MAX_ACTIVE_BANK_ACCOUNTS,items:(rows.results as any[]).map(serializeOwner)}})
})

app.put('/api/v1/me/sponsored-profile/bank-accounts/settings',requireUser,async(c:any)=>{
  const profile=await resolveOwnedSponsoredProfile(c,String(c.get('userId')||''),sponsoredProfileScope(c))
  if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  if(!(await bankModuleEnabled(c,String((profile as any).sponsor_id))))return c.json({ok:false,error:'Este módulo no está habilitado para tu patrocinio.'},403)
  const body=await c.req.json().catch(()=>({}))
  const enabled=body.enabled?1:0
  const profileId=String((profile as any).id)
  await c.env.DB.prepare("INSERT INTO sponsored_bank_settings(sponsored_profile_id,is_enabled,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(sponsored_profile_id) DO UPDATE SET is_enabled=excluded.is_enabled,updated_at=datetime('now')").bind(profileId,enabled).run()
  return c.json({ok:true,enabled:Boolean(enabled)})
})

app.post('/api/v1/me/sponsored-profile/bank-accounts',requireUser,async(c:any)=>{
  const profile=await resolveOwnedSponsoredProfile(c,String(c.get('userId')||''),sponsoredProfileScope(c));if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  if(!(await bankModuleEnabled(c,String((profile as any).sponsor_id))))return c.json({ok:false,error:'Este módulo no está habilitado para tu patrocinio.'},403)
  const profileId=String((profile as any).id)
  const count=await c.env.DB.prepare('SELECT COUNT(*) AS n FROM sponsored_bank_accounts WHERE sponsored_profile_id=? AND is_active=1').bind(profileId).first()
  if(Number((count as any)?.n||0)>=MAX_ACTIVE_BANK_ACCOUNTS)return c.json({ok:false,error:'Puedes agregar un máximo de 3 cuentas.'},409)
  const body=await c.req.json().catch(()=>({}))
  const bankName=clean(body.bank_name,80),bankCode=clean(body.bank_code,40)||null,accountNumber=cleanAccountNumber(body.account_number),accountType=normalizeAccountType(body.account_type),currency=normalizeCurrency(body.currency),holderName=clean(body.holder_name,120),holderIdType=normalizeHolderIdType(body.holder_id_type),holderIdNumber=cleanHolderId(body.holder_id_number),displayMode=normalizeDisplayMode(body.display_mode||'masked')
  if(!bankName)return c.json({ok:false,error:'Selecciona el banco.'},400)
  if(accountNumber.length<4)return c.json({ok:false,error:'Número de cuenta no válido.'},400)
  if(!accountType)return c.json({ok:false,error:'Tipo de cuenta no válido.'},400)
  if(!currency)return c.json({ok:false,error:'Moneda no válida.'},400)
  if(!holderName)return c.json({ok:false,error:'Indica el titular de la cuenta.'},400)
  if(!holderIdType)return c.json({ok:false,error:'Selecciona si el titular usa Cédula o RNC.'},400)
  if(holderIdNumber.length<9)return c.json({ok:false,error:'Indica un número de Cédula o RNC válido.'},400)
  if(!displayMode)return c.json({ok:false,error:'Modo de visualización no válido.'},400)
  const sortRow=await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1) AS n FROM sponsored_bank_accounts WHERE sponsored_profile_id=?').bind(profileId).first()
  const id=crypto.randomUUID(),sortOrder=Number((sortRow as any)?.n??-1)+1
  await c.env.DB.prepare('INSERT INTO sponsored_bank_accounts(id,sponsored_profile_id,bank_code,bank_name,account_number,account_type,currency,holder_name,holder_id_type,holder_id_number,display_mode,sort_order,is_active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)').bind(id,profileId,bankCode,bankName,accountNumber,accountType,currency,holderName,holderIdType,holderIdNumber,displayMode,sortOrder).run()
  const row=await c.env.DB.prepare('SELECT * FROM sponsored_bank_accounts WHERE id=? AND sponsored_profile_id=? LIMIT 1').bind(id,profileId).first()
  return c.json({ok:true,data:serializeOwner(row)},201)
})

app.patch('/api/v1/me/sponsored-profile/bank-accounts/:id',requireUser,async(c:any)=>{
  const profile=await resolveOwnedSponsoredProfile(c,String(c.get('userId')||''),sponsoredProfileScope(c));if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  if(!(await bankModuleEnabled(c,String((profile as any).sponsor_id))))return c.json({ok:false,error:'Este módulo no está habilitado.'},403)
  const profileId=String((profile as any).id),id=String(c.req.param('id')||'')
  const existing=await c.env.DB.prepare('SELECT * FROM sponsored_bank_accounts WHERE id=? AND sponsored_profile_id=? AND is_active=1 LIMIT 1').bind(id,profileId).first();if(!existing)return c.json({ok:false,error:'Cuenta no encontrada.'},404)
  const body=await c.req.json().catch(()=>({}))
  const bankName=body.bank_name!==undefined?clean(body.bank_name,80):String((existing as any).bank_name),bankCode=body.bank_code!==undefined?(clean(body.bank_code,40)||null):((existing as any).bank_code||null),accountNumber=body.account_number!==undefined?cleanAccountNumber(body.account_number):String((existing as any).account_number),accountType=body.account_type!==undefined?normalizeAccountType(body.account_type):normalizeAccountType((existing as any).account_type),currency=body.currency!==undefined?normalizeCurrency(body.currency):normalizeCurrency((existing as any).currency),holderName=body.holder_name!==undefined?clean(body.holder_name,120):String((existing as any).holder_name),holderIdType=body.holder_id_type!==undefined?normalizeHolderIdType(body.holder_id_type):normalizeHolderIdType((existing as any).holder_id_type),holderIdNumber=body.holder_id_number!==undefined?cleanHolderId(body.holder_id_number):cleanHolderId((existing as any).holder_id_number),displayMode=body.display_mode!==undefined?normalizeDisplayMode(body.display_mode):normalizeDisplayMode((existing as any).display_mode||'masked')
  if(!bankName||accountNumber.length<4||!accountType||!currency||!holderName||!holderIdType||holderIdNumber.length<9||!displayMode)return c.json({ok:false,error:'Revisa todos los datos requeridos de la cuenta, incluyendo Cédula o RNC.'},400)
  await c.env.DB.prepare('UPDATE sponsored_bank_accounts SET bank_code=?,bank_name=?,account_number=?,account_type=?,currency=?,holder_name=?,holder_id_type=?,holder_id_number=?,display_mode=?,updated_at=datetime("now") WHERE id=? AND sponsored_profile_id=?').bind(bankCode,bankName,accountNumber,accountType,currency,holderName,holderIdType,holderIdNumber,displayMode,id,profileId).run()
  const row=await c.env.DB.prepare('SELECT * FROM sponsored_bank_accounts WHERE id=? AND sponsored_profile_id=? LIMIT 1').bind(id,profileId).first()
  return c.json({ok:true,data:serializeOwner(row)})
})

app.delete('/api/v1/me/sponsored-profile/bank-accounts/:id',requireUser,async(c:any)=>{
  const profile=await resolveOwnedSponsoredProfile(c,String(c.get('userId')||''),sponsoredProfileScope(c));if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  await c.env.DB.prepare('UPDATE sponsored_bank_accounts SET is_active=0,updated_at=datetime("now") WHERE id=? AND sponsored_profile_id=?').bind(String(c.req.param('id')||''),String((profile as any).id)).run();return c.json({ok:true})
})

app.get('/api/v1/public/sponsored/:username/bank-accounts',async(c:any)=>{
  const username=clean(c.req.param('username'),40).toLowerCase()
  const profile=await c.env.DB.prepare("SELECT sp.id,sp.sponsor_id FROM sponsored_profiles sp WHERE sp.username=? AND sp.status='published' LIMIT 1").bind(username).first();if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const profileId=String((profile as any).id)
  if(!(await bankModuleEnabled(c,String((profile as any).sponsor_id))))return c.json({ok:true,data:{enabled:false,items:[]}})
  if(!(await sectionEnabled(c,profileId)))return c.json({ok:true,data:{enabled:false,items:[]}})
  const rows=await c.env.DB.prepare('SELECT id,bank_code,bank_name,account_number,account_type,currency,holder_name,holder_id_type,display_mode,sort_order FROM sponsored_bank_accounts WHERE sponsored_profile_id=? AND is_active=1 ORDER BY sort_order ASC,created_at ASC LIMIT 3').bind(profileId).all()
  return c.json({ok:true,data:{enabled:true,items:(rows.results as any[]).map((row:any)=>{const accountNumber=String(row.account_number||'');return{id:row.id,bank_code:row.bank_code||null,bank_name:row.bank_name,account_type:row.account_type,currency:row.currency,holder_name:row.holder_name,holder_id_type:row.holder_id_type||null,display_mode:row.display_mode||'masked',display_number:(row.display_mode||'masked')==='visible'?accountNumber:maskAccountNumber(accountNumber),copy_value:accountNumber}})}})
})

app.get('/api/v1/public/sponsored/:username/bank-accounts/:id/holder-id',async(c:any)=>{
  const username=clean(c.req.param('username'),40).toLowerCase()
  const profile=await c.env.DB.prepare("SELECT sp.id,sp.sponsor_id FROM sponsored_profiles sp WHERE sp.username=? AND sp.status='published' LIMIT 1").bind(username).first();if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const profileId=String((profile as any).id)
  if(!(await bankModuleEnabled(c,String((profile as any).sponsor_id)))||!(await sectionEnabled(c,profileId)))return c.json({ok:false,error:'Datos no disponibles.'},404)
  const row=await c.env.DB.prepare('SELECT holder_id_type,holder_id_number FROM sponsored_bank_accounts WHERE id=? AND sponsored_profile_id=? AND is_active=1 LIMIT 1').bind(String(c.req.param('id')||''),profileId).first()
  const type=normalizeHolderIdType((row as any)?.holder_id_type),number=cleanHolderId((row as any)?.holder_id_number)
  if(!row||!type||!number)return c.json({ok:false,error:'Identificación no disponible.'},404)
  return c.json({ok:true,data:{type,copy_value:number}})
})

export default app
