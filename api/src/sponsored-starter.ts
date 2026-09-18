import app from './index'
import { cookieNames } from './lib/cookies'
import { resolveFreeStarterContent } from '../../shared/free-profile-starter-content'
import { FREE_PROFILE_STARTER_ASSETS } from '../../shared/free-profile-starter-assets'

const USERNAME_RE=/^[a-z0-9][a-z0-9-]{2,29}$/
const RESERVED=new Set(['admin','api','app','www','superadmin','support','demo','med','p','l'])

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
function cleanUsername(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function starterAssetUrl(c:any,path:string){const base=String(c.env.WEB_PAGES_ORIGIN||c.env.WEB_URL||'').replace(/\/$/,'');if(!base)throw new Error('Web origin unavailable');return `${base}${path}`}
function sponsoredPalette(freePalette:string){if(freePalette==='esmeralda')return'teal';if(freePalette==='grafito')return'slate';if(freePalette==='arena')return'gold';if(freePalette==='violeta'||freePalette==='coral')return'burgundy';return'blue'}

app.post('/api/v1/me/sponsored-profile/starter',async(c:any)=>{
  const userId=await sessionUserId(c);if(!userId)return c.json({ok:false,error:'Unauthorized'},401)
  const body=await c.req.json().catch(()=>({}))
  const username=cleanUsername(body.username)
  const category=String(body.category||'').trim()
  if(!USERNAME_RE.test(username)||RESERVED.has(username))return c.json({ok:false,error:'Elige un usuario válido de 3 a 30 caracteres.'},422)
  const profile=await c.env.DB.prepare(`SELECT id,profile_role,business_name,username FROM sponsored_profiles WHERE user_id=? ORDER BY CASE WHEN profile_role='sponsor_owner' THEN 0 ELSE 1 END,created_at DESC LIMIT 1`).bind(userId).first()
  if(!profile)return c.json({ok:false,error:'No tienes un perfil patrocinado activo.'},404)
  const currentUsername=cleanUsername((profile as any).username)
  if(currentUsername)return c.json({ok:true,data:{username:currentUsername,already_ready:true}})
  const occupied=await c.env.DB.prepare(`SELECT id FROM sponsored_profiles WHERE username=? AND id<>? LIMIT 1`).bind(username,String((profile as any).id)).first()
  if(occupied)return c.json({ok:false,error:'Ese usuario ya está ocupado.'},409)

  const role=String((profile as any).profile_role||'beneficiary')
  if(role==='sponsor_owner'){
    await c.env.DB.prepare(`UPDATE sponsored_profiles SET username=?,status='draft',updated_at=datetime('now') WHERE id=?`).bind(username,String((profile as any).id)).run()
    return c.json({ok:true,data:{username,starter:true,sponsor_owner:true}})
  }

  if(!category)return c.json({ok:false,error:'Selecciona a qué te dedicas.'},422)
  const starter=resolveFreeStarterContent(category)
  const source=[...((FREE_PROFILE_STARTER_ASSETS as Record<string,readonly string[]>)[starter.category]||[])]
  if(source.length<5)return c.json({ok:false,error:'El banco gráfico de esta actividad todavía no está disponible.'},409)
  const urls=source.map(path=>starterAssetUrl(c,path))
  const heroUrl=urls[0]
  const avatarUrl=urls[1]||heroUrl
  const gallery=urls.slice(2,5).map((url,index)=>({url,title:`Ejemplo ${index+1}`,description:'Imagen de ejemplo. Sustitúyela por una foto real de tu trabajo antes de publicar.'}))
  const existingName=String((profile as any).business_name||'').trim()
  const businessName=existingName||'Tu nombre o negocio'

  await c.env.DB.prepare(`UPDATE sponsored_profiles SET username=?,business_name=?,specialization=?,what_we_do=?,avatar_url=?,hero_url=?,show_avatar=1,gallery_json=?,gallery_title='Catálogo',palette_id=?,status='draft',updated_at=datetime('now') WHERE id=?`).bind(
    username,businessName,starter.role,starter.bio,avatarUrl,heroUrl,JSON.stringify(gallery),sponsoredPalette(String(starter.recommendedPalette||'')),String((profile as any).id),
  ).run()

  return c.json({ok:true,data:{username,category:starter.category,starter:true}})
})

export default app
