import app from './index'
import { cookieNames } from './lib/cookies'

type EnvLike={DB:D1Database;VAPID_PRIVATE_JWK?:string;VAPID_SUBJECT?:string}
type PushPayload={title:string;body:string;url:string;tag?:string;unread_count?:number}

function b64urlToBytes(value:string){
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/')
  const padded=normalized+'='.repeat((4-normalized.length%4)%4)
  const binary=atob(padded)
  return Uint8Array.from(binary,ch=>ch.charCodeAt(0))
}
function bytesToB64url(bytes:Uint8Array){
  let binary=''
  for(const byte of bytes)binary+=String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
function textBytes(value:string){return new TextEncoder().encode(value)}
function concat(...parts:Uint8Array[]){
  const total=parts.reduce((sum,part)=>sum+part.length,0)
  const out=new Uint8Array(total);let offset=0
  for(const part of parts){out.set(part,offset);offset+=part.length}
  return out
}
async function hmac(key:Uint8Array,data:Uint8Array){
  const cryptoKey=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,data))
}
async function hkdfExpand(prk:Uint8Array,info:Uint8Array,length:number){
  const out=new Uint8Array(length)
  let previous=new Uint8Array(0),offset=0,counter=1
  while(offset<length){
    const block=await hmac(prk,concat(previous,info,new Uint8Array([counter++])))
    const take=Math.min(block.length,length-offset)
    out.set(block.slice(0,take),offset)
    offset+=take
    previous=block
  }
  return out
}
function vapidJwk(env:any){
  const raw=String(env?.VAPID_PRIVATE_JWK||'').trim()
  if(!raw)return null
  try{
    const jwk=JSON.parse(raw)
    if(jwk?.kty!=='EC'||jwk?.crv!=='P-256'||!jwk?.x||!jwk?.y||!jwk?.d)return null
    return jwk as JsonWebKey
  }catch{return null}
}
function vapidPublicBytes(jwk:JsonWebKey){
  return concat(new Uint8Array([4]),b64urlToBytes(String(jwk.x||'')),b64urlToBytes(String(jwk.y||'')))
}
function derToJose(signature:Uint8Array){
  if(signature.length===64)return signature
  if(signature[0]!==0x30)throw new Error('Firma VAPID inválida.')
  let p=2
  if(signature[1]&0x80)p=2+(signature[1]&0x7f)
  if(signature[p++]!==0x02)throw new Error('Firma VAPID inválida.')
  const rLen=signature[p++],r=signature.slice(p,p+rLen);p+=rLen
  if(signature[p++]!==0x02)throw new Error('Firma VAPID inválida.')
  const sLen=signature[p++],ss=signature.slice(p,p+sLen)
  const norm=(part:Uint8Array)=>{
    let value=part
    while(value.length>32&&value[0]===0)value=value.slice(1)
    const out=new Uint8Array(32)
    const tail=value.slice(-32)
    out.set(tail,32-tail.length)
    return out
  }
  return concat(norm(r),norm(ss))
}
async function vapidJwt(endpoint:string,jwk:JsonWebKey,subject:string){
  const origin=new URL(endpoint).origin
  const header=bytesToB64url(textBytes(JSON.stringify({typ:'JWT',alg:'ES256'})))
  const payload=bytesToB64url(textBytes(JSON.stringify({aud:origin,exp:Math.floor(Date.now()/1000)+12*60*60,sub:subject})))
  const signingInput=header+'.'+payload
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign'])
  const raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,textBytes(signingInput)))
  return signingInput+'.'+bytesToB64url(derToJose(raw))
}
async function encryptPayload(payload:string,p256dh:string,auth:string){
  const clientPublic=b64urlToBytes(p256dh),authSecret=b64urlToBytes(auth)
  const clientKey=await crypto.subtle.importKey('raw',clientPublic,{name:'ECDH',namedCurve:'P-256'},false,[])
  const ephemeral=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']) as CryptoKeyPair
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:clientKey},ephemeral.privateKey,256))
  const serverPublic=new Uint8Array(await crypto.subtle.exportKey('raw',ephemeral.publicKey))
  const prkKey=await hmac(authSecret,shared)
  const keyInfo=concat(textBytes('WebPush: info\0'),clientPublic,serverPublic)
  const ikm=await hkdfExpand(prkKey,keyInfo,32)
  const salt=crypto.getRandomValues(new Uint8Array(16))
  const prk=await hmac(salt,ikm)
  const cek=await hkdfExpand(prk,textBytes('Content-Encoding: aes128gcm\0'),16)
  const nonce=await hkdfExpand(prk,textBytes('Content-Encoding: nonce\0'),12)
  const key=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt'])
  const plaintext=concat(textBytes(payload),new Uint8Array([2]))
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128},key,plaintext))
  const recordSize=new Uint8Array([0,0,16,0])
  return concat(salt,recordSize,new Uint8Array([serverPublic.length]),serverPublic,encrypted)
}
async function sendOne(endpoint:string,p256dh:string,auth:string,payload:PushPayload,jwk:JsonWebKey,subject:string){
  const publicKey=bytesToB64url(vapidPublicBytes(jwk))
  const jwt=await vapidJwt(endpoint,jwk,subject)
  const body=await encryptPayload(JSON.stringify(payload),p256dh,auth)
  return fetch(endpoint,{method:'POST',headers:{
    TTL:'86400',
    'Content-Encoding':'aes128gcm',
    'Content-Type':'application/octet-stream',
    Authorization:'vapid t='+jwt+', k='+publicKey,
  },body})
}
export function webPushPublicKey(env:any){
  const jwk=vapidJwk(env)
  return jwk?bytesToB64url(vapidPublicBytes(jwk)):''
}
export async function sendWebPushToUser(env:EnvLike,userId:string,input:PushPayload){
  const jwk=vapidJwk(env)
  if(!jwk||!userId)return
  const subject=String(env.VAPID_SUBJECT||'mailto:noreply@intaprd.com')
  const countRow=await env.DB.prepare("SELECT COUNT(*) AS n FROM user_notifications WHERE user_id=? AND read_at IS NULL").bind(userId).first().catch(()=>null)
  const payload={...input,unread_count:Number((countRow as any)?.n||input.unread_count||1)}
  const rows=await env.DB.prepare('SELECT id,endpoint,p256dh,auth FROM user_push_subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT 8').bind(userId).all().catch(()=>({results:[]}))
  await Promise.all((rows.results||[]).map(async(row:any)=>{
    try{
      const response=await sendOne(String(row.endpoint||''),String(row.p256dh||''),String(row.auth||''),payload,jwk,subject)
      if(response.status===404||response.status===410){
        await env.DB.prepare('DELETE FROM user_push_subscriptions WHERE id=?').bind(String(row.id)).run().catch(()=>undefined)
      }else if(response.ok){
        await env.DB.prepare("UPDATE user_push_subscriptions SET last_success_at=datetime('now'),failure_count=0,updated_at=datetime('now') WHERE id=?").bind(String(row.id)).run().catch(()=>undefined)
      }else{
        await env.DB.prepare("UPDATE user_push_subscriptions SET failure_count=failure_count+1,updated_at=datetime('now') WHERE id=?").bind(String(row.id)).run().catch(()=>undefined)
      }
    }catch{
      await env.DB.prepare("UPDATE user_push_subscriptions SET failure_count=failure_count+1,updated_at=datetime('now') WHERE id=?").bind(String(row.id)).run().catch(()=>undefined)
    }
  }))
}

