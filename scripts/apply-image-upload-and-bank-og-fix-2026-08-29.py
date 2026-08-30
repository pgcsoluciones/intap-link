from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré marcador para {label} en {path}')
    s = s.replace(old, new, 1)
    p.write_text(s)
    print(f'✓ {label}')

# 1) Portfolio: close crop editor immediately, keep upload state on page, and await callback correctly.
path = 'app/src/components/admin/free/FreePortfolio.tsx'
old = '''  const saveCroppedImage = async (blob: Blob) => {\n    if (!cropFile || !cropMode || uploadLockRef.current) return\n    uploadLockRef.current = true\n    const baseName = cropFile.name.replace(/\\.[^.]+$/, '') || 'portfolio'\n    const croppedFile = new File([blob], `${baseName}-crop.jpg`, { type: blob.type || 'image/jpeg', lastModified: Date.now() })\n    const path = cropMode !== 'new' && replaceTargetId\n      ? `/me/gallery/${replaceTargetId}/replace`\n      : '/profile/gallery/upload'\n\n    setUploading(true)\n    setUploadStage('processing')\n    setError('')\n    try {\n      setUploadStage('uploading')\n      const json = await sendOptimizedImage(croppedFile, path)\n      if (!json.ok) {\n        setError(json.error || (cropMode === 'new' ? 'No se pudo subir la imagen.' : 'No se pudo actualizar la imagen.'))\n        return\n      }\n      await load()\n      cancelCrop()\n    } catch {\n      setError(cropMode === 'new' ? 'No pudimos subir la imagen.' : 'No pudimos actualizar la imagen.')\n    } finally {\n      uploadLockRef.current = false\n      setUploading(false)\n      setUploadStage('idle')\n    }\n  }'''
new = '''  const saveCroppedImage = async (blob: Blob) => {\n    if (!cropFile || !cropMode || uploadLockRef.current) return\n    uploadLockRef.current = true\n    const sourceFile = cropFile\n    const mode = cropMode\n    const targetId = replaceTargetId\n    const baseName = sourceFile.name.replace(/\\.[^.]+$/, '') || 'portfolio'\n    const croppedFile = new File([blob], `${baseName}-crop.jpg`, { type: blob.type || 'image/jpeg', lastModified: Date.now() })\n    const path = mode !== 'new' && targetId\n      ? `/me/gallery/${targetId}/replace`\n      : '/profile/gallery/upload'\n\n    // Cierra inmediatamente el editor de encuadre y muestra el estado real en Portafolio.\n    setCropFile(null)\n    setUploading(true)\n    setUploadStage('processing')\n    setError('')\n    try {\n      const optimized = await optimizeImageForUpload(croppedFile)\n      setUploadStage('uploading')\n      const fd = new FormData()\n      fd.append('file', optimized, optimized.name)\n      const json: any = await apiUpload(path, fd)\n      if (!json.ok) {\n        setError(json.error || (mode === 'new' ? 'No se pudo subir la imagen.' : 'No se pudo actualizar la imagen.'))\n        return\n      }\n      await load()\n    } catch {\n      setError(mode === 'new' ? 'No pudimos subir la imagen.' : 'No pudimos actualizar la imagen.')\n    } finally {\n      uploadLockRef.current = false\n      setCropMode(null)\n      setReplaceTargetId(null)\n      setUploading(false)\n      setUploadStage('idle')\n    }\n  }'''
replace_once(path, old, new, 'Portafolio: cerrar ajuste y mostrar carga real')

replace_once(path,
'''      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">\n        <FreeBackButton onClick={() => navigate('/admin/free')} />''',
'''      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">\n        {uploading && uploadStage !== 'idle' && (\n          <div className="fixed inset-x-4 top-4 z-40 mx-auto max-w-[398px] rounded-2xl border border-cyan-200 bg-white px-4 py-3 shadow-xl" role="status" aria-live="polite">\n            <div className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /><p className="text-sm font-black text-slate-800">{uploadStage === 'processing' ? 'Procesando imagen…' : 'Subiendo imagen…'}</p></div>\n          </div>\n        )}\n        <FreeBackButton onClick={() => navigate('/admin/free')} />''',
'Portafolio: aviso visible de procesamiento/subida')

replace_once(path,
'''          onSave={(blob) => { void saveCroppedImage(blob) }}''',
'''          onSave={saveCroppedImage}''',
'Portafolio: callback async real')

