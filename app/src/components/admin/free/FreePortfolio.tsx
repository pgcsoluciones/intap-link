import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPut, apiUpload, API_BASE } from '../../../lib/api'
import { FreeBackButton, FreeUpgradeCard } from './FreePanelUi'

type Photo = {
  id: string
  image_key: string
  title?: string | null
  description?: string | null
}

const MAX_PHOTOS = 5

function photoUrl(key: string) {
  return `${API_BASE}/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
}

async function optimizeImageForUpload(
  file: File,
  maxDimension = 1600,
  quality = 0.82,
): Promise<File> {
  const loadViaImage = async () => {
    const objectUrl = URL.createObjectURL(file)
    try {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
        image.src = objectUrl
      })
      return { source: image as CanvasImageSource, width: image.naturalWidth, height: image.naturalHeight }
    } finally {
      // The object URL must stay alive until the image has decoded; onload above guarantees that.
      URL.revokeObjectURL(objectUrl)
    }
  }

  let source: CanvasImageSource
  let originalWidth: number
  let originalHeight: number
  let bitmap: ImageBitmap | null = null

  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file)
      source = bitmap
      originalWidth = bitmap.width
      originalHeight = bitmap.height
    } catch {
      const fallback = await loadViaImage()
      source = fallback.source
      originalWidth = fallback.width
      originalHeight = fallback.height
    }
  } else {
    const fallback = await loadViaImage()
    source = fallback.source
    originalWidth = fallback.width
    originalHeight = fallback.height
  }

  try {
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
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error('No se pudo optimizar la imagen.'))
          return
        }
        resolve(result)
      }, 'image/webp', quality)
    })

    const baseName = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'portfolio'

    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  } finally {
    bitmap?.close()
  }
}

export default function FreePortfolio() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)

  const load = async () => {
    const json: any = await apiGet('/me/gallery')
    if (json.ok) setPhotos(json.photos || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const sendOptimizedImage = async (file: File, path: string) => {
    const optimized = await optimizeImageForUpload(file)
    const fd = new FormData()
    fd.append('file', optimized, optimized.name)
    return apiUpload(path, fd) as Promise<any>
  }

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || photos.length >= MAX_PHOTOS) return
    if (inputRef.current) inputRef.current.value = ''
    setUploading(true)
    setError('')
    try {
      const json = await sendOptimizedImage(file, '/profile/gallery/upload')
      if (!json.ok) {
        setError(json.error || 'No se pudo subir la imagen.')
        return
      }
      await load()
    } catch {
      setError('No pudimos subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const startEdit = (photo: Photo) => {
    setEditingId(photo.id)
    setEditTitle(photo.title || '')
    setEditDescription(photo.description || '')
    setError('')
  }

  const saveMetadata = async (photo: Photo) => {
    setUploading(true)
    setError('')
    try {
      const json: any = await apiPut(`/me/gallery/${photo.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      })
      if (!json.ok) {
        setError(json.error || 'No se pudieron guardar los datos de la imagen.')
        return
      }
      setEditingId(null)
      await load()
    } finally {
      setUploading(false)
    }
  }

  const chooseReplacement = (photo: Photo) => {
    setReplaceTargetId(photo.id)
    setError('')
    replaceInputRef.current?.click()
  }

  const replaceImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (replaceInputRef.current) replaceInputRef.current.value = ''
    if (!file || !replaceTargetId) return

    setUploading(true)
    setError('')
    try {
      const json = await sendOptimizedImage(file, `/me/gallery/${replaceTargetId}/replace`)
      if (!json.ok) {
        setError(json.error || 'No se pudo reemplazar la imagen.')
        return
      }
      await load()
    } catch {
      setError('No pudimos reemplazar la imagen.')
    } finally {
      setReplaceTargetId(null)
      setUploading(false)
    }
  }

  const remove = async (photo: Photo) => {
    if (!window.confirm('¿Eliminar esta imagen del portafolio?')) return
    setUploading(true)
    setError('')
    try {
      const json: any = await apiDelete(`/me/gallery/${photo.id}`)
      if (!json.ok) {
        setError(json.error || 'No se pudo eliminar la imagen.')
        return
      }
      if (editingId === photo.id) setEditingId(null)
      await load()
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Portafolio</h1>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm">{photos.length}/{MAX_PHOTOS}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Muestra hasta 5 trabajos. Al completar el límite todavía puedes editar, reemplazar o eliminar cualquiera.</p>

        <section className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-3xl bg-white p-5 text-sm text-slate-400">Cargando…</div>
          ) : photos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={photoUrl(photo.image_key)}
                  alt={photo.title || 'Portafolio'}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>

              {editingId === photo.id ? (
                <div className="p-4">
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    maxLength={80}
                    placeholder="Título de la imagen"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    maxLength={220}
                    rows={3}
                    placeholder="Descripción breve (se mostrará en máximo 2 líneas)"
                    className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600">Cancelar</button>
                    <button type="button" disabled={uploading} onClick={() => void saveMetadata(photo)} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">Guardar</button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm font-black text-slate-900">{photo.title || 'Sin título'}</p>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">{photo.description || 'Agrega una descripción breve para el modal de tu perfil.'}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={() => startEdit(photo)} className="rounded-xl bg-cyan-50 px-2 py-2 text-[11px] font-black text-cyan-700">Editar</button>
                    <button type="button" disabled={uploading} onClick={() => chooseReplacement(photo)} className="rounded-xl bg-slate-50 px-2 py-2 text-[11px] font-black text-slate-600 disabled:opacity-40">Reemplazar</button>
                    <button type="button" disabled={uploading} onClick={() => void remove(photo)} className="rounded-xl bg-red-50 px-2 py-2 text-[11px] font-black text-red-600 disabled:opacity-40">Eliminar</button>
                  </div>
                </div>
              )}
            </article>
          ))}

          {!loading && photos.length === 0 && (
            <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="text-3xl">▧</div>
              <p className="mt-3 text-sm font-black">Aún no tienes imágenes</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Empieza agregando una imagen de tu trabajo o negocio.</p>
            </div>
          )}
        </section>

        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="hidden" />
        <input ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={replaceImage} className="hidden" />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || photos.length >= MAX_PHOTOS}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40"
        >
          {uploading ? 'Procesando…' : photos.length >= MAX_PHOTOS ? 'Límite completado' : 'Agregar imagen'}
        </button>
        {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
        <p className="mt-3 text-center text-xs leading-5 text-slate-400">El límite solo impide agregar una sexta imagen; la gestión de las existentes siempre queda disponible.</p>

        <div className="mt-5">
          <FreeUpgradeCard compact />
        </div>
      </div>
    </main>
  )
}