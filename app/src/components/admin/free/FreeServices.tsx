import {
  useEffect,
  useState,
} from 'react'
import {
  useNavigate,
} from 'react-router-dom'
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  apiUpload,
} from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'

type ServiceIconKey =
  | 'home'
  | 'key'
  | 'chart-line'
  | 'handshake'

interface FreeServiceItem {
  id: string
  title: string
  description: string | null
  image_url: string | null
  whatsapp_text: string | null
}

interface ServiceForm {
  title: string
  description: string
  image_url: string
  whatsapp_text: string
}

const MIN_FREE_SERVICES = 2
const MAX_FREE_SERVICES = 3

const ICON_OPTIONS: Array<{
  key: ServiceIconKey
  glyph: string
  label: string
}> = [
  {
    key: 'home',
    glyph: '⌂',
    label: 'Hogar',
  },
  {
    key: 'key',
    glyph: '⚿',
    label: 'Llave',
  },
  {
    key: 'chart-line',
    glyph: '↗',
    label: 'Crecimiento',
  },
  {
    key: 'handshake',
    glyph: '🤝',
    label: 'Acuerdo',
  },
]

const EMPTY_FORM: ServiceForm = {
  title: '',
  description: '',
  image_url: 'icon:home',
  whatsapp_text: '',
}

function isIconVisual(
  value: string | null | undefined,
): boolean {
  return Boolean(
    value?.startsWith('icon:'),
  )
}

function iconKeyFromVisual(
  value: string | null | undefined,
): ServiceIconKey {
  const key = value?.replace(
    /^icon:/,
    '',
  )

  return ICON_OPTIONS.some(
    (option) => option.key === key,
  )
    ? key as ServiceIconKey
    : 'home'
}

function iconGlyph(
  key: ServiceIconKey,
): string {
  return (
    ICON_OPTIONS.find(
      (option) => option.key === key,
    )?.glyph || '⌂'
  )
}

