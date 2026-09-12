#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def rep(s, old, new, label):
    if new in s:
        print(f'✓ {label}: ya aplicado'); return s
    if old not in s:
        raise SystemExit(f'✗ No encontré bloque esperado: {label}')
    print(f'✓ {label}')
    return s.replace(old,new,1)

# 1) API: publicación Free = identidad esencial, foto y portada. Lo demás mejora, no bloquea.
p='api/src/index.ts'; s=read(p)
pattern=r"type FreePublicationReadiness = \{.*?\n\}\n\nasync function getFreePublicationReadiness\(c: any, profileId: string\): Promise<FreePublicationReadiness> \{.*?\n\}\n"
helper="""type FreePublicationReadiness = {
  ready: boolean
  missing: string[]
  steps: {
    identifier: boolean
    identity: boolean
    photo: boolean
    hero: boolean
    contact: boolean
    quick_actions: boolean
    portfolio: boolean
    services: boolean
  }
  counts: { quick_actions: number; portfolio: number; services: number }
}

async function getFreePublicationReadiness(c: any, profileId: string): Promise<FreePublicationReadiness> {
  const [profileRow, contactRow, quickRow, galleryRow, servicesRow] = await Promise.all([
    c.env.DB.prepare(`SELECT slug,name,avatar_url,hero_url,template_data FROM profiles WHERE id=? LIMIT 1`).bind(profileId).first(),
    c.env.DB.prepare(`SELECT whatsapp,phone,email FROM profile_contact WHERE profile_id=? LIMIT 1`).bind(profileId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profile_social_links WHERE profile_id=? AND enabled=1 AND type IN ('call','instagram','location','email','tiktok')`).bind(profileId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profile_gallery WHERE profile_id=?`).bind(profileId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profile_products WHERE profile_id=? AND trim(COALESCE(title,''))<>''`).bind(profileId).first(),
  ])
  const profile=(profileRow||{}) as any
  const contact=(contactRow||{}) as any
  let templateData:Record<string,any>={}
  try { templateData=JSON.parse(String(profile.template_data||'{}')) } catch { templateData={} }
  const slug=String(profile.slug||'').trim()
  const role=String(templateData.role||templateData.title||'').trim()
  const quickActions=Number((quickRow as any)?.n||0)
  const portfolio=Number((galleryRow as any)?.n||0)
  const services=Number((servicesRow as any)?.n||0)
  const isStarter=(value:unknown)=>String(value||'').includes('/assets/free-starter/')
  const steps={
    identifier:Boolean(slug && !slug.startsWith('kawvo-')),
    identity:Boolean(String(profile.name||'').trim() && role && templateData.free_identity_confirmed===true),
    photo:Boolean(String(profile.avatar_url||'').trim() && !isStarter(profile.avatar_url)),
    hero:Boolean(String(profile.hero_url||'').trim() && !isStarter(profile.hero_url)),
    contact:Boolean(String(contact.whatsapp||'').trim() || String(contact.phone||'').trim() || String(contact.email||'').trim()),
    quick_actions:quickActions>=2,
    portfolio:portfolio>=1,
    services:services>=1,
  }
  const required:[keyof typeof steps,string][]=[
    ['identifier','Elige tu usuario público'],
    ['identity','Completa tu nombre o negocio y cargo'],
    ['photo','Agrega tu foto de perfil'],
    ['hero','Agrega tu portada'],
  ]
  const missing=required.filter(([key])=>!steps[key]).map(([,label])=>label)
  return { ready:missing.length===0, missing, steps, counts:{quick_actions:quickActions,portfolio,services} }
}
"""
ns,n=re.subn(pattern,helper,s,count=1,flags=re.S)
if n!=1 and 'hero: boolean' not in s: raise SystemExit('✗ No pude reemplazar readiness API')
s=ns if n==1 else s
if "me.post('/profile/hero'" not in s:
    marker="me.put('/profile/slug', async (c) => {"
    hero_route="""me.post('/profile/hero', async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(`SELECT id FROM profiles WHERE user_id=? LIMIT 1`).bind(userId).first()
  if (!profile) return c.json({ok:false,error:'Perfil no encontrado'},404)
  const fd=await c.req.formData(); const fileVal=fd.get('file')
  if (!(fileVal && typeof fileVal==='object' && 'name' in (fileVal as any) && 'stream' in (fileVal as any))) return c.json({ok:false,error:'Archivo requerido'},400)
  const file=fileVal as any as File
  const ext=file.name.split('.').pop()?.toLowerCase()||'jpg'
  if (!['jpg','jpeg','png','webp'].includes(ext)) return c.json({ok:false,error:'Formato no permitido'},400)
  const profileId=(profile as any).id
  const key=`heroes/${profileId}/${crypto.randomUUID()}.${ext}`
  await c.env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type||'image/jpeg'}})
  const origin=new URL(c.req.url).origin
  const encodedKey=key.split('/').map(encodeURIComponent).join('/')
  const heroUrl=`${origin}/api/v1/public/assets/${encodedKey}`
  await c.env.DB.prepare(`UPDATE profiles SET hero_url=?,hero_position_x=50,hero_position_y=50,hero_zoom=1,updated_at=datetime('now') WHERE id=?`).bind(heroUrl,profileId).run()
  return c.json({ok:true,hero_url:heroUrl})
})

"""
    s=rep(s,marker,hero_route+marker,'endpoint upload portada')
write(p,s)

# 2) Tipos/guía de publicación.
p='app/src/components/admin/free/FreeFirstRunGuide.tsx'
write(p,"""import { useNavigate } from 'react-router-dom'
export type FreePublicationReadiness={ready:boolean;missing:string[];steps:{identifier:boolean;identity:boolean;photo:boolean;hero:boolean;contact:boolean;quick_actions:boolean;portfolio:boolean;services:boolean};counts?:{quick_actions?:number;portfolio?:number;services?:number}}
const STEPS=[
  {key:'identifier' as const,title:'Usuario',text:'Elige la dirección pública de tu perfil.',to:'/admin/free/onboarding/identity?from=panel'},
  {key:'identity' as const,title:'Nombre y cargo',text:'Confirma cómo apareces y a qué te dedicas.',to:'/admin/free/onboarding/identity?from=panel'},
  {key:'photo' as const,title:'Foto de perfil',text:'Usa una foto real que te identifique.',to:'/admin/free/onboarding/identity?from=panel'},
  {key:'hero' as const,title:'Portada',text:'Personaliza la imagen principal de tu presentación.',to:'/admin/free/onboarding/identity?from=panel'},
]
export default function FreeFirstRunGuide({readiness}:{readiness:FreePublicationReadiness}){
 const navigate=useNavigate(); const complete=STEPS.filter(x=>readiness.steps[x.key]).length; const pct=Math.round(complete/STEPS.length*100)
 return <section className={`rounded-[26px] border p-5 shadow-sm ${readiness.ready?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-white'}`}><p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">Requisitos para publicar</p><h2 className="mt-1 text-lg font-black">{readiness.ready?'Ya puedes publicar tu perfil':`Completa lo indispensable · ${pct}%`}</h2><div className="mt-4 grid gap-2">{STEPS.map(x=><button key={x.key} type="button" onClick={()=>navigate(x.to)} className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${readiness.steps[x.key]?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}><span>{readiness.steps[x.key]?'✓':'○'}</span><span><strong className="block text-sm">{x.title}</strong><small className="text-slate-500">{x.text}</small></span></button>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Descripción, contacto adicional, botones, servicios, portafolio, ubicación y enlaces pueden editarse después y no bloquean la publicación.</p></section>
}
""")
print('✓ guía Free reducida a requisitos reales')

# 3) Dashboard.
p='app/src/components/admin/free/FreeDashboard.tsx'; s=read(p)
s=rep(s,"  avatar_url: string | null\n","  avatar_url: string | null\n  hero_url?: string | null\n",'tipo hero dashboard')
s=s.replace("Usuario, foto de perfil, nombre, cargo y descripción","Usuario, foto, portada, nombre y cargo")
s=rep(s,"  const photoReady = Boolean(me?.avatar_url && !isStarterAsset(me.avatar_url))\n","  const photoReady = Boolean(me?.avatar_url && !isStarterAsset(me.avatar_url))\n  const heroReady = Boolean(me?.hero_url && !isStarterAsset(me.hero_url))\n",'hero readiness dashboard')
s=s.replace("const baseReady = isTeamMember ? nameReady && roleReady : nameReady && roleReady && usernameReady && photoReady","const baseReady = isTeamMember ? nameReady && roleReady : nameReady && roleReady && usernameReady && photoReady && heroReady")
s=re.sub(r"const effectivePublishReady = isTeamMember \? baseReady : baseReady && contactConfirmed && quickActionsConfirmed && portfolioConfirmed && servicesConfirmed","const effectivePublishReady = baseReady",s)
s=re.sub(r"const publishMissing = isTeamMember\n    \? \[!nameReady \? 'nombre' : '', !roleReady \? 'cargo' : ''\]\.filter\(Boolean\)\n    : \[!baseReady \? 'los datos esenciales' : '', !contactConfirmed \? 'contacto real' : '', !quickActionsConfirmed \? 'accesos rápidos revisados' : '', !portfolioConfirmed \? '3 imágenes reales de portafolio' : '', !servicesConfirmed \? '2 servicios revisados' : ''\]\.filter\(Boolean\)","const publishMissing = isTeamMember\n    ? [!nameReady ? 'nombre' : '', !roleReady ? 'cargo' : ''].filter(Boolean)\n    : [!nameReady ? 'nombre' : '', !roleReady ? 'cargo' : '', !usernameReady ? 'usuario' : '', !photoReady ? 'foto' : '', !heroReady ? 'portada' : ''].filter(Boolean)",s)
s=s.replace("{ label: 'Usuario', done: usernameReady }, { label: 'Foto', done: photoReady }]","{ label: 'Usuario', done: usernameReady }, { label: 'Foto', done: photoReady }, { label: 'Portada', done: heroReady }]")
s=s.replace("if (item.readinessKey === 'identity') return nameReady && roleReady && (isTeamMember || photoReady) && (isTeamMember || usernameReady)","if (item.readinessKey === 'identity') return nameReady && roleReady && (isTeamMember || photoReady) && (isTeamMember || usernameReady) && (isTeamMember || heroReady)")
s=s.replace("Completa primero {isTeamMember ? '2' : '4'} datos esenciales.","Completa primero {isTeamMember ? '2' : '5'} datos indispensables para publicar.")
write(p,s); print('✓ dashboard Free actualizado')

# 4) Editor visual: progreso solo requisitos esenciales.
p='app/src/components/admin/free/FreeVisualEditor.tsx'; s=read(p)
s=s.replace("const requiredKeys: Array<keyof FreePublicationReadiness['steps']> = ['identifier', 'identity', 'contact', 'quick_actions', 'portfolio', 'services']","const requiredKeys: Array<keyof FreePublicationReadiness['steps']> = ['identifier', 'identity', 'photo', 'hero']")
s=s.replace("{completedRequired}/6","{completedRequired}/4")
s=s.replace("El porcentaje usa solo los 6 requisitos necesarios para publicar. Enlaces y cuentas bancarias no reducen ese porcentaje.","El porcentaje usa solo los requisitos indispensables para publicar. El resto del contenido puede personalizarse después.")
write(p,s); print('✓ progreso editor visual corregido')

# 5) Identidad: restaurar edición de portada real.
p='app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx'; s=read(p)
s=rep(s,"  const fileRef = useRef<HTMLInputElement>(null)\n","  const fileRef = useRef<HTMLInputElement>(null)\n  const heroFileRef = useRef<HTMLInputElement>(null)\n",'ref portada')
s=rep(s,"  const [avatarUrl, setAvatarUrl] = useState('')\n","  const [avatarUrl, setAvatarUrl] = useState('')\n  const [heroUrl, setHeroUrl] = useState('')\n  const [heroCropFile, setHeroCropFile] = useState<File | null>(null)\n",'estado portada')
s=rep(s,"        setAvatarUrl(d.avatar_url || '')\n","        setAvatarUrl(d.avatar_url || '')\n        setHeroUrl(d.hero_url || '')\n",'cargar portada')
anchor="  const handleSubmit = async (event: React.FormEvent) => {"
hero_funcs="""  const chooseHero = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0]
    if (heroFileRef.current) heroFileRef.current.value=''
    if (!file || !profileId || teamMember) return
    setHeroCropFile(file)
  }
  const uploadHero = async (blob:Blob) => {
    setHeroCropFile(null); setUploading(true); setError('')
    try { const form=new FormData(); form.append('file',blob,'hero.jpg'); const result:any=await apiUpload('/me/profile/hero',form); if(result?.ok&&result.hero_url)setHeroUrl(result.hero_url); else setError(result?.error||'No pudimos subir la portada.') }
    catch { setError('No pudimos subir la portada.') } finally { setUploading(false) }
  }

"""
s=rep(s,anchor,hero_funcs+anchor,'funciones portada')
s=rep(s,"    {cropFile && <ImageCropModal file={cropFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setCropFile(null)} />}\n","    {cropFile && <ImageCropModal file={cropFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setCropFile(null)} />}\n    {heroCropFile && <ImageCropModal file={heroCropFile} aspectRatio={16/9} outputWidth={1200} onSave={uploadHero} onCancel={() => setHeroCropFile(null)} />}\n",'modal portada')
marker="          <div className=\"mt-5 space-y-4\">"
hero_ui="""          {!teamMember && <div className="mt-4 rounded-2xl bg-amber-50/50 p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">Portada</p><p className="mt-1 text-xs text-slate-500">Imagen principal de la plantilla Impacto.</p></div><button type="button" onClick={()=>heroFileRef.current?.click()} disabled={uploading||!profileId} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold">{heroUrl?'Cambiar portada':'Subir portada'}</button></div><button type="button" onClick={()=>heroFileRef.current?.click()} className="mt-3 block aspect-video w-full overflow-hidden rounded-2xl border border-amber-200 bg-slate-100">{heroUrl?<img src={heroUrl} alt="Portada" className="h-full w-full object-cover"/>:<span className="grid h-full place-items-center text-sm font-bold text-slate-400">Agrega tu portada</span>}</button><input ref={heroFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseHero}/></div>}

"""
s=rep(s,marker,hero_ui+marker,'UI portada')
s=s.replace("Actualiza en un solo lugar tu usuario, foto, nombre, cargo y descripción.","Actualiza en un solo lugar tu usuario, foto, portada, nombre y cargo. La descripción y demás contenidos pueden editarse después.")
write(p,s); print('✓ edición de portada restaurada')

# 6) Demo IA: solo actividad, nombre/cargo y contacto; resto se edita después.
p='web/src/components/demo/KawvoLinkDemoAi.tsx'; s=read(p)
s=s.replace("  const [includeBankDemo, setIncludeBankDemo] = useState(true)","  const [includeBankDemo] = useState(false)")
s=s.replace("    if (step === 2 && !name.trim()) return setError('Escribe el nombre con el que quieres aparecer.')\n    if (step === 3 && workDescription.trim().length < 8) return setError('Cuéntanos brevemente qué haces para preparar una buena Demo.')\n    setStep((current) => Math.min(4, current + 1) as Step)","    if (step === 2 && !name.trim()) return setError('Escribe tu nombre o el de tu negocio.')\n    if (step === 2 && !role.trim()) return setError('Escribe tu cargo o puesto.')\n    setStep((current) => Math.min(3, current + 1) as Step)")
s=s.replace("          work_description: workDescription,","          work_description: workDescription || activity,")
s=s.replace("<small>{step <= 4 ? `${step}/4` : 'Casi listo'}</small>","<small>{step <= 3 ? `${step}/3` : 'Casi listo'}</small>")
# Eliminar antiguo paso 3 y convertir paso 4 (contacto) en paso 3.
s,n=re.subn(r"\n        \{step === 3 && <>.*?\n        </>\}\n\n        \{step === 4 && <>","\n        {step === 3 && <>",s,count=1,flags=re.S)
if n!=1: raise SystemExit('✗ No pude simplificar pasos Demo IA')
# Quitar preguntas secundarias entre WhatsApp y consentimiento.
s=re.sub(r"\n          <label className=\"kawvo-demo-ai-check\"><input type=\"checkbox\" checked=\{contact.samePhoneAsWhatsapp\}.*?<div className=\"kawvo-demo-ai-consent\">","\n          <p className=\"kawvo-demo-ai-note\">Los demás datos, imágenes, servicios y enlaces los puedes editar más adelante. Te recomendamos cambiar las imágenes para que tu perfil refleje mejor tu trabajo.</p>\n\n          <div className=\"kawvo-demo-ai-consent\">",s,count=1,flags=re.S)
s=s.replace("<h1>Tus datos esenciales</h1>","<h1>¿Cuál es tu número de contacto?</h1>")
write(p,s); print('✓ Demo IA simplificada a preguntas esenciales')

print('✓ CAMBIOS FREE + DEMO LISTOS')
