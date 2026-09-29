import app from './index'

const MAX_MEDIA_BYTES=10*1024*1024
const MAX_UPLOADS_PER_HOUR=12
const EXPIRY_HOURS=72

type QuoteMediaKind='image'|'document'|'audio'

function cleanUsername(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function cleanName(value:unknown){return String(value??'media').replace(/[\r\n"\\/]/g,' ').trim().slice(0,120)||'media'}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function randomCodePart(bytes=16){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function safeIp(c:any){return String(c.req.header('CF-Connecting-IP')||c.req.header('X-Forwarded-For')||'unknown').split(',')[0].trim().slice(0,100)}
function kindPrefix(kind:QuoteMediaKind){return kind==='audio'?'AUD':kind==='image'?'IMG':'AR'}
function mediaBatchLimit(kind:QuoteMediaKind){return kind==='image'?3:kind==='document'?2:1}
function isModernCode(value:string){return /^(AUD|IMG|AR)-[A-Za-z0-9_-]{20,24}$/.test(value)}
function isLegacyToken(value:string){return /^[a-f0-9]{48}$/i.test(value)}

function mediaSpec(file:File):{kind:QuoteMediaKind;ext:string;contentType:string}|null{
  const type=String(file.type||'').toLowerCase()
  const mime=type.split(';',1)[0].trim()
  const name=String(file.name||'').toLowerCase()
  if(mime==='image/jpeg'||/\.(jpe?g)$/.test(name))return{kind:'image',ext:'jpg',contentType:'image/jpeg'}
  if(mime==='image/png'||/\.png$/.test(name))return{kind:'image',ext:'png',contentType:'image/png'}
  if(mime==='image/webp'||/\.webp$/.test(name))return{kind:'image',ext:'webp',contentType:'image/webp'}
  if(mime==='application/pdf'||/\.pdf$/.test(name))return{kind:'document',ext:'pdf',contentType:'application/pdf'}
  if(mime==='audio/webm'||/\.webm$/.test(name))return{kind:'audio',ext:'webm',contentType:type||'audio/webm'}
  if(mime==='audio/ogg'||/\.ogg$/.test(name))return{kind:'audio',ext:'ogg',contentType:'audio/ogg'}
  if(mime==='audio/mpeg'||/\.mp3$/.test(name))return{kind:'audio',ext:'mp3',contentType:'audio/mpeg'}
  if(mime==='audio/mp4'||mime==='audio/x-m4a'||/\.m4a$/.test(name))return{kind:'audio',ext:'m4a',contentType:type||'audio/mp4'}
  if(mime==='audio/wav'||mime==='audio/x-wav'||/\.wav$/.test(name))return{kind:'audio',ext:'wav',contentType:'audio/wav'}
  return null
}

function mediaUrl(c:any,code:string){
  const origin=new URL(c.req.url).origin
  return `${origin}/${encodeURIComponent(code)}`
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
  const raws=(fd?.getAll('file')||[]).filter((item:any)=>item&&typeof item==='object'&&'stream' in item) as File[]
  if(!raws.length)return c.json({ok:false,error:'Adjunta una imagen, PDF o audio.'},400)

  const specs=raws.map(file=>mediaSpec(file))
  if(specs.some(spec=>!spec))return c.json({ok:false,error:'Formato no permitido. Usa imagen, PDF o audio.'},415)
  const kinds=specs.map(spec=>spec!.kind)
  const kind=kinds[0] as QuoteMediaKind
  if(kinds.some(item=>item!==kind))return c.json({ok:false,error:'Adjunta un solo tipo de media por solicitud.'},400)

  const batchLimit=mediaBatchLimit(kind)
  if(raws.length>batchLimit){
    const error=kind==='image'?'Puedes adjuntar hasta 3 imágenes por solicitud.':kind==='document'?'Puedes adjuntar hasta 2 archivos por solicitud.':'Puedes adjuntar un solo audio por solicitud.'
    return c.json({ok:false,error},400)
  }

  for(const file of raws){
    const size=Number((file as any).size||0)
    if(size<=0)return c.json({ok:false,error:'Uno de los archivos está vacío.'},400)
    if(size>MAX_MEDIA_BYTES)return c.json({ok:false,error:'Cada archivo debe pesar 10 MB o menos después de optimizarse.'},413)
  }

  const profileId=String((profile as any).id)
  const ipHash=await sha256Hex(safeIp(c))
  const recent=await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sponsored_quote_media WHERE profile_id=? AND ip_hash=? AND created_at>datetime('now','-1 hour')`).bind(profileId,ipHash).first()
  if(Number((recent as any)?.n||0)+raws.length>MAX_UPLOADS_PER_HOUR)return c.json({ok:false,error:'Has realizado varios adjuntos recientemente. Intenta nuevamente más tarde.'},429)

  if(kind==='image'){
    const daily=await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sponsored_quote_media WHERE profile_id=? AND ip_hash=? AND media_kind='image' AND created_at>datetime('now','-24 hours')`).bind(profileId,ipHash).first()
    const used=Number((daily as any)?.n||0)
    if(used+raws.length>9){
      const remaining=Math.max(0,9-used)
      return c.json({ok:false,error:remaining? `Puedes adjuntar hasta ${remaining} imagen${remaining===1?'':'es'} más durante este período de 24 horas.`:'Ya alcanzaste el máximo de 9 imágenes en 24 horas para este perfil.'},429)
    }
  }

  const datePrefix=new Date().toISOString().slice(0,10)
  const expiresAt=new Date(Date.now()+EXPIRY_HOURS*60*60*1000).toISOString().slice(0,19).replace('T',' ')
  const pending=raws.map((file,index)=>{
    const spec=specs[index]!
    const code=`${kindPrefix(spec.kind)}-${randomCodePart()}`
    const id=crypto.randomUUID()
    const key=`quote-media/${profileId}/${datePrefix}/${id}.${spec.ext}`
    return {file,spec,code,id,key,originalName:cleanName(file.name)}
  })
  const uploaded:string[]=[]
  try{
    for(const item of pending){
      await c.env.BUCKET.put(item.key,item.file.stream(),{
        httpMetadata:{contentType:item.spec.contentType},
        customMetadata:{expires_at:expiresAt,kind:item.spec.kind}
      })
      uploaded.push(item.key)
    }
    const statements=[]
    for(const item of pending){
      const tokenHash=await sha256Hex(item.code)
      statements.push(c.env.DB.prepare(`INSERT INTO sponsored_quote_media (id,profile_id,token_hash,r2_key,media_kind,content_type,original_name,size_bytes,ip_hash,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(item.id,profileId,tokenHash,item.key,item.spec.kind,item.spec.contentType,item.originalName,Number((item.file as any).size||0),ipHash,expiresAt))
    }
    await c.env.DB.batch(statements)
  }catch(error){
    await Promise.all(uploaded.map(key=>c.env.BUCKET.delete(key).catch(()=>undefined)))
    if(pending.length){
      const ids=pending.map(item=>item.id)
      for(const id of ids)await c.env.DB.prepare(`DELETE FROM sponsored_quote_media WHERE id=?`).bind(id).run().catch(()=>undefined)
    }
    throw error
  }

  const items=pending.map(item=>({url:mediaUrl(c,item.code),code:item.code,kind:item.spec.kind,name:item.originalName,size_bytes:Number((item.file as any).size||0),expires_at:expiresAt}))
  return c.json({ok:true,data:{items,...(items.length===1?items[0]:{})}})
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
