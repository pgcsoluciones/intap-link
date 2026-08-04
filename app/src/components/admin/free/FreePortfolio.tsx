import {
  useEffect,
  useState,
} from 'react'
import {
  useNavigate,
} from 'react-router-dom'
import {
  API_BASE,
  apiDelete,
  apiGet,
  apiUpload,
} from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'

interface PortfolioPhoto {
  id: string
  image_key: string
}

const MIN_FREE_PHOTOS = 3
const MAX_FREE_PHOTOS = 5

function photoUrl(key: string): string {
  if (/^https?:\/\//i.test(key)) {
    return key
  }

  const encodedKey = key
    .split('/')
    .map(encodeURIComponent)
    .join('/')

  return (
    `${API_BASE}/public/assets/` +
    encodedKey
  )
}

export default function FreePortfolio() {
  const navigate = useNavigate()

  const [photos, setPhotos] =
    useState<PortfolioPhoto[]>([])

  const [loading, setLoading] =
    useState(true)

  const [uploading, setUploading] =
    useState(false)

  const [cropFile, setCropFile] =
    useState<File | null>(null)

  const [error, setError] =
    useState('')

  const reload = async () => {
    try {
      const json: any =
        await apiGet('/me/gallery')

      if (
        json.ok &&
        Array.isArray(json.photos)
      ) {
        setPhotos(json.photos)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setError('')

    if (photos.length >= MAX_FREE_PHOTOS) {
      setError(
        'Ya alcanzaste el máximo de 5 imágenes.',
      )
      event.target.value = ''
      return
    }

    const file =
      event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError(
        'Selecciona una imagen JPG, PNG o WEBP.',
      )
      return
    }

    setCropFile(file)
  }

  const handleCropSave = async (
    blob: Blob,
  ) => {
    setCropFile(null)
    setUploading(true)
    setError('')

    try {
      const formData =
        new FormData()

      formData.append(
        'file',
        blob,
        'portfolio.jpg',
      )

      const json: any =
        await apiUpload(
          '/profile/gallery/upload',
          formData,
        )

      if (json.ok && json.key) {
        await reload()
        return
      }

      if (json.limit) {
        setError(
          `Alcanzaste el límite de ${json.limit} imágenes de tu plan.`,
        )
        return
      }

      setError(
        json.error ||
        'No se pudo subir la imagen.',
      )
    } catch {
      setError(
        'Error de conexión al subir la imagen.',
      )
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (
    photo: PortfolioPhoto,
  ) => {
    const confirmed = confirm(
      '¿Eliminar esta imagen del portafolio?',
    )

    if (!confirmed) {
      return
    }

    setError('')

    const json: any =
      await apiDelete(
        `/me/gallery/${encodeURIComponent(
          photo.image_key,
        )}`,
      )

    if (!json.ok) {
      setError(
        json.error ||
        'No se pudo eliminar la imagen.',
      )
      return
    }

    await reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  const minimumComplete =
    photos.length >= MIN_FREE_PHOTOS

  const maximumReached =
    photos.length >= MAX_FREE_PHOTOS

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] px-4 py-10">
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={1}
          outputWidth={1000}
          onSave={handleCropSave}
          onCancel={() => setCropFile(null)}
        />
      )}

      <div className="w-full max-w-lg mx-auto">
        <header className="flex items-center gap-4 mb-7">
          <button
            type="button"
            onClick={() =>
              navigate('/admin/free/links')
            }
            className="text-slate-400 hover:text-slate-900"
          >
            ←
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-black">
              Mi portafolio
            </h1>

            <p className="text-xs text-slate-500 mt-1">
              Muestra trabajos, productos,
              proyectos o momentos destacados.
            </p>
          </div>

          <span className="text-xs font-black bg-white border border-slate-200 rounded-full px-3 py-1.5">
            {photos.length}/{MAX_FREE_PHOTOS}
          </span>
        </header>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-black">
                Imágenes del portafolio
              </p>

              <p className="text-xs text-slate-500 mt-1">
                Necesitas al menos 3 para publicar.
              </p>
            </div>

            <span
              className={`text-xs font-black px-3 py-1.5 rounded-full ${
                minimumComplete
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-orange-50 text-orange-600 border border-orange-200'
              }`}
            >
              {minimumComplete
                ? 'Mínimo completo'
                : `${photos.length}/3 mínimo`}
            </span>
          </div>

          <input
            id="free-portfolio-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={
              uploading ||
              maximumReached
            }
          />

          <label
            htmlFor="free-portfolio-file"
            className={`w-full border-2 border-dashed rounded-2xl px-5 py-8 flex flex-col items-center justify-center text-center transition-colors ${
              uploading || maximumReached
                ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60'
                : 'border-slate-300 bg-slate-50 hover:border-intap-mint hover:bg-intap-mint/5 cursor-pointer'
            }`}
          >
            {uploading ? (
              <>
                <div className="loading-spinner" />

                <span className="text-sm font-bold mt-3">
                  Subiendo imagen…
                </span>
              </>
            ) : maximumReached ? (
              <>
                <span className="text-3xl">
                  ✓
                </span>

                <span className="text-sm font-bold mt-2">
                  Portafolio completo
                </span>

                <span className="text-xs text-slate-500 mt-1">
                  Alcanzaste el máximo de 5 imágenes.
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl">
                  🖼️
                </span>

                <span className="text-sm font-bold mt-2">
                  Examinar imagen
                </span>

                <span className="text-xs text-slate-500 mt-1">
                  JPG, PNG o WEBP
                </span>
              </>
            )}
          </label>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-4">
              {error}
            </p>
          )}
        </section>

        <section className="mt-6">
          {photos.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center">
              <p className="text-3xl">
                📷
              </p>

              <p className="text-sm font-bold mt-3">
                Tu portafolio está vacío
              </p>

              <p className="text-xs text-slate-500 mt-1">
                Sube al menos tres imágenes para
                completar este requisito.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo, index) => (
                <div
                  key={photo.id || photo.image_key}
                  className="relative aspect-square bg-white border border-slate-200 rounded-2xl overflow-hidden group"
                >
                  <img
                    src={photoUrl(photo.image_key)}
                    alt={`Portafolio ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  <span className="absolute top-2 left-2 min-w-7 h-7 px-2 rounded-full bg-black/65 text-white text-xs font-black flex items-center justify-center">
                    {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      deletePhoto(photo)
                    }
                    title="Eliminar imagen"
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 text-red-500 shadow flex items-center justify-center"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() =>
            navigate('/admin/free/services')
          }
          className="w-full mt-7 bg-slate-900 text-white font-bold py-3 rounded-xl text-sm"
        >
          Continuar a servicios →
        </button>

        {!minimumComplete && (
          <p className="text-[11px] text-center text-slate-500 mt-2">
            Puedes continuar y completar las imágenes
            después. El perfil permanecerá como borrador.
          </p>
        )}

        <button
          type="button"
          onClick={() =>
            navigate('/admin')
          }
          className="w-full mt-2 text-xs text-slate-500 py-2"
        >
          Completar después
        </button>
      </div>
    </div>
  )
}
