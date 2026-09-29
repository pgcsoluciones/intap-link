import app from './index'

const MAX_MEDIA_BYTES=10*1024*1024
const MAX_UPLOADS_PER_HOUR=8
const EXPIRY_HOURS=72

type QuoteMediaKind='image'|'document'|'audio'

function cleanUsername(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function cleanName(value:unknown){return String(value??'media').replace(/[\r\n"\\/]/g,' ').trim().slice(0,120)||'media'}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function randomToken(bytes=24){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return Array.from(data).map(b=>b.toString(16).padStart(2,'0')).join('')}
function safeIp(c:any){return String(c.req.header('CF-Connecting-IP')||c.req.header('X-Forwarded-For')||'unknown').split(',')[0].trim().slice(0,100)}

function mediaSpec(file:File):{kind:QuoteMediaKind;ext:string;contentType:string}|null{
  const type=String(file.type||'').toLowerCase()
  const name=String(file.name||'').toLowerCase()
  if(type==='image/jpeg'||/\.(jpe?g)$/.test(name))return{kind:'image',ext:'jpg',contentType:'image/jpeg'}
  if(type==='image/png'||/\.png$/.test(name))return{kind:'image',ext:'png',contentType:'image/png'}
  if(type==='image/webp'||/\.webp$/.test(name))return{kind:'image',ext:'webp',contentType:'image/webp'}
  if(type==='application/pdf'||/\.pdf$/.test(name))return{kind:'document',ext:'pdf',contentType:'application/pdf'}
  if(type==='audio/webm'||/\.webm$/.test(name))return{kind:'audio',ext:'webm',contentType:type||'audio/webm'}
  if(type==='audio/ogg'||/\.ogg$/.test(name))return{kind:'audio',ext:'ogg',contentType:'audio/ogg'}
  if(type==='audio/mpeg'||/\.mp3$/.test(name))return{kind:'audio',ext:'mp3',contentType:'audio/mpeg'}
  if(type==='audio/mp4'||type==='audio/x-m4a'||/\.m4a$/.test(name))return{kind:'audio',ext:'m4a',contentType:type||'audio/mp4'}
  if(type==='audio/wav'||type==='audio/x-wav'||/\.wav$/.test(name))return{kind:'audio',ext:'wav',contentType:'audio/wav'}
  return null
}

function mediaUrl(c:any,username:string,token:string){
  const origin=new URL(c.req.url).origin
  return `${origin}/api/v1/public/sponsored/${encodeURIComponent(username)}/quote-media/${encodeURIComponent(token)}`
}

app.post('/api/v1/public/sponsored/:username/quote-media',async(c:any)=>{
  const username=cleanUsername(c.req.param('username'))
  if(!username)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const profile=await c.env.DB.prepare(`SELECT id FROM sponsored_profiles WHERE username=? AND status='published' LIMIT 1`).bind(username).first()
  if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)

  const fd=await c.req.formData().catch(()=>null)
  const raw=fd?.get('file')
  if(!(raw&&typeof raw==='object'&&'stream' in (raw as any)))return c.json({ok:false,error:'Adjunta una foto, PDF o audio.'},400)
  const file=raw as File
  const spec=mediaSpec(file)
  if(!spec)return c.json({ok:false,error:'Formato no permitido. Usa imagen, PDF o audio.'},415)
  const size=Number((file as any).size||0)
  if(size<=0)return c.json({ok:false,error:'El archivo está vacío.'},400)
  if(size>MAX_MEDIA_BYTES)return c.json({ok:false,error:'El archivo supera el límite de 10 MB.'},413)

  const profileId=String((profile as any).id)
  const ipHash=await sha256Hex(safeIp(c))
  const recent=await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sponsored_quote_media WHERE profile_id=? AND ip_hash=? AND created_at>datetime('now','-1 hour')`).bind(profileId,ipHash).first()
  if(Number((recent as any)?.n||0)>=MAX_UPLOADS_PER_HOUR)return c.json({ok:false,error:'Has realizado varios adjuntos recientemente. Intenta nuevamente más tarde.'},429)

  const token=randomToken()
  const tokenHash=await sha256Hex(token)
  const id=crypto.randomUUID()
  const datePrefix=new Date().toISOString().slice(0,10)
  const key=`quote-media/${profileId}/${datePrefix}/${id}.${spec.ext}`
  const originalName=cleanName(file.name)
  const expiresAt=new Date(Date.now()+EXPIRY_HOURS*60*60*1000).toISOString()

  await c.env.BUCKET.put(key,file.stream(),{
    httpMetadata:{contentType:spec.contentType},
    customMetadata:{expires_at:expiresAt,kind:spec.kind}
  })
  try{
    await c.env.DB.prepare(`INSERT INTO sponsored_quote_media (id,profile_id,token_hash,r2_key,media_kind,content_type,original_name,size_bytes,ip_hash,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,profileId,tokenHash,key,spec.kind,spec.contentType,originalName,size,ipHash,expiresAt).run()
  }catch(error){
    await c.env.BUCKET.delete(key).catch(()=>undefined)
    throw error
  }
  return c.json({ok:true,data:{url:mediaUrl(c,username,token),kind:spec.kind,name:originalName,size_bytes:size,expires_at:expiresAt}})
})

app.get('/api/v1/public/sponsored/:username/quote-media/:token',async(c:any)=>{
  const username=cleanUsername(c.req.param('username'))
  const token=String(c.req.param('token')||'')
  if(!username||!/^[a-f0-9]{48}$/i.test(token))return c.body(null,404)
  const tokenHash=await sha256Hex(token)
  const row=await c.env.DB.prepare(`SELECT qm.r2_key,qm.content_type,qm.original_name,qm.expires_at FROM sponsored_quote_media qm JOIN sponsored_profiles sp ON sp.id=qm.profile_id WHERE sp.username=? AND qm.token_hash=? AND qm.expires_at>datetime('now') LIMIT 1`).bind(username,tokenHash).first()
  if(!row)return c.body(null,404)
  const object=await c.env.BUCKET.get(String((row as any).r2_key||''))
  if(!object)return c.body(null,404)
  const headers=new Headers()
  headers.set('Content-Type',String((row as any).content_type||object.httpMetadata?.contentType||'application/octet-stream'))
  headers.set('Content-Disposition',`inline; filename="${cleanName((row as any).original_name)}"`)
  headers.set('Cache-Control','private, no-store, max-age=0')
  headers.set('X-Content-Type-Options','nosniff')
  headers.set('X-Kawvo-Expires-At',String((row as any).expires_at||''))
  return new Response(object.body,{headers})
})

export async function cleanupExpiredSponsoredQuoteMedia(env:any){
  for(let pass=0;pass<10;pass++){
    const rows=await env.DB.prepare(`SELECT id,r2_key FROM sponsored_quote_media WHERE expires_at<=datetime('now') ORDER BY expires_at ASC LIMIT 100`).all().catch(()=>({results:[]}))
    const items=Array.isArray((rows as any).results)?(rows as any).results:[]
    if(!items.length)break
    for(const row of items){
      const id=String((row as any).id||'')
      const key=String((row as any).r2_key||'')
      if(key)await env.BUCKET.delete(key).catch((error:any)=>console.error('[quote-media cleanup] R2',key,error))
      await env.DB.prepare(`DELETE FROM sponsored_quote_media WHERE id=? AND expires_at<=datetime('now')`).bind(id).run().catch((error:any)=>console.error('[quote-media cleanup] D1',id,error))
    }
    if(items.length<100)break
  }
}

export default app
