import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiUpload, API_BASE } from '../../../lib/api'

type Photo = { id: string; image_key: string }
const MAX_PHOTOS = 5

function photoUrl(key: string) {
  return `${API_BASE}/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
}

export default function FreePortfolio() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const json: any = await apiGet('/me/gallery')
    if (json.ok) setPhotos(json.photos || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || photos.length >= MAX_PHOTOS) return
    if (inputRef.current) inputRef.current.value = ''
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const json: any = await apiUpload('/profile/gallery/upload', fd)
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

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">
        <button onClick={() => navigate('/admin/free')} className="mb-5 text-sm font-bold text-cyan-700">← Mi panel</button>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Portafolio</h1>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm">{photos.length}/{MAX_PHOTOS}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Muestra trabajos, productos o imágenes de tu negocio.</p>

        <section className="mt-5 grid grid-cols-2 gap-3">
          {loading ? <div className="col-span-2 rounded-3xl bg-white p-5 text-sm text-slate-400">Cargando…</div> : photos.map((photo) => (
            <div key={photo.id} className="aspect-square overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
              <img src={photoUrl(photo.image_key)} alt="Portafolio" className="h-full w-full object-cover" />
            </div>
          ))}
          {!loading && photos.length === 0 && <div className="col-span-2 rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center"><div className="text-3xl">▧</div><p className="mt-3 text-sm font-black">Aún no tienes imágenes</p><p className="mt-1 text-xs leading-5 text-slate-400">Empieza agregando una imagen de tu trabajo o negocio.</p></div>}
        </section>

        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="hidden" />
        <button onClick={() => inputRef.current?.click()} disabled={uploading || photos.length >= MAX_PHOTOS} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40">{uploading ? 'Subiendo…' : photos.length >= MAX_PHOTOS ? 'Límite completado' : 'Agregar imagen'}</button>
        {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
        <p className="mt-3 text-center text-xs leading-5 text-slate-400">En Gratis puedes mostrar hasta 5 imágenes.</p>
      </div>
    </main>
  )
}
