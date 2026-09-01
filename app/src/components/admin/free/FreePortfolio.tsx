import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPut, apiUpload, API_BASE } from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'
import { FreeBackButton, FreeLimitUpgradeCard, FreeUpgradeCard } from './FreePanelUi'

type Photo = {
  id: string
  image_key: string
  title?: string | null
  description?: string | null
}

const MAX_PHOTOS = 5
const DESCRIPTION_LIMIT = 90
const PORTFOLIO_TITLES = ['Portafolio', 'Mis trabajos', 'Proyectos'] as const

function photoUrl(key: string) {
  return `${API_BASE}/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
}

async function optimizeImageForUpload(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  const objectUrl = URL.createObjectURL(file)
  let bitmap: ImageBitmap | null = null
  try {
    let source: CanvasImageSource
    let originalWidth: number
    let originalHeight: number

    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file)
        source = bitmap
        originalWidth = bitmap.width
        originalHeight = bitmap.height
      } catch {
        const image = new Image()
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
          image.src = objectUrl
        })
        source = image
        originalWidth = image.naturalWidth
        originalHeight = image.naturalHeight
      }
    } else {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
        image.src = objectUrl
      })
      source = image
      originalWidth = image.naturalWidth
      originalHeight = image.naturalHeight
    }

    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight))
    const width = Math.max(1, Math.round(originalWidth * scale))
    const height = Math.max(1, Math.round(originalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.drawImage(source, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('No se pudo optimizar la imagen.')), 'image/webp', quality)
    })

    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'portfolio'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } finally {
    bitmap?.close()
    URL.revokeObjectURL(objectUrl)
  }
}

async function imageUrlToFile(url: string, name: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo cargar la imagen actual.')
  const blob = await response.blob()
  const type = blob.type || 'image/jpeg'
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
  return new File([blob], `${name}.${ext}`, { type, lastModified: Date.now() })
}

export default function FreePortfolio() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const uploadLockRef = useRef(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<'idle' | 'processing' | 'uploading'>('idle')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropMode, setCropMode] = useState<'new' | 'replace' | 'adjust' | null>(null)
  const [templateData, setTemplateData] = useState<Record<string, unknown>>({})
  const [sectionTitle, setSectionTitle] = useState<(typeof PORTFOLIO_TITLES)[number]>('Portafolio')

  const load = async () => {
    const [galleryJson, meJson]: any[] = await Promise.all([apiGet('/me/gallery'), apiGet('/me')])
    if (galleryJson.ok) setPhotos(galleryJson.photos || [])
    if (meJson.ok && meJson.data) {
      const td = meJson.data.templateData && typeof meJson.data.templateData === 'object' ? meJson.data.templateData : {}
      setTemplateData(td)
      const saved = String(td.portfolio_section_title || 'Portafolio') as (typeof PORTFOLIO_TITLES)[number]
      setSectionTitle(PORTFOLIO_TITLES.includes(saved) ? saved : 'Portafolio')
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const saveSectionTitle = async (next: (typeof PORTFOLIO_TITLES)[number]) => {
    setSectionTitle(next)
    const nextTemplate = { ...templateData, portfolio_section_title: next }
    setTemplateData(nextTemplate)
    const json: any = await apiPut('/me/profile', { template_data: nextTemplate })
    if (!json.ok) setError(json.error || 'No se pudo guardar el título de la sección.')
  }

  const sendOptimizedImage = async (file: File, path: string) => {
    const optimized = await optimizeImageForUpload(file)
    const fd = new FormData()
    fd.append('file', optimized, optimized.name)
    return apiUpload(path, fd) as Promise<any>
  }

  const chooseNewImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file || photos.length >= MAX_PHOTOS) return
    setCropMode('new')
    setCropFile(file)
    setError('')
  }

  const chooseReplacementImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (replaceInputRef.current) replaceInputRef.current.value = ''
    if (!file || !replaceTargetId) return
    setCropMode('replace')
    setCropFile(file)
    setError('')
  }

  const cancelCrop = () => {
    setCropFile(null)
    setCropMode(null)
    setReplaceTargetId(null)
  }

  const startAdjust = async (photo: Photo) => {
    if (uploading) return
    setUploading(true)
    setError('')
    try {
      const file = await imageUrlToFile(photoUrl(photo.image_key), `portfolio-${photo.id}`)
      setReplaceTargetId(photo.id)
      setCropMode('adjust')
      setCropFile(file)
    } catch {
      setError('No pudimos abrir la imagen actual para ajustar su encuadre.')
    } finally {
      setUploading(false)
    }
  }

  const saveCroppedImage = async (blob: Blob) => {
    if (!cropFile || !cropMode || uploadLockRef.current) return
    uploadLockRef.current = true
    const sourceFile = cropFile
    const mode = cropMode
    const targetId = replaceTargetId
    const baseName = sourceFile.name.replace(/\.[^.]+$/, '') || 'portfolio'
    const croppedFile = new File([blob], `${baseName}-crop.jpg`, { type: blob.type || 'image/jpeg', lastModified: Date.now() })
    const path = mode !== 'new' && targetId
      ? `/me/gallery/${targetId}/replace`
      : '/profile/gallery/upload'

    // Cierra inmediatamente el editor de encuadre y muestra el estado real en Portafolio.
    setCropFile(null)
    setUploading(true)
    setUploadStage('processing')
    setError('')
    try {
      const optimized = await optimizeImageForUpload(croppedFile)
      setUploadStage('uploading')
      const fd = new FormData()
      fd.append('file', optimized, optimized.name)
      const json: any = await apiUpload(path, fd)
      if (!json.ok) {
        setError(json.error || (mode === 'new' ? 'No se pudo subir la imagen.' : 'No se pudo actualizar la imagen.'))
        return
      }
      await load()
    } catch {
      setError(mode === 'new' ? 'No pudimos subir la imagen.' : 'No pudimos actualizar la imagen.')
    } finally {
      uploadLockRef.current = false
      setCropMode(null)
      setReplaceTargetId(null)
      setUploading(false)
      setUploadStage('idle')
    }
  }

  const startEdit = (photo: Photo) => {
    setEditingId(photo.id)
    setEditTitle(photo.title || '')
    setEditDescription((photo.description || '').slice(0, DESCRIPTION_LIMIT))
    setError('')
  }

  const saveMetadata = async (photo: Photo) => {
    setUploading(true)
    setError('')
    try {
      const json: any = await apiPut(`/me/gallery/${photo.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim().slice(0, DESCRIPTION_LIMIT),
      })
      if (!json.ok) return setError(json.error || 'No se pudieron guardar los datos de la imagen.')
      setEditingId(null)
      await load()
    } finally {
      setUploading(false)
    }
  }

  const remove = async (photo: Photo) => {
    if (!window.confirm('¿Eliminar esta imagen del portafolio?')) return
    setUploading(true)
    setError('')
    try {
      const json: any = await apiDelete(`/me/gallery/${photo.id}`)
      if (!json.ok) return setError(json.error || 'No se pudo eliminar la imagen.')
      if (editingId === photo.id) setEditingId(null)
      await load()
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">
        {uploading && uploadStage !== 'idle' && (
          <div className="fixed inset-x-4 top-4 z-40 mx-auto max-w-[398px] rounded-2xl border border-cyan-200 bg-white px-4 py-3 shadow-xl" role="status" aria-live="polite">
            <div className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /><p className="text-sm font-black text-slate-800">{uploadStage === 'processing' ? 'Procesando imagen…' : 'Subiendo imagen…'}</p></div>
          </div>
        )}
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Portafolio</h1>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm">{photos.length}/{MAX_PHOTOS}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Muestra hasta 5 trabajos. El límite no bloquea editar, reemplazar ni eliminar.</p>

        <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4">
          <p className="text-xs font-black text-slate-700">Título visible de la sección</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PORTFOLIO_TITLES.map((option) => (
              <button key={option} type="button" onClick={() => void saveSectionTitle(option)} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${sectionTitle === option ? 'bg-cyan-600 text-white' : 'bg-slate-50 text-slate-600'}`}>{option}</button>
            ))}
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {loading ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-400">Cargando…</div> : photos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <button type="button" disabled={uploading} onClick={() => { setReplaceTargetId(photo.id); replaceInputRef.current?.click() }} className="relative block aspect-square w-full overflow-hidden bg-slate-100 disabled:opacity-50" aria-label="Cambiar imagen del portafolio"><img src={photoUrl(photo.image_key)} alt={photo.title || 'Portafolio'} loading="lazy" decoding="async" className="h-full w-full object-cover" /><span className="absolute bottom-2 right-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-black text-white">Toca para cambiar</span></button>
              {editingId === photo.id ? (
                <div className="p-4">
                  <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} placeholder="Título de la imagen" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                  <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value.slice(0, DESCRIPTION_LIMIT))} maxLength={DESCRIPTION_LIMIT} rows={2} placeholder="Descripción breve, máximo 2 líneas" className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                  <div className="mt-1 flex items-center justify-between text-[11px]"><span className={editDescription.length >= DESCRIPTION_LIMIT ? 'font-bold text-amber-600' : 'text-slate-400'}>{editDescription.length >= DESCRIPTION_LIMIT ? 'Límite de caracteres alcanzado' : 'Máximo 2 líneas'}</span><span className="font-bold text-slate-500">{editDescription.length}/{DESCRIPTION_LIMIT}</span></div>
                  <button type="button" disabled={uploading} onClick={() => void startAdjust(photo)} className="mt-3 w-full rounded-xl bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-700 disabled:opacity-40">Ajustar encuadre de imagen</button>
                  <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditingId(null)} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600">Cancelar</button><button type="button" disabled={uploading} onClick={() => void saveMetadata(photo)} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">Guardar</button></div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm font-black text-slate-900">{photo.title || 'Sin título'}</p>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">{photo.description || 'Agrega una descripción breve para el modal de tu perfil.'}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => startEdit(photo)} className="rounded-xl bg-cyan-50 px-2 py-2 text-[11px] font-black text-cyan-700">Editar textos</button><button type="button" disabled={uploading} onClick={() => { setReplaceTargetId(photo.id); replaceInputRef.current?.click() }} className="rounded-xl bg-slate-50 px-2 py-2 text-[11px] font-black text-slate-600 disabled:opacity-40">Reemplazar</button><button type="button" disabled={uploading} onClick={() => void remove(photo)} className="rounded-xl bg-red-50 px-2 py-2 text-[11px] font-black text-red-600 disabled:opacity-40">Eliminar</button></div>
                </div>
              )}
            </article>
          ))}
        </section>

        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseNewImage} disabled={uploading} className="hidden" />
        <input ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseReplacementImage} disabled={uploading} className="hidden" />
        <button onClick={() => inputRef.current?.click()} disabled={uploading || photos.length >= MAX_PHOTOS} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40">{uploading ? (uploadStage === 'uploading' ? 'Subiendo imagen…' : 'Procesando imagen…') : photos.length >= MAX_PHOTOS ? 'Límite completado' : 'Agregar imagen'}</button>
        {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
        {photos.length >= MAX_PHOTOS && <FreeLimitUpgradeCard text="Ya utilizas las 5 imágenes disponibles. Puedes seguir gestionándolas o pasar al Plan Plus para ampliar tu alcance." />}
        {photos.length < MAX_PHOTOS && <div className="mt-5"><FreeUpgradeCard compact /></div>}
        <div className="mt-4"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>
      </div>

      {cropFile && cropMode && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={1}
          outputWidth={1200}
          onSave={saveCroppedImage}
          onCancel={cancelCrop}
        />
      )}
    </main>
  )
}
