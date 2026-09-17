import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return match?decodeURIComponent(match[1]):null}
async function userId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireAuth(c:any,next:any){const id=await userId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
function fileExt(file:File){const fromName=String(file.name||'').split('.').pop()?.toLowerCase()||'';if(['jpg','jpeg','png','webp'].includes(fromName))return fromName;const byType:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return byType[file.type]||''}
async function readImage(c:any){const fd=await c.req.formData();const raw=fd.get('file');if(!(raw&&typeof raw==='object'&&'stream' in (raw as any)))return {error:'Archivo requerido.',status:400 as const};const file=raw as File;const ext=fileExt(file);if(!ext)return {error:'Formato no permitido. Usa JPG, PNG o WEBP.',status:400 as const};if(Number((file as any).size||0)>8*1024*1024)return {error:'La imagen supera 8 MB.',status:413 as const};return {file,ext}}
function assetUrl(c:any,key:string){const origin=new URL(c.req.url).origin;const encoded=key.split('/').map(encodeURIComponent).join('/');return `${origin}/api/v1/public/assets/${encoded}`}

app.post('/api/v1/me/sponsored-profile/media',requireAuth,async(c:any)=>{
  const requester=String(c.get('userId')||'');const profile=await c.env.DB.prepare(`SELECT id FROM sponsored_profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1`).bind(requester).first();if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  const kind=String(c.req.query('kind')||'gallery');if(!['avatar','hero','gallery'].includes(kind))return c.json({ok:false,error:'Tipo de imagen no válido.'},400)
  const read=await readImage(c);if('error' in read)return c.json({ok:false,error:read.error},read.status)
  const profileId=String((profile as any).id);const key=`sponsored/${profileId}/${kind}/${crypto.randomUUID()}.${read.ext}`
  await c.env.BUCKET.put(key,read.file.stream(),{httpMetadata:{contentType:read.file.type||'image/jpeg'}})
  return c.json({ok:true,url:assetUrl(c,key),key})
})

app.post('/api/v1/sponsor/media',requireAuth,async(c:any)=>{
  const requester=String(c.get('userId')||'');const membership=await c.env.DB.prepare(`SELECT sponsor_id,role FROM sponsor_members WHERE user_id=? AND status='active' LIMIT 1`).bind(requester).first();if(!membership||!['owner','admin'].includes(String((membership as any).role)))return c.json({ok:false,error:'No tienes permiso para editar el patrocinio.'},403)
  const kind=String(c.req.query('kind')||'banner');if(!['logo','banner'].includes(kind))return c.json({ok:false,error:'Tipo de imagen no válido.'},400)
  const read=await readImage(c);if('error' in read)return c.json({ok:false,error:read.error},read.status)
  const sponsorId=String((membership as any).sponsor_id);const key=`sponsors/${sponsorId}/${kind}/${crypto.randomUUID()}.${read.ext}`
  await c.env.BUCKET.put(key,read.file.stream(),{httpMetadata:{contentType:read.file.type||'image/jpeg'}})
  return c.json({ok:true,url:assetUrl(c,key),key})
})

export default app