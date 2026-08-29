from pathlib import Path
import re


def read(path):
    p = Path(path)
    if not p.exists():
        raise SystemExit(f'Missing {path}')
    return p, p.read_text()


def write(p, s):
    p.write_text(s)
    print(f'✓ {p}')


def replace_once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'No encontré bloque esperado: {label}')
    return s.replace(old, new, 1)

# 1) AI apply: make no-op safe and improve diagnostics without weakening existing-content protections.
p, s = read('api/src/ai-profile-assistant.ts')
old = """  try { if (statements.length) await c.env.DB.batch(statements) } catch {
    await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'error',errorCode:'db_write_failed' })
    return c.json({ ok:false,error:'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.' },500)
  }
  await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'success' })
  return c.json({ ok:true,data:{ applied:{ identity:effectiveIdentity,bio:effectiveBio,services_section:applyServicesSection,services:effectiveServices,portfolio:effectivePortfolio }, editing_scope:editingScope, published:false, services_preserved:effectiveServices && context.services.length>0, note:'Aplicar modifica únicamente los campos seleccionados. No publica, no cambia plantilla, colores, orden de botones, orden de secciones ni canales.' } })
"""
new = """  if (!statements.length) {
    await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'success' })
    return c.json({ ok:true,data:{ no_changes:true, applied:{ identity:false,bio:false,services_section:false,services:false,portfolio:false }, editing_scope:editingScope, published:false, note:'La propuesta no contenía cambios aplicables para los campos seleccionados. Tu perfil se mantiene igual.' } })
  }
  try {
    await c.env.DB.batch(statements)
  } catch (error) {
    console.error('[ai-profile-assistant] apply db_write_failed', { profileId: context.profileId, userId, statementCount: statements.length, error: String((error as any)?.message || error) })
    await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'error',errorCode:'db_write_failed' })
    return c.json({ ok:false,error:'No pudimos guardar la propuesta en este momento. Tu perfil anterior se mantiene.',code:'db_write_failed' },500)
  }
  await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'success' })
  return c.json({ ok:true,data:{ no_changes:false, applied:{ identity:effectiveIdentity,bio:effectiveBio,services_section:applyServicesSection,services:effectiveServices,portfolio:effectivePortfolio }, editing_scope:editingScope, published:false, services_preserved:effectiveServices && context.services.length>0, note:'Aplicar modifica únicamente los campos seleccionados. No publica, no cambia plantilla, colores, orden de botones, orden de secciones ni canales.' } })
"""
s = replace_once(s, old, new, 'AI apply safe no-op')
write(p, s)

# 2) Portfolio: synchronous lock around every image operation + explicit stages + bottom back button.
p, s = read('app/src/components/admin/free/FreePortfolio.tsx')
s = replace_once(s,
"""  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
""",
"""  const replaceInputRef = useRef<HTMLInputElement>(null)
  const uploadLockRef = useRef(false)
  const [photos, setPhotos] = useState<Photo[]>([])
""", 'portfolio upload ref')
s = replace_once(s,
"""  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
""",
"""  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<'idle' | 'processing' | 'uploading'>('idle')
  const [error, setError] = useState('')
""", 'portfolio upload stage')
s = replace_once(s,
"""  const saveCroppedImage = async (blob: Blob) => {
    if (!cropFile || !cropMode) return
""",
"""  const saveCroppedImage = async (blob: Blob) => {
    if (!cropFile || !cropMode || uploadLockRef.current) return
    uploadLockRef.current = true
""", 'portfolio lock entry')
s = replace_once(s,
"""    setUploading(true)
    setError('')
    try {
      const json = await sendOptimizedImage(croppedFile, path)
""",
"""    setUploading(true)
    setUploadStage('processing')
    setError('')
    try {
      setUploadStage('uploading')
      const json = await sendOptimizedImage(croppedFile, path)
""", 'portfolio stage')
s = replace_once(s,
"""    } finally {
      setUploading(false)
    }
  }

  const startEdit = (photo: Photo) => {
""",
"""    } finally {
      uploadLockRef.current = false
      setUploading(false)
      setUploadStage('idle')
    }
  }

  const startEdit = (photo: Photo) => {
""", 'portfolio lock exit')
s = s.replace('<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseNewImage} className="hidden" />', '<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseNewImage} disabled={uploading} className="hidden" />')
s = s.replace('<input ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseReplacementImage} className="hidden" />', '<input ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseReplacementImage} disabled={uploading} className="hidden" />')
s = s.replace("{uploading ? 'Procesando…' : photos.length >= MAX_PHOTOS ? 'Límite completado' : 'Agregar imagen'}", "{uploading ? (uploadStage === 'uploading' ? 'Subiendo imagen…' : 'Procesando imagen…') : photos.length >= MAX_PHOTOS ? 'Límite completado' : 'Agregar imagen'}")
needle = '        <div className="mt-5"><FreeUpgradeCard compact /></div>'
if needle in s:
    s = s.replace(needle, needle + '\n        <div className="mt-4"><FreeBackButton onClick={() => navigate(\'/admin/free\')} /></div>', 1)
