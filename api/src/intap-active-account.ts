import { cookieNames } from './lib/cookies'

/**
 * Single active account for the designated INTAP multicuenta operator.
 * No account is selected implicitly; selection expires with the login session.
 * This is a routing isolation marker, never a substitute for DB ownership checks.
 */
export type IntapAccountKind='medical'|'medical_master'|'sponsor'|'sponsored'|'free'|'paid'|'trial'
export type IntapSelection={kind:IntapAccountKind;id:string;tabToken?:string}
const KEY='kawvo_intap_active_account_v1'
const validKinds=new Set<string>(['medical','medical_master','sponsor','sponsored','free','paid','trial'])
function cookieValue(header:string,name:string):string{
  const match=header.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))
  if(!match)return''
  try{return decodeURIComponent(match.slice(name.length+1))}catch{return''}
}
async function sessionFingerprint(c:any):Promise<string>{
  const raw=cookieValue(String(c.req.header('Cookie')||''),cookieNames(c.env).session)
  if(!raw)return''
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24)
}
export async function readIntapSelection(c:any):Promise<IntapSelection|null>{
  const value=cookieValue(String(c.req.header('Cookie')||''),KEY)
  const m=value.match(/^(medical_master|medical|sponsor|sponsored|free|paid|trial):([a-f0-9-]{36}):([a-f0-9]{24}):([a-f0-9]{32})$/i)
  if(!m||!validKinds.has(m[1]))return null
  const fingerprint=await sessionFingerprint(c)
  if(!fingerprint||m[3]!==fingerprint)return null
  return{kind:m[1] as IntapAccountKind,id:m[2],tabToken:m[4]}
}
export async function setIntapSelection(c:any,selection:IntapSelection):Promise<string>{
  if(!validKinds.has(selection.kind)||!/^[a-f0-9-]{36}$/i.test(selection.id))return ''
  const fingerprint=await sessionFingerprint(c)
  if(!fingerprint)return ''
  // Rotates on every explicit choice, even when reselecting the same account.
  // A form left in another tab holds the previous token and cannot write.
  const tabToken=crypto.randomUUID().replace(/-/g,'')
  c.header('Set-Cookie',KEY+'='+encodeURIComponent(selection.kind+':'+selection.id+':'+fingerprint+':'+tabToken)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200',{append:true})
  return tabToken
}
export function matchesActiveIntapTab(c:any,selection:IntapSelection|null):boolean{
  const received=String(c.req.header('X-Intap-Account-Tab')||'').trim()
  return Boolean(selection?.tabToken&&received&&received===selection.tabToken)
}
export function clearIntapSelection(c:any){
  c.header('Set-Cookie',KEY+'=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',{append:true})
}
export async function requireIntapKind(c:any,userId:string,kind:IntapAccountKind):Promise<IntapSelection|null>{
  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  if(String((user as any)?.email||'').trim().toLowerCase()!=='intapcard@gmail.com')return null
  const selection=await readIntapSelection(c)
  return selection?.kind===kind?selection:null
}
