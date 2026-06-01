import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, apiGet, apiUpload } from '../../lib/api'
import ImageCropModal from './ImageCropModal'

interface Photo {
  id: string
  image_key: string
}

function photoUrl(key: string) {
  return `${API_BASE}/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
}

export default function AdminGallery() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profileId, setProfileId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  useEffect(() => {
    Promise.all([apiGet('/me'), apiGet('/me/gallery')])
      .then(([meJson, galleryJson]: any[]) => {
        if (meJson.ok && meJson.data?.profile_id) {
          setProfileId(meJson.data.profile_id)
        }
        if (galleryJson.ok && Array.isArray(galleryJson.photos)) {
          setPhotos(galleryJson.photos)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleCropSave = async (blob: Blob) => {
    if (!profileId) return
    setCropFile(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('profileId', profileId)
      formData.append('file', blob, 'photo.jpg')
      const res: any = await apiUpload('/profile/gallery/upload', formData)
      if (res.ok && res.photo) {
        setPhotos((prev) => [res.photo, ...prev])
      }
    } finally {
      setUploading(false)
    }
  }

  const handleCropCancel = () => {
    setCropFile(null)
  }

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo)
  }

  const handleViewPhoto = () => {
    if (!selectedPhoto) return
    window.open(photoUrl(selectedPhoto.image_key), '_blank', 'noopener noreferrer')
    setSelectedPhoto(null)
  }

  const handleDeletePhoto = async () => {
    if (!selectedPhoto) return
    const photo = selectedPhoto
    setSelectedPhoto(null)
    // Optimistically remove from list
    setPhotos((prev) => prev.filter((p) => p.image_key !== photo.image_key))
    try {
      await apiGet(`/me/gallery/${encodeURIComponent(photo.image_key)}`)
    } catch { /* ignore if endpoint doesn't exist */ }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter']">
      {/* Crop modal */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={1}
          outputWidth={800}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}

      {/* Photo options modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="w-full max-w-sm bg-[#111827] rounded-2xl p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-slate-400 text-center font-bold uppercase tracking-wide">Opciones de foto</p>
            <button
              onClick={handleViewPhoto}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white hover:bg-white/10 transition-colors"
            >
              Ver en nueva pestaña
            </button>
            <button
              onClick={handleDeletePhoto}
              className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-bold text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Eliminar foto
            </button>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-full py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-intap-dark/95 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-bold text-white">Galería de fotos</span>
      </header>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Upload card */}
        <div className="glass-card p-4 border border-white/10 flex flex-col gap-3">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <span>📸</span> Subir foto
          </p>

          <input
            ref={fileInputRef}
            id="gallery-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <label
            htmlFor="gallery-file"
            className={`flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed border-white/20 bg-white/3 hover:bg-white/5 hover:border-intap-mint/40 transition-all cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {uploading ? (
              <>
                <div className="loading-spinner" />
                <span className="text-xs text-slate-400">Subiendo…</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-bold text-white">Examinar archivo</span>
                <span className="text-xs text-slate-500">Formatos: JPG, PNG, WEBP</span>
              </>
            )}
          </label>
        </div>

        {/* Gallery grid */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Fotos ({photos.length})
          </p>

          {photos.length === 0 ? (
            <div className="glass-card p-6 border border-white/10 flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">🖼️</span>
              <p className="text-sm text-slate-400">No hay fotos todavía. Sube tu primera foto.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => handlePhotoClick(photo)}
                  className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-all active:scale-95"
                >
                  <img
                    src={photoUrl(photo.image_key)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
