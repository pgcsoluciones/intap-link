import app from './index'
import { cookieNames } from './lib/cookies'

const MAX_ACTIVE_BANK_ACCOUNTS=3

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
function clean(v:unknown,max=160){return String(v??'').trim().slice(0,max)}
async function ownedProfile(c:any,userId:string){return c.env.DB.prepare(`SELECT sp.id,sp.sponsor_id FROM sponsored_profiles sp WHERE sp.user_id=? ORDER BY sp.created_at DESC LIMIT 1`).bind(userId).first()}
async function bankEnabled(c:any,sponsorId:string){const row=await c.env.DB.prepare(`SELECT enabled FROM sponsor_module_grants WHERE sponsor_id=? AND module_code='bank_accounts' LIMIT 1`).bind(sponsorId).first();return Number((row as any)?.enabled||0)===1}

app.get('/api/v1/me/sponsored-profile/bank-accounts',requireUser,async(c:any)=>{
  const profile=await ownedProfile(c,String(c.get('userId')||''));if(!profile)return c.json({ok:true,data:{enabled:false,items:[],max_active:MAX_ACTIVE_BANK_ACCOUNTS}})
  const enabled=await bankEnabled(c,String((profile as any).sponsor_id));if(!enabled)return c.json({ok:true,data:{enabled:false,items:[],max_active:MAX_ACTIVE_BANK_ACCOUNTS}})
  const rows=await c.env.DB.prepare(`SELECT id,bank_name,account_number,account_type,currency,holder_name,sort_order FROM sponsored_bank_accounts WHERE sponsored_profile_id=? AND is_active=1 ORDER BY sort_order ASC,created_at ASC`).bind(String((profile as any).id)).all()
  return c.json({ok:true,data:{enabled:true,items:rows.results||[],max_active:MAX_ACTIVE_BANK_ACCOUNTS}})
})

app.post('/api/v1/me/sponsored-profile/bank-accounts',requireUser,async(c:any)=>{
  const profile=await ownedProfile(c,String(c.get('userId')||''));if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  if(!(await bankEnabled(c,String((profile as any).sponsor_id))))return c.json({ok:false,error:'Este módulo no está habilitado para tu patrocinio.'},403)
  const count=await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sponsored_bank_accounts WHERE sponsored_profile_id=? AND is_active=1`).bind(String((profile as any).id)).first();if(Number((count as any)?.n||0)>=MAX_ACTIVE_BANK_ACCOUNTS)return c.json({ok:false,error:`Puedes mantener hasta ${MAX_ACTIVE_BANK_ACCOUNTS} cuentas bancarias activas.`},409)
  const body=await c.req.json().catch(()=>({}));const bankName=clean(body.bank_name,100);const accountNumber=clean(body.account_number,60);const holderName=clean(body.holder_name,120);const accountType=body.account_type==='checking'?'checking':'savings';const currency=body.currency==='USD'?'USD':'DOP'
  if(!bankName||!accountNumber||!holderName)return c.json({ok:false,error:'Banco, número de cuenta y titular son requeridos.'},422)
  const id=crypto.randomUUID();await c.env.DB.prepare(`INSERT INTO sponsored_bank_accounts(id,sponsored_profile_id,bank_name,account_number,account_type,currency,holder_name,sort_order) VALUES(?,?,?,?,?,?,?,?)`).bind(id,String((profile as any).id),bankName,accountNumber,accountType,currency,holderName,Number(body.sort_order||0)).run()
  return c.json({ok:true,data:{id}},201)
})

app.patch('/api/v1/me/sponsored-profile/bank-accounts/:id',requireUser,async(c:any)=>{
  const profile=await ownedProfile(c,String(c.get('userId')||''));if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  if(!(await bankEnabled(c,String((profile as any).sponsor_id))))return c.json({ok:false,error:'Este módulo no está habilitado.'},403)
  const body=await c.req.json().catch(()=>({}));const existing=await c.env.DB.prepare(`SELECT * FROM sponsored_bank_accounts WHERE id=? AND sponsored_profile_id=? AND is_active=1 LIMIT 1`).bind(String(c.req.param('id')||''),String((profile as any).id)).first();if(!existing)return c.json({ok:false,error:'Cuenta no encontrada.'},404)
  const bankName=body.bank_name!==undefined?clean(body.bank_name,100):String((existing as any).bank_name);const accountNumber=body.account_number!==undefined?clean(body.account_number,60):String((existing as any).account_number);const holderName=body.holder_name!==undefined?clean(body.holder_name,120):String((existing as any).holder_name);const accountType=body.account_type!==undefined?(body.account_type==='checking'?'checking':'savings'):String((existing as any).account_type);const currency=body.currency!==undefined?(body.currency==='USD'?'USD':'DOP'):String((existing as any).currency);const sortOrder=body.sort_order!==undefined?Number(body.sort_order||0):Number((existing as any).sort_order||0)
  if(!bankName||!accountNumber||!holderName)return c.json({ok:false,error:'Completa todos los campos requeridos.'},422)
  await c.env.DB.prepare(`UPDATE sponsored_bank_accounts SET bank_name=?,account_number=?,account_type=?,currency=?,holder_name=?,sort_order=?,updated_at=datetime('now') WHERE id=? AND sponsored_profile_id=?`).bind(bankName,accountNumber,accountType,currency,holderName,sortOrder,String(c.req.param('id')||''),String((profile as any).id)).run();return c.json({ok:true})
})

app.delete('/api/v1/me/sponsored-profile/bank-accounts/:id',requireUser,async(c:any)=>{
  const profile=await ownedProfile(c,String(c.get('userId')||''));if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  await c.env.DB.prepare(`UPDATE sponsored_bank_accounts SET is_active=0,updated_at=datetime('now') WHERE id=? AND sponsored_profile_id=?`).bind(String(c.req.param('id')||''),String((profile as any).id)).run();return c.json({ok:true})
})

app.get('/api/v1/public/sponsored/:username/bank-accounts',async(c:any)=>{
  const username=clean(c.req.param('username'),40).toLowerCase();const profile=await c.env.DB.prepare(`SELECT sp.id,sp.sponsor_id FROM sponsored_profiles sp WHERE sp.username=? AND sp.status='published' LIMIT 1`).bind(username).first();if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  if(!(await bankEnabled(c,String((profile as any).sponsor_id))))return c.json({ok:true,data:{enabled:false,items:[],max_active:MAX_ACTIVE_BANK_ACCOUNTS}})
  const rows=await c.env.DB.prepare(`SELECT id,bank_name,account_number,account_type,currency,holder_name,sort_order FROM sponsored_bank_accounts WHERE sponsored_profile_id=? AND is_active=1 ORDER BY sort_order ASC,created_at ASC`).bind(String((profile as any).id)).all();return c.json({ok:true,data:{enabled:true,items:rows.results||[],max_active:MAX_ACTIVE_BANK_ACCOUNTS}})
})

export default app