write(p, s)

# 3) Services: same hard lock and visible process state.
p, s = read('app/src/components/admin/free/FreeServices.tsx')
s = replace_once(s,
"""  const imageInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Service[]>([])
""",
"""  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageUploadLockRef = useRef(false)
  const [items, setItems] = useState<Service[]>([])
""", 'services upload ref')
s = replace_once(s,
"""  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
""",
"""  const [saving, setSaving] = useState(false)
  const [imageUploadStage, setImageUploadStage] = useState<'idle' | 'processing' | 'uploading'>('idle')
  const [loading, setLoading] = useState(true)
""", 'services stage')
s = replace_once(s,
"""  const saveCroppedServiceImage = async (blob: Blob) => {
    if (!cropFile || !imageTargetId) return
""",
"""  const saveCroppedServiceImage = async (blob: Blob) => {
    if (!cropFile || !imageTargetId || imageUploadLockRef.current) return
    imageUploadLockRef.current = true
""", 'services lock entry')
s = replace_once(s,
"""    setSaving(true)
    setError('')
    try {
      const optimized = await optimizeServiceImage(croppedFile)
""",
"""    setSaving(true)
    setImageUploadStage('processing')
    setError('')
    try {
      const optimized = await optimizeServiceImage(croppedFile)
      setImageUploadStage('uploading')
""", 'services stages')
s = replace_once(s,
"""    } finally {
      setSaving(false)
    }
  }

  const removeImage = async (item: Service) => {
""",
"""    } finally {
      imageUploadLockRef.current = false
      setImageUploadStage('idle')
      setSaving(false)
    }
  }

  const removeImage = async (item: Service) => {
""", 'services lock exit')
s = s.replace('ref={imageInputRef} type="file"', 'ref={imageInputRef} type="file" disabled={saving}', 1)
# Show process status near any save button without relying on percentage unsupported by current upload helper.
marker = "        {error && <p className=\"mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600\">{error}</p>}"
if marker in s:
    s = s.replace(marker, "        {imageUploadStage !== 'idle' && <p className=\"mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs font-black text-cyan-700\">{imageUploadStage === 'processing' ? 'Procesando imagen…' : 'Subiendo imagen…'}</p>}\n" + marker, 1)
needle = '        <div className="mt-5"><FreeUpgradeCard compact /></div>'
if needle in s:
    s = s.replace(needle, needle + '\n        <div className="mt-4"><FreeBackButton onClick={() => navigate(\'/admin/free\')} /></div>', 1)
write(p, s)

