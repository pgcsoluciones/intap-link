import app from './index'

const MAX_MEDIA_BYTES=10*1024*1024
const MAX_UPLOADS_PER_HOUR=8
const EXPIRY_HOURS=72

type QuoteMediaKind='image'|'document'|'audio'

function cleanUsername(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function cleanName(value:unknown){return String(value??'media').replace(/[\r\n"\\/]/g,' ').trim().slice(0,120)||'media'}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function randomCodePart(bytes=16){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function safeIp(c:any){return String(c.req.header('CF-Connecting-IP')||c.req.header('X-Forwarded-For')||'unknown').split(',')[0].trim().slice(0,100)}
function kindPrefix(kind:QuoteMediaKind){return kind==='audio'?'AUD':kind==='image'?'IMG':'AR'}
function isModernCode(value:string){return /^(AUD|IMG|AR)-[A-Za-z0-9_-]{20,24}$/.test(value)}
function isLegacyToken(value:string){return /^[a-f0-9]{48}$/i.test(value)}

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

function mediaUrl(c:any,code:string){
  const origin=new URL(c.req.url).origin
  return `${origin}/media/${encodeURIComponent(code)}`
}

async function mediaRow(c:any,code:string){
  if(!isModernCode(code)&&!isLegacyToken(code))return null
  const tokenHash=await sha256Hex(code)
  return c.env.DB.prepare(`SELECT r2_key,media_kind,content_type,original_name,size_bytes,expires_at FROM sponsored_quote_media WHERE token_hash=? AND expires_at>datetime('now') LIMIT 1`).bind(tokenHash).first()
}

function fileHeaders(row:any,download=false){
  const headers=new Headers()
  const contentType=String(row?.content_type||'application/octet-stream')
  const filename=cleanName(row?.original_name)
  headers.set('Content-Type',contentType)
  headers.set('Content-Disposition',`${download?'attachment':'inline'}; filename="${filename}"`)
  headers.set('Cache-Control','private, no-store, max-age=0')
  headers.set('X-Content-Type-Options','nosniff')
  headers.set('X-Kawvo-Expires-At',String(row?.expires_at||''))
  return headers
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

  const code=`${kindPrefix(spec.kind)}-${randomCodePart()}`
  const tokenHash=await sha256Hex(code)
  const id=crypto.randomUUID()
  const datePrefix=new Date().toISOString().slice(0,10)
  const key=`quote-media/${profileId}/${datePrefix}/${id}.${spec.ext}`
  const originalName=cleanName(file.name)
  const expiresAt=new Date(Date.now()+EXPIRY_HOURS*60*60*1000).toISOString().slice(0,19).replace('T',' ')

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
  return c.json({ok:true,data:{url:mediaUrl(c,code),code,kind:spec.kind,name:originalName,size_bytes:size,expires_at:expiresAt}})
})

app.get('/api/v1/public/sponsored/quote-media/:code/meta',async(c:any)=>{
  const code=String(c.req.param('code')||'')
  const row=await mediaRow(c,code)
  if(!row)return c.json({ok:false,error:'Este media no está disponible o ya venció.'},404)
  return c.json({ok:true,data:{
    code,
    kind:String((row as any).media_kind||'document'),
    content_type:String((row as any).content_type||'application/octet-stream'),
    name:cleanName((row as any).original_name),
    size_bytes:Number((row as any).size_bytes||0),
    expires_at:String((row as any).expires_at||''),
    file_url:`/api/v1/public/sponsored/quote-media/${encodeURIComponent(code)}/file`,
    download_url:`/api/v1/public/sponsored/quote-media/${encodeURIComponent(code)}/download`,
  }})
})

app.get('/api/v1/public/sponsored/quote-media/:code/file',async(c:any)=>{
  const code=String(c.req.param('code')||'')
  const row=await mediaRow(c,code)
  if(!row)return c.body(null,404)
  const object=await c.env.BUCKET.get(String((row as any).r2_key||''))
  if(!object)return c.body(null,404)
  return new Response(object.body,{headers:fileHeaders(row,false)})
})

app.get('/api/v1/public/sponsored/quote-media/:code/download',async(c:any)=>{
  const code=String(c.req.param('code')||'')
  const row=await mediaRow(c,code)
  if(!row)return c.body(null,404)
  const object=await c.env.BUCKET.get(String((row as any).r2_key||''))
  if(!object)return c.body(null,404)
  return new Response(object.body,{headers:fileHeaders(row,true)})
})

// Compatibility for links created during Preview before the short /media/CODE viewer existed.
app.get('/api/v1/public/sponsored/quote-media/:token',async(c:any)=>{
  const token=String(c.req.param('token')||'')
  if(!isLegacyToken(token))return c.body(null,404)
  const row=await mediaRow(c,token)
  if(!row)return c.body(null,404)
  const object=await c.env.BUCKET.get(String((row as any).r2_key||''))
  if(!object)return c.body(null,404)
  return new Response(object.body,{headers:fileHeaders(row,false)})
})

export async function cleanupExpiredSponsoredQuoteMedia(env:any){
  for(let pass=0;pass<10;pass++){
    const rows=await env.DB.prepare(`SELECT id,r2_key FROM sponsored_quote_media WHERE expires_at<=datetime('now') ORDER BY expires_at ASC LIMIT 100`).all().catch(()=>({results:[]}))
    const items=Array.isArray((rows as any).results)?(rows as any).results:[]
    if(!items.length)break
    for(const row of items){
      const id=String((row as any).id||'')
      const key=String((row as any).r2_key||'')
      try{
        if(key)await env.BUCKET.delete(key)
      }catch(error){
        console.error('[quote-media cleanup] R2',key,error)
        continue
      }
      await env.DB.prepare(`DELETE FROM sponsored_quote_media WHERE id=? AND expires_at<=datetime('now')`).bind(id).run().catch((error:any)=>console.error('[quote-media cleanup] D1',id,error))
    }
    if(items.length<100)break
  }
}

export default app