export default function FreeServices() {
  const navigate = useNavigate()

  const [services, setServices] =
    useState<FreeServiceItem[]>([])

  const [form, setForm] =
    useState<ServiceForm>(EMPTY_FORM)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [visualMode, setVisualMode] =
    useState<'icon' | 'image'>('icon')

  const [selectedIcon, setSelectedIcon] =
    useState<ServiceIconKey>('home')

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [uploading, setUploading] =
    useState(false)

  const [cropFile, setCropFile] =
    useState<File | null>(null)

  const [error, setError] =
    useState('')

  const reload = async () => {
    try {
      const json: any =
        await apiGet('/me/products')

      if (json.ok) {
        setServices(json.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setVisualMode('icon')
    setSelectedIcon('home')
    setCropFile(null)
    setError('')
  }

  const selectIcon = (
    key: ServiceIconKey,
  ) => {
    setVisualMode('icon')
    setSelectedIcon(key)

    setForm((current) => ({
      ...current,
      image_url: `icon:${key}`,
    }))
  }

  const handleFile = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setError('')

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
        'servicio.jpg',
      )

      const json: any =
        await apiUpload(
          '/me/service-image/upload',
          formData,
        )

      if (json.ok && json.url) {
        setVisualMode('image')

        setForm((current) => ({
          ...current,
          image_url: json.url,
        }))

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

  const editService = (
    service: FreeServiceItem,
  ) => {
    const imageUrl =
      service.image_url || 'icon:home'

    setEditingId(service.id)

    setForm({
      title: service.title,
      description:
        service.description || '',
      image_url: imageUrl,
      whatsapp_text:
        service.whatsapp_text || '',
    })

    if (isIconVisual(imageUrl)) {
      const key =
        iconKeyFromVisual(imageUrl)

      setVisualMode('icon')
      setSelectedIcon(key)
    } else {
      setVisualMode('image')
    }

    setError('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const saveService = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault()
    setError('')

    if (!editingId &&
        services.length >= MAX_FREE_SERVICES) {
      setError(
        'Ya alcanzaste el máximo de 3 servicios.',
      )
      return
    }

    const title =
      form.title.trim()

    const description =
      form.description.trim()

    const imageUrl =
      visualMode === 'icon'
        ? `icon:${selectedIcon}`
        : form.image_url.trim()

    if (!title) {
      setError(
        'Escribe el nombre del servicio.',
      )
      return
    }

    if (!description) {
      setError(
        'Escribe una descripción breve.',
      )
      return
    }

    if (!imageUrl) {
      setError(
        'Selecciona una imagen o un ícono.',
      )
      return
    }

    setSaving(true)

    const payload = {
      title,
      description,
      image_url: imageUrl,
      whatsapp_text:
        form.whatsapp_text.trim(),
    }

    try {
      const json: any =
        editingId
          ? await apiPut(
              `/me/products/${editingId}`,
              payload,
            )
          : await apiPost(
              '/me/products',
              payload,
            )

      if (json.ok) {
        resetForm()
        await reload()
        return
      }

      if (json.limit) {
        setError(
          `Alcanzaste el límite de ${json.limit} servicios.`,
        )
        return
      }

      setError(
        json.error ||
        'No se pudo guardar el servicio.',
      )
    } catch {
      setError(
        'Error de conexión al guardar.',
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteService = async (
    service: FreeServiceItem,
  ) => {
    if (
      !confirm(
        `¿Eliminar “${service.title}”?`,
      )
    ) {
      return
    }

    const json: any =
      await apiDelete(
        `/me/products/${service.id}`,
      )

    if (!json.ok) {
      setError(
        json.error ||
        'No se pudo eliminar el servicio.',
      )
      return
    }

    if (editingId === service.id) {
      resetForm()
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
    services.length >= MIN_FREE_SERVICES

  const maximumReached =
    services.length >= MAX_FREE_SERVICES

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] px-4 py-10">
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={4 / 3}
          outputWidth={1200}
          onSave={handleCropSave}
          onCancel={() =>
            setCropFile(null)
          }
        />
      )}

      <div className="w-full max-w-lg mx-auto">
        <header className="flex items-center gap-4 mb-7">
          <button
            type="button"
            onClick={() =>
              navigate('/admin/free/portfolio')
            }
            className="text-slate-400 hover:text-slate-900"
          >
            ←
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-black">
              Mis servicios
            </h1>

            <p className="text-xs text-slate-500 mt-1">
              Presenta claramente lo que
              haces y cómo pueden contactarte.
            </p>
          </div>

          <span className="text-xs font-black bg-white border border-slate-200 rounded-full px-3 py-1.5">
            {services.length}/{MAX_FREE_SERVICES}
          </span>
        </header>

        <form
          onSubmit={saveService}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              {editingId
                ? 'Editar servicio'
                : 'Agregar servicio'}
            </p>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-500"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <input
            type="text"
            value={form.title}
            onChange={(event) =>
              setForm({
                ...form,
                title: event.target.value,
              })
            }
            placeholder="Nombre del servicio"
            maxLength={80}
            required
            disabled={
              maximumReached &&
              !editingId
            }
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-intap-mint/50 disabled:bg-slate-100"
          />

          <textarea
            value={form.description}
            onChange={(event) =>
              setForm({
                ...form,
                description:
                  event.target.value,
              })
            }
            placeholder="Descripción breve del servicio"
            maxLength={220}
            rows={3}
            required
            disabled={
              maximumReached &&
              !editingId
            }
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-intap-mint/50 resize-none disabled:bg-slate-100"
          />

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">
              Imagen o ícono
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() =>
                  setVisualMode('icon')
                }
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                  visualMode === 'icon'
                    ? 'border-intap-mint bg-intap-mint/10 text-intap-mint'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                Usar ícono
              </button>

              <label
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold text-center cursor-pointer ${
                  visualMode === 'image'
                    ? 'border-intap-mint bg-intap-mint/10 text-intap-mint'
                    : 'border-slate-200 text-slate-500'
                } ${uploading
                    ? 'opacity-50 pointer-events-none'
                    : ''
                }`}
              >
                {uploading
                  ? 'Subiendo…'
                  : 'Examinar imagen'}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            </div>

            {visualMode === 'icon' ? (
              <div className="grid grid-cols-4 gap-2">
                {ICON_OPTIONS.map(
                  (option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() =>
                        selectIcon(option.key)
                      }
                      title={option.label}
                      className={`aspect-square rounded-xl border flex flex-col items-center justify-center ${
                        selectedIcon === option.key
                          ? 'border-intap-mint bg-intap-mint/10 text-intap-mint'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="text-2xl">
                        {option.glyph}
                      </span>

                      <span className="text-[9px] font-bold mt-1">
                        {option.label}
                      </span>
                    </button>
                  ),
                )}
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden">
                {form.image_url &&
                !isIconVisual(
                  form.image_url,
                ) ? (
                  <img
                    src={form.image_url}
                    alt="Vista previa del servicio"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                    Examina una imagen
                  </div>
                )}
              </div>
            )}
          </div>

          <input
            type="text"
            value={form.whatsapp_text}
            onChange={(event) =>
              setForm({
                ...form,
                whatsapp_text:
                  event.target.value,
              })
            }
            placeholder="Mensaje para WhatsApp, por ejemplo: Quiero información sobre este servicio"
            maxLength={180}
            disabled={
              maximumReached &&
              !editingId
            }
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-intap-mint/50 disabled:bg-slate-100"
          />

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              saving ||
              uploading ||
              (
                maximumReached &&
                !editingId
              )
            }
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Guardando…'
              : editingId
                ? 'Guardar cambios'
                : maximumReached
                  ? 'Límite alcanzado'
                  : '+ Agregar servicio'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          {services.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center">
              <p className="text-3xl">
                🧩
              </p>

              <p className="text-sm font-bold mt-3">
                Todavía no tienes servicios
              </p>

              <p className="text-xs text-slate-500 mt-1">
                Agrega por lo menos dos para
                completar este requisito.
              </p>
            </div>
          ) : (
            services.map((service) => (
              <article
                key={service.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4"
              >
                <div className="w-20 h-20 shrink-0 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                  {isIconVisual(
                    service.image_url,
                  ) ? (
                    <span className="text-3xl text-intap-blue">
                      {iconGlyph(
                        iconKeyFromVisual(
                          service.image_url,
                        ),
                      )}
                    </span>
                  ) : service.image_url ? (
                    <img
                      src={service.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">
                      ⌂
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black">
                    {service.title}
                  </p>

                  <p className="text-xs text-slate-500 mt-1 line-clamp-3">
                    {service.description}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      editService(service)
                    }
                    title="Editar"
                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-600"
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deleteService(service)
                    }
                    title="Eliminar"
                    className="w-8 h-8 rounded-full bg-red-50 text-red-500"
                  >
                    🗑
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-xs font-bold ${
            minimumComplete
              ? 'bg-green-50 border-green-200 text-green-600'
              : 'bg-orange-50 border-orange-200 text-orange-600'
          }`}
        >
          {minimumComplete
            ? '✓ Requisito mínimo completado'
            : `${services.length}/2 servicios mínimos para publicar`}
        </div>

        <button
          type="button"
          onClick={() =>
            navigate('/admin')
          }
          className="w-full mt-7 bg-slate-900 text-white font-bold py-3 rounded-xl text-sm"
        >
          Guardar y volver al panel
        </button>
      </div>
    </div>
  )
}