# 4) Dashboard: clearer copy, clickable avatar, true client view language, share action, no duplicated requirement wording.
p, s = read('app/src/components/admin/free/FreeDashboard.tsx')
s = s.replace("title: 'Reservar mi identificador',\n    text: 'Elige tu enlace corto /usuario',", "title: 'Elige tu usuario',\n    text: 'Ej.: @tuusuario',", 1)
s = s.replace("title: 'Datos de contacto',\n    text: 'WhatsApp, teléfono y correo',", "title: 'Agrega tus datos de contacto',\n    text: 'WhatsApp, teléfono, correo y otras formas de contactarte',", 1)
s = s.replace("title: 'Botones rápidos',\n    text: 'Hasta 3: Llamar, Instagram, Ubicación, Email o TikTok',", "title: 'Selecciona tus botones de acceso',\n    text: 'Hasta 3 accesos directos para tu perfil',", 1)
s = s.replace("title: 'Mis trabajos (portafolio)',\n    text: 'Hasta 5 imágenes de tu trabajo',", "title: 'Muestra tus trabajos realizados',\n    text: 'Máx. 5 fotos · mínimo 3 para publicar tu perfil',", 1)
s = s.replace("title: 'Servicios',\n    text: 'Hasta 3 servicios con imagen y descripción',", "title: 'Agrega tus servicios',\n    text: 'Describe brevemente qué ofreces · mínimo 2 para publicar',", 1)
s = s.replace('<div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">', '<button type="button" onClick={() => navigate(\'/admin/free/onboarding/identity\')} aria-label="Cambiar foto de perfil" className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ring-offset-2 transition hover:ring-2 hover:ring-cyan-300">', 1)
s = s.replace('</div>\n            <div className="min-w-0 flex-1">', '</button>\n            <div className="min-w-0 flex-1">', 1)
s = s.replace('>Ver mi perfil</a>', '>Ver como cliente</a>', 1)
s = s.replace('>Ver mi perfil</button>', '>Ver como cliente</button>', 1)
s = s.replace('Tu enlace público', 'Enlace de tu perfil', 1)
s = s.replace('href={`${publicUrl}?preview=1`}', 'href={`/api/v1/me/free/profile-preview/${encodeURIComponent(me.slug || \'\')}?full=1`}', 1)
s = s.replace('>Vista previa</a>', '>Ver como cliente</a>', 1)
s = s.replace('>Vista previa</button>', '>Ver como cliente</button>', 1)
s = s.replace("const [linkCopied, setLinkCopied] = useState(false)", "const [linkCopied, setLinkCopied] = useState(false)\n  const [shareMessage, setShareMessage] = useState('')", 1)
insert_after = """  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      setLinkCopied(false)
    }
  }
"""
share_fn = insert_after + """
  const sharePublicUrl = async (url: string) => {
    setShareMessage('')
    try {
      if (navigator.share) {
        await navigator.share({ title: me?.name || 'Mi perfil', url })
        setShareMessage('Perfil listo para compartir.')
        return
      }
      await navigator.clipboard.writeText(url)
      setShareMessage('Enlace copiado para compartir.')
    } catch (error: any) {
      if (error?.name !== 'AbortError') setShareMessage('No pudimos abrir el menú para compartir.')
    }
  }
"""
s = replace_once(s, insert_after, share_fn, 'dashboard share fn')
old_grid = '            <div className="mt-4 grid grid-cols-2 gap-2">'
s = s.replace(old_grid, '            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">', 1)
copy_end = """              </button>
            </div>

            {!previewReady && (
"""
share_button = """              </button>
              <button type="button" onClick={() => void sharePublicUrl(publicUrl)} disabled={!me?.is_published} className="min-h-10 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Compartir perfil</button>
            </div>
            {shareMessage && <p className="mt-2 text-xs font-semibold text-slate-500">{shareMessage}</p>}

            {!previewReady && (
"""
s = replace_once(s, copy_end, share_button, 'dashboard share button')
s = s.replace('Verde significa completado, ámbar indica que aún falta y gris identifica funciones disponibles que no forman parte de los requisitos de publicación. Solo NFC/QR se marca como opcional.', 'Verde significa completado, amarillo indica un requisito pendiente y gris identifica funciones disponibles u opcionales.', 1)
write(p, s)

# 5) Visual editor: label exact public view and always expose mobile preview toggle. Use authenticated preview endpoint, never shared-link preview flags.
p, s = read('app/src/components/admin/free/FreeVisualEditor.tsx')
s = s.replace("<button type=\"button\" onClick={() => setMobileMode('preview')} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'preview' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Vista previa</button>", "<button type=\"button\" onClick={() => setMobileMode('preview')} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'preview' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Vista pública</button>", 1)
s = s.replace('Vista previa en vivo', 'Vista pública en vivo', 1)
s = s.replace('Así lo verá tu cliente', 'Así lo verá tu cliente, sin controles de edición', 1)
s = s.replace("{slug && <a href={`${webUrl}/${encodeURIComponent(slug)}?preview=1`} target=\"_blank\" rel=\"noopener noreferrer\" className=\"mt-4 flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white\">Abrir perfil completo</a>}", "{slug && <a href={`/api/v1/me/free/profile-preview/${encodeURIComponent(slug)}?full=1`} target=\"_blank\" rel=\"noopener noreferrer\" className=\"mt-4 flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white\">Ver como cliente</a>}", 1)
# configured public web URL remains used elsewhere; avoid TS noUnused issue by keeping it if currently referenced.
write(p, s)

print('\nBatch aplicado. Ejecuta tsc/build antes de commit.')