async function sha256Hex(input:string){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')
}
function parseCookie(header:string,name:string){
  const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&')
  const match=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'))
  return match?decodeURIComponent(match[1]):null
}
async function pushUserId(c:any){
  const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session)
  if(!raw)return''
  const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first()
  return row?String((row as any).user_id||''):''
}
async function requirePushUser(c:any,next:any){
  const userId=await pushUserId(c)
  if(!userId)return c.json({ok:false,error:'Unauthorized'},401)
  c.set('userId',userId)
  await next()
}
function validEndpoint(value:string){
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname.length>0}catch{return false}
}
app.get('/api/v1/me/push/public-key',requirePushUser,async(c:any)=>{
  const key=webPushPublicKey(c.env)
  return c.json({ok:true,data:{enabled:Boolean(key),public_key:key}})
})
app.post('/api/v1/me/push/subscribe',requirePushUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const endpoint=String(body?.endpoint||'').trim().slice(0,1800)
  const p256dh=String(body?.keys?.p256dh||'').trim().slice(0,220)
  const auth=String(body?.keys?.auth||'').trim().slice(0,120)
  if(!validEndpoint(endpoint)||!p256dh||!auth)return c.json({ok:false,error:'Suscripción push inválida.'},422)
  const existing=await c.env.DB.prepare('SELECT id FROM user_push_subscriptions WHERE endpoint=? LIMIT 1').bind(endpoint).first()
  if(existing){
    await c.env.DB.prepare("UPDATE user_push_subscriptions SET user_id=?,p256dh=?,auth=?,user_agent=?,updated_at=datetime('now'),failure_count=0 WHERE id=?").bind(userId,p256dh,auth,String(c.req.header('User-Agent')||'').slice(0,240),String((existing as any).id)).run()
  }else{
    await c.env.DB.prepare('INSERT INTO user_push_subscriptions(id,user_id,endpoint,p256dh,auth,user_agent) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,endpoint,p256dh,auth,String(c.req.header('User-Agent')||'').slice(0,240)).run()
  }
  const extras=await c.env.DB.prepare('SELECT id FROM user_push_subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT -1 OFFSET 8').bind(userId).all().catch(()=>({results:[]}))
  for(const row of extras.results||[])await c.env.DB.prepare('DELETE FROM user_push_subscriptions WHERE id=?').bind(String((row as any).id)).run().catch(()=>undefined)
  return c.json({ok:true})
})
app.post('/api/v1/me/push/unsubscribe',requirePushUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const endpoint=String(body?.endpoint||'').trim().slice(0,1800)
  if(endpoint)await c.env.DB.prepare('DELETE FROM user_push_subscriptions WHERE user_id=? AND endpoint=?').bind(userId,endpoint).run()
  return c.json({ok:true})
})

export default app