# 2) Services: same UX.
path = 'app/src/components/admin/free/FreeServices.tsx'
old = '''  const saveCroppedServiceImage = async (blob: Blob) => {\n    if (!cropFile || !imageTargetId || imageUploadLockRef.current) return\n    imageUploadLockRef.current = true\n    const baseName = cropFile.name.replace(/\\.[^.]+$/, '') || 'servicio'\n    const croppedFile = new File([blob], `${baseName}-crop.jpg`, { type: blob.type || 'image/jpeg', lastModified: Date.now() })\n\n    setSaving(true)\n    setImageUploadStage('processing')\n    setError('')\n    try {\n      const optimized = await optimizeServiceImage(croppedFile)\n      setImageUploadStage('uploading')\n      const fd = new FormData()\n      fd.append('file', optimized, optimized.name)\n      const json: any = await apiUpload(`/me/products/${imageTargetId}/image`, fd)\n      if (!json.ok) {\n        setError(json.error || 'No se pudo cargar la imagen del servicio.')\n        return\n      }\n      await load()\n      cancelCrop()\n    } catch {\n      setError('No pudimos procesar la imagen del servicio.')\n    } finally {\n      imageUploadLockRef.current = false\n      setImageUploadStage('idle')\n      setSaving(false)\n    }\n  }'''
new = '''  const saveCroppedServiceImage = async (blob: Blob) => {\n    if (!cropFile || !imageTargetId || imageUploadLockRef.current) return\n    imageUploadLockRef.current = true\n    const sourceFile = cropFile\n    const targetId = imageTargetId\n    const baseName = sourceFile.name.replace(/\\.[^.]+$/, '') || 'servicio'\n    const croppedFile = new File([blob], `${baseName}-crop.jpg`, { type: blob.type || 'image/jpeg', lastModified: Date.now() })\n\n    // Cierra inmediatamente el editor y deja visible el progreso dentro de Servicios.\n    setCropFile(null)\n    setSaving(true)\n    setImageUploadStage('processing')\n    setError('')\n    try {\n      const optimized = await optimizeServiceImage(croppedFile)\n      setImageUploadStage('uploading')\n      const fd = new FormData()\n      fd.append('file', optimized, optimized.name)\n      const json: any = await apiUpload(`/me/products/${targetId}/image`, fd)\n      if (!json.ok) {\n        setError(json.error || 'No se pudo cargar la imagen del servicio.')\n        return\n      }\n      await load()\n    } catch {\n      setError('No pudimos procesar la imagen del servicio.')\n    } finally {\n      imageUploadLockRef.current = false\n      setImageTargetId(null)\n      setImageUploadStage('idle')\n      setSaving(false)\n    }\n  }'''
replace_once(path, old, new, 'Servicios: cerrar ajuste y mostrar carga real')

replace_once(path,
'''      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">\n        <FreeBackButton onClick={() => navigate('/admin/free')} />''',
'''      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">\n        {saving && imageUploadStage !== 'idle' && (\n          <div className="fixed inset-x-4 top-4 z-40 mx-auto max-w-[398px] rounded-2xl border border-cyan-200 bg-white px-4 py-3 shadow-xl" role="status" aria-live="polite">\n            <div className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /><p className="text-sm font-black text-slate-800">{imageUploadStage === 'processing' ? 'Procesando imagen…' : 'Subiendo imagen…'}</p></div>\n          </div>\n        )}\n        <FreeBackButton onClick={() => navigate('/admin/free')} />''',
'Servicios: aviso visible de procesamiento/subida')

replace_once(path,
'''          onSave={(blob) => { void saveCroppedServiceImage(blob) }}''',
'''          onSave={saveCroppedServiceImage}''',
'Servicios: callback async real')

# 3) Bank share gets a distinct crawlable URL so WhatsApp does not reuse the generic profile-card cache.
path = 'web/src/components/free-profile/PublicBankAccounts.tsx'
replace_once(path,
'''  function bankSectionUrl() {\n    return `${window.location.origin}/${encodeURIComponent(slug)}#bancos`\n  }''',
'''  function bankSectionUrl() {\n    return `${window.location.origin}/${encodeURIComponent(slug)}?share=bancos#bancos`\n  }''',
'Cuenta bancaria: URL social específica')

# 4) Preview frontdoor: do not require Accept:text/html (social crawlers often send */*),
# make OG image absolute, and use bank-specific card title/description when ?share=bancos.
path = 'api/src/preview-frontdoor-entry.ts'
replace_once(path,
'''  const accept = request.headers.get('Accept') || ''\n  if (!slug || slug.includes('.') || request.method.toUpperCase() !== 'GET' || !accept.includes('text/html') || response.status !== 200) return response''',
'''  if (!slug || slug.includes('.') || request.method.toUpperCase() !== 'GET' || response.status !== 200) return response''',
'OG: aceptar crawlers sociales con Accept genérico')

replace_once(path,
'''  const image = String((row as any).avatar_url || '').trim()\n  const canonical = `${url.origin}/${encodeURIComponent(slug)}`\n  const title = `${name} | Kawvo Link`\n  const description = bio || `Perfil digital de ${name}. Contacto, servicios y formas de conectar en un solo lugar.`''',
'''  const imageRaw = String((row as any).avatar_url || '').trim()\n  let image = ''\n  if (imageRaw) {\n    try { image = new URL(imageRaw, url.origin).toString() } catch { image = imageRaw }\n  }\n  const bankShare = url.searchParams.get('share') === 'bancos'\n  const canonical = bankShare\n    ? `${url.origin}/${encodeURIComponent(slug)}?share=bancos`\n    : `${url.origin}/${encodeURIComponent(slug)}`\n  const title = bankShare ? name : `${name} | Kawvo Link`\n  const description = bankShare\n    ? `Te comparto mis datos bancarios para transferencias.`\n    : (bio || `Perfil digital de ${name}. Contacto, servicios y formas de conectar en un solo lugar.`)''',
'OG: card bancaria con nombre del usuario e imagen absoluta')

replace_once(path,
'''    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',\n    `<meta name="twitter:card" content="summary_large_image">`,''',
'''    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',\n    image ? `<meta property="og:image:alt" content="Foto de ${escapeHtml(name)}">` : '',\n    `<meta name="twitter:card" content="summary_large_image">`,''',
'OG: texto alternativo de imagen')

print('✓ Fix de carga de imágenes y graphic card bancaria aplicado.')
