from pathlib import Path


def replace(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré patrón para {label} en {path}')
    p.write_text(s.replace(old, new, 1))
    print(f'✓ {label}')

# 1) Crop modal: lock real + feedback mientras procesa/sube.
path = 'app/src/components/admin/ImageCropModal.tsx'
replace(path,
"  onSave: (blob: Blob) => void\n",
"  onSave: (blob: Blob) => void | Promise<void>\n",
'ImageCropModal onSave async')
replace(path,
"  const [dragging, setDragging] = useState(false)\n",
"  const [dragging, setDragging] = useState(false)\n  const [saveStage, setSaveStage] = useState<'idle' | 'processing' | 'uploading'>('idle')\n",
'ImageCropModal estado de carga')
replace(path,
"  function handleConfirm() {\n    const image = imageRef.current\n    if (!image || !crop) return\n\n    const canvas = document.createElement('canvas')\n    canvas.width = outputWidth\n    canvas.height = outputHeight\n    const context = canvas.getContext('2d')\n    if (!context) return\n\n    context.drawImage(\n      image,\n      crop.cropX,\n      crop.cropY,\n      crop.cropWidth,\n      crop.cropHeight,\n      0,\n      0,\n      outputWidth,\n      outputHeight,\n    )\n\n    canvas.toBlob((blob) => {\n      if (blob) onSave(blob)\n    }, 'image/jpeg', JPEG_Q)\n  }\n",
"  function handleConfirm() {\n    const image = imageRef.current\n    if (!image || !crop || saveStage !== 'idle') return\n\n    setSaveStage('processing')\n    const canvas = document.createElement('canvas')\n    canvas.width = outputWidth\n    canvas.height = outputHeight\n    const context = canvas.getContext('2d')\n    if (!context) { setSaveStage('idle'); return }\n\n    context.drawImage(\n      image,\n      crop.cropX,\n      crop.cropY,\n      crop.cropWidth,\n      crop.cropHeight,\n      0,\n      0,\n      outputWidth,\n      outputHeight,\n    )\n\n    canvas.toBlob(async (blob) => {\n      if (!blob) { setSaveStage('idle'); return }\n      setSaveStage('uploading')\n      try {\n        await Promise.resolve(onSave(blob))\n      } finally {\n        setSaveStage('idle')\n      }\n    }, 'image/jpeg', JPEG_Q)\n  }\n",
'ImageCropModal confirm bloqueado')
replace(path,
"          <button type=\"button\" onClick={onCancel} className=\"text-lg leading-none text-slate-400 hover:text-white\">✕</button>\n",
"          <button type=\"button\" onClick={onCancel} disabled={saveStage !== 'idle'} className=\"text-lg leading-none text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-35\">✕</button>\n",
'ImageCropModal cerrar bloqueado')
replace(path,
"          <button type=\"button\" onClick={onCancel} className=\"flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5\">\n            Cancelar\n          </button>\n          <button type=\"button\" onClick={handleConfirm} disabled={!working} className=\"flex-1 rounded-xl bg-gradient-to-r from-[#3b82f6] to-purple-600 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40\">\n            Usar imagen\n          </button>\n",
"          <button type=\"button\" onClick={onCancel} disabled={saveStage !== 'idle'} className=\"flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35\">\n            Cancelar\n          </button>\n          <button type=\"button\" onClick={handleConfirm} disabled={!working || saveStage !== 'idle'} className=\"flex-1 rounded-xl bg-gradient-to-r from-[#3b82f6] to-purple-600 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40\">\n            {saveStage === 'processing' ? 'Procesando imagen…' : saveStage === 'uploading' ? 'Subiendo imagen…' : 'Usar imagen'}\n          </button>\n",
'ImageCropModal feedback visible')

# 2) URL completa y copy de usuario.
path = 'app/src/components/admin/free/FreeIdentifier.tsx'
replace(path,
"  const [error, setError] = useState('')\n",
"  const [error, setError] = useState('')\n  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\\/$/, '')\n",
'Identifier URL base')
replace(path,
"setError(result.error === 'Slug no disponible' ? 'Ese identificador ya está siendo usado. Prueba con otro.' : result.error || 'No pudimos guardar ese usuario.')",
"setError(result.error === 'Slug no disponible' ? 'Ese usuario ya está siendo usado. Prueba con otro.' : result.error || 'No pudimos guardar ese usuario.')",
'Identifier copy error')
replace(path,
"{slug && <p className=\"mt-4 rounded-2xl bg-cyan-50 p-3 text-sm font-bold text-cyan-800\">Tu perfil quedará como: <strong>/{slug}</strong></p>}",
"{slug && <p className=\"mt-4 break-all rounded-2xl bg-cyan-50 p-3 text-sm font-bold text-cyan-800\">Tu perfil quedará como: <strong>{webUrl}/{slug}</strong></p>}",
'Identifier URL completa')
replace(path,
"{saving ? 'Reservando…' : 'Guardar mi usuario'}",
"{saving ? 'Guardando…' : 'Guardar mi usuario'}",
'Identifier copy guardar')

# 3) Upgrade card sin confundir con IA.
path = 'app/src/components/admin/free/FreePanelUi.tsx'
replace(path,
"<span className=\"flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lg\">✦</span>",
"<span className=\"flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-xl\" aria-hidden=\"true\">🏅</span>",
'Upgrade icon medalla')
replace(path,
"          <p className=\"text-base font-black text-slate-900\">Amplía tu alcance</p>\n",
"          <div className=\"flex flex-wrap items-center gap-2\"><p className=\"text-base font-black text-slate-900\">Amplía tu alcance</p><span className=\"rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800\">Premium</span></div>\n",
'Upgrade badge premium')

# 4) Completa tu presentación: modo edición desde panel, sin recorrer onboarding.
path = 'app/src/components/admin/free/FreeDashboard.tsx'
replace(path,
"    to: '/admin/free/onboarding/identity',\n",
"    to: '/admin/free/onboarding/identity?from=panel',\n",
'Dashboard ruta presentación')
replace(path,
"    title: 'Selecciona tus botones de acceso',\n    text: 'Hasta 3 accesos directos para tu perfil',\n",
"    title: 'Botones de contacto directo',\n    text: 'Hasta 3 botones para que te contacten o encuentren con un toque',\n",
'Dashboard copy botones contacto')
replace(path,
"  useEffect(() => {\n    Promise.all([\n",
"  useEffect(() => {\n    Promise.all([\n",
'Dashboard anchor load')
# insert scroll restore after the load effect block
replace(path,
"  }, [])\n\n  const handleLogout = async () => {\n",
"  }, [])\n\n  useEffect(() => {\n    if (loading) return\n    const raw = sessionStorage.getItem('kawvo_free_dashboard_scroll_y')\n    const top = Number(raw || 0)\n    if (Number.isFinite(top) && top > 0) {\n      window.requestAnimationFrame(() => window.scrollTo({ top, left: 0, behavior: 'auto' }))\n    }\n  }, [loading])\n\n  useEffect(() => {\n    const rememberScroll = () => sessionStorage.setItem('kawvo_free_dashboard_scroll_y', String(window.scrollY))\n    document.addEventListener('click', rememberScroll, true)\n    window.addEventListener('pagehide', rememberScroll)\n    return () => {\n      document.removeEventListener('click', rememberScroll, true)\n      window.removeEventListener('pagehide', rememberScroll)\n    }\n  }, [])\n\n  const handleLogout = async () => {\n",
'Dashboard memoria de scroll')

path = 'app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx'
replace(path,
"  const [cropTarget, setCropTarget] = useState<CropTarget>('avatar')\n",
"  const [cropTarget, setCropTarget] = useState<CropTarget>('avatar')\n  const editingFromPanel = new URLSearchParams(window.location.search).get('from') === 'panel'\n",
'Identity modo panel')
replace(path,
"      if (result.ok) navigate('/admin/free/onboarding/contact')\n",
"      if (result.ok) navigate(editingFromPanel ? '/admin/free' : '/admin/free/onboarding/contact')\n",
'Identity retorno panel')
replace(path,
"          <div className=\"mb-8 flex gap-2\" aria-label=\"Paso 3 de 4\">\n            {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}\n          </div>\n          <p className=\"mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700\">Paso 3 de 4</p>\n          <h1 className=\"text-[30px] font-black leading-tight tracking-[-0.03em]\">Tu identidad</h1>\n          <p className=\"mt-3 text-base font-medium leading-7 text-slate-700\">Agrega lo esencial para que te encuentren y sepan quién eres.</p>\n",
"          {!editingFromPanel && (<>\n            <div className=\"mb-8 flex gap-2\" aria-label=\"Paso 3 de 4\">\n              {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}\n            </div>\n            <p className=\"mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700\">Paso 3 de 4</p>\n          </>)}\n          <h1 className=\"text-[30px] font-black leading-tight tracking-[-0.03em]\">{editingFromPanel ? 'Completa tu presentación' : 'Tu identidad'}</h1>\n          <p className=\"mt-3 text-base font-medium leading-7 text-slate-700\">{editingFromPanel ? 'Actualiza tu foto, portada, nombre y la información principal de tu perfil.' : 'Agrega lo esencial para que te encuentren y sepan quién eres.'}</p>\n",
'Identity cabecera edición')
replace(path,
"<div className=\"h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100\">{avatarUrl ? <img src={avatarUrl} alt=\"\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center text-3xl text-slate-400\">👤</div>}</div>",
"<button type=\"button\" onClick={() => fileRef.current?.click()} disabled={uploading || !profileId} className=\"h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100 disabled:opacity-40\" aria-label=\"Cambiar foto de perfil\">{avatarUrl ? <img src={avatarUrl} alt=\"\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center text-3xl text-slate-400\">👤</div>}</button>",
'Identity foto tocable')
replace(path,
"<div className=\"mt-3 aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-100\">\n                  {(pendingHeroPreview || heroUrl) ? <img src={pendingHeroPreview || heroUrl} alt=\"Vista previa de portada\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400\">Agrega una imagen de portada para completar el diseño Impacto.</div>}\n                </div>",
"<button type=\"button\" onClick={() => heroFileRef.current?.click()} disabled={uploading || !profileId} className=\"relative mt-3 block aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 disabled:opacity-40\" aria-label=\"Cambiar imagen de portada\">\n                  {(pendingHeroPreview || heroUrl) ? <img src={pendingHeroPreview || heroUrl} alt=\"Vista previa de portada\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400\">Agrega una imagen de portada para completar el diseño Impacto.</div>}\n                  <span className=\"absolute bottom-2 right-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-black text-white\">Toca para cambiar</span>\n                </button>",
'Identity portada tocable')
# Button text tends to be unique in this screen.
replace(path,
"{saving ? 'Guardando…' : 'Continuar'}",
"{saving ? 'Guardando…' : editingFromPanel ? 'Guardar cambios' : 'Continuar'}",
'Identity CTA panel')

# 5) Copy accesos rápidos.
path = 'app/src/components/admin/free/FreeQuickActions.tsx'
replace(path,
"<h1 className=\"mt-1 text-2xl font-black tracking-[-0.04em]\">Accesos rápidos</h1>",
"<h1 className=\"mt-1 text-2xl font-black tracking-[-0.04em]\">Botones de contacto directo</h1>",
'Quick actions título')
replace(path,
"Selecciona hasta 3 botones para que tus visitantes puedan llamarte, encontrarte o abrir tus redes con un toque.",
"Selecciona hasta 3 botones para que tus visitantes puedan contactarte, encontrarte o abrir tus redes con un toque.",
'Quick actions descripción')
replace(path,
"No pudimos cargar tus accesos rápidos.",
"No pudimos cargar tus botones de contacto.",
'Quick actions error carga')
replace(path,
"Accesos rápidos actualizados.",
"Botones de contacto actualizados.",
'Quick actions guardado')
replace(path,
"Guardar accesos rápidos",
"Guardar botones de contacto",
'Quick actions CTA')

# 6) Volver al panel al final de ubicación.
path = 'app/src/components/admin/free/FreeLocation.tsx'
replace(path,
"        <div className=\"mt-5\">\n          <FreeUpgradeCard compact />\n        </div>\n      </div>\n",
"        <div className=\"mt-5\">\n          <FreeUpgradeCard compact />\n        </div>\n        <div className=\"mt-4\"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>\n      </div>\n",
'Location back final')

# 7) Portfolio: tocar la imagen abre reemplazo. El lock real vive en ImageCropModal.
path = 'app/src/components/admin/free/FreePortfolio.tsx'
replace(path,
"              <div className=\"aspect-square overflow-hidden bg-slate-100\"><img src={photoUrl(photo.image_key)} alt={photo.title || 'Portafolio'} loading=\"lazy\" decoding=\"async\" className=\"h-full w-full object-cover\" /></div>",
"              <button type=\"button\" disabled={uploading} onClick={() => { setReplaceTargetId(photo.id); replaceInputRef.current?.click() }} className=\"relative block aspect-square w-full overflow-hidden bg-slate-100 disabled:opacity-50\" aria-label=\"Cambiar imagen del portafolio\"><img src={photoUrl(photo.image_key)} alt={photo.title || 'Portafolio'} loading=\"lazy\" decoding=\"async\" className=\"h-full w-full object-cover\" /><span className=\"absolute bottom-2 right-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-black text-white\">Toca para cambiar</span></button>",
'Portfolio imagen tocable')

# 8) Servicios: tocar imagen o placeholder abre galería.
path = 'app/src/components/admin/free/FreeServices.tsx'
replace(path,
"              {item.image_url ? <div className=\"aspect-square overflow-hidden bg-slate-100\"><img src={item.image_url} alt={item.title} loading=\"lazy\" decoding=\"async\" className=\"h-full w-full object-cover\" /></div> : <div className=\"flex aspect-square items-center justify-center bg-cyan-50 text-4xl text-cyan-700\">◇</div>}",
"              {item.image_url ? <button type=\"button\" disabled={saving} onClick={() => { setImageTargetId(item.id); imageInputRef.current?.click() }} className=\"relative block aspect-square w-full overflow-hidden bg-slate-100 disabled:opacity-50\" aria-label=\"Cambiar imagen del servicio\"><img src={item.image_url} alt={item.title} loading=\"lazy\" decoding=\"async\" className=\"h-full w-full object-cover\" /><span className=\"absolute bottom-2 right-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-black text-white\">Toca para cambiar</span></button> : <button type=\"button\" disabled={saving} onClick={() => { setImageTargetId(item.id); imageInputRef.current?.click() }} className=\"relative flex aspect-square w-full items-center justify-center bg-cyan-50 text-4xl text-cyan-700 disabled:opacity-50\" aria-label=\"Agregar imagen al servicio\">◇<span className=\"absolute bottom-2 right-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-black text-white\">Agregar imagen</span></button>}",
'Services imagen tocable')

# 9) Compartir cuentas: CTA explícito + mensaje solicitado.
path = 'web/src/components/free-profile/PublicBankAccounts.tsx'
replace(path,
"    const message = `Te comparto mis datos bancarios para transferencia: ${url}`\n",
"    const message = `Te comparto mis datos bancarios para transferencias: ${url}`\n",
'Bank share mensaje')
replace(path,
"            WhatsApp\n",
"            Enviar por WhatsApp\n",
'Bank share CTA')

# 10) Preview OG dinámico para que WhatsApp use nombre/foto del perfil.
path = 'api/src/preview-frontdoor-entry.ts'
replace(path,
"async function proxyPagesPreview(request: Request, origin: string | undefined, marker: string, allowEmbeddedFrame = false) {\n",
"function escapeHtml(value: string) {\n  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\\"/g, '&quot;')\n}\n\nasync function proxyPagesPreview(request: Request, origin: string | undefined, marker: string, allowEmbeddedFrame = false) {\n",
'Preview OG helper escape')
insert_after = "async function proxyPagesPreview(request: Request, origin: string | undefined, marker: string, allowEmbeddedFrame = false) {"
# Add helper after proxyPagesPreview function by replacing the next known function marker.
replace(path,
"function renewPreviewRedirect(slug: string, embedded: boolean) {\n",
"async function proxyPublicProfileWithMeta(request: Request, env: PreviewEnv) {\n  const response = await proxyPagesPreview(request, env.WEB_PAGES_ORIGIN, 'web-custom-domain')\n  const url = new URL(request.url)\n  const slug = slugFromPath(url.pathname)\n  const accept = request.headers.get('Accept') || ''\n  if (!slug || slug.includes('.') || request.method.toUpperCase() !== 'GET' || !accept.includes('text/html') || response.status !== 200) return response\n\n  const row = await env.DB.prepare(\n    `SELECT name, bio, avatar_url FROM profiles WHERE lower(slug) = lower(?) AND is_published = 1 LIMIT 1`,\n  ).bind(slug).first()\n  if (!row) return response\n\n  const contentType = response.headers.get('content-type') || ''\n  if (!contentType.includes('text/html')) return response\n\n  const name = String((row as any).name || slug).trim() || slug\n  const bio = String((row as any).bio || '').trim()\n  const image = String((row as any).avatar_url || '').trim()\n  const canonical = `${url.origin}/${encodeURIComponent(slug)}`\n  const title = `${name} | Kawvo Link`\n  const description = bio || `Perfil digital de ${name}. Contacto, servicios y formas de conectar en un solo lugar.`\n  const meta = [\n    `<title>${escapeHtml(title)}</title>`,\n    `<meta name=\"description\" content=\"${escapeHtml(description)}\">`,\n    `<meta property=\"og:type\" content=\"profile\">`,\n    `<meta property=\"og:title\" content=\"${escapeHtml(title)}\">`,\n    `<meta property=\"og:description\" content=\"${escapeHtml(description)}\">`,\n    `<meta property=\"og:url\" content=\"${escapeHtml(canonical)}\">`,\n    image ? `<meta property=\"og:image\" content=\"${escapeHtml(image)}\">` : '',\n    `<meta name=\"twitter:card\" content=\"summary_large_image\">`,\n    `<meta name=\"twitter:title\" content=\"${escapeHtml(title)}\">`,\n    `<meta name=\"twitter:description\" content=\"${escapeHtml(description)}\">`,\n    image ? `<meta name=\"twitter:image\" content=\"${escapeHtml(image)}\">` : '',\n  ].filter(Boolean).join('\\n')\n\n  const html = await response.text()\n  const updated = html.replace(/<title>[\\s\\S]*?<\\/title>/i, '').replace('</head>', `${meta}\\n</head>`)\n  const headers = new Headers(response.headers)\n  headers.delete('content-length')\n  headers.delete('content-encoding')\n  headers.set('cache-control', 'no-store')\n  return new Response(updated, { status: response.status, statusText: response.statusText, headers })\n}\n\nfunction renewPreviewRedirect(slug: string, embedded: boolean) {\n",
'Preview OG dynamic profile proxy')
replace(path,
"      if (url.hostname === 'preview.intaprd.com') {\n        return proxyPagesPreview(request, env.WEB_PAGES_ORIGIN, 'web-custom-domain')\n      }\n",
"      if (url.hostname === 'preview.intaprd.com') {\n        return proxyPublicProfileWithMeta(request, env)\n      }\n",
'Preview OG use dynamic proxy')

print('✓ Segundo follow-up QA aplicado. Ejecuta TypeScript/build antes de commit.')
