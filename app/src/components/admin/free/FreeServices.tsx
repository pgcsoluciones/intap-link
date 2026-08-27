import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'
import { FreeBackButton, FreeLimitUpgradeCard, FreeUpgradeCard } from './FreePanelUi'

type Service = {
  id: string
  title: string
  description?: string | null
  image_url?: string | null
}

const MAX_SERVICES = 3
const DESCRIPTION_LIMIT = 90
const SERVICE_TITLE_LIMIT = 60
const SECTION_DESCRIPTION_LIMIT = 240
const SERVICE_TITLE_SUGGESTIONS = ['Servicios', 'Qué hacemos', 'Lo que ofrezco'] as const

async function optimizeServiceImage(file: File): Promise<File> {
  const maxDimension = 1200
  const quality = 0.82
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      image.src = objectUrl
    })
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('No se pudo optimizar la imagen.')), 'image/webp', quality)
    })
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'servicio'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } finally {
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

export default function FreeServices() {
  const navigate = useNavigate()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Service[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [imageTargetId, setImageTargetId] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [templateData, setTemplateData] = useState<Record<string, unknown>>({})
  const [sectionTitle, setSectionTitle] = useState('Servicios')
  const [sectionDescription, setSectionDescription] = useState('')
  const [savingSection, setSavingSection] = useState(false)

  const canAdd = useMemo(() => items.length < MAX_SERVICES, [items.length])

  const load = async () => {
    const [productsJson, meJson]: any[] = await Promise.all([apiGet('/me/products'), apiGet('/me')])
    if (productsJson.ok) setItems(productsJson.data || [])
    if (meJson.ok && meJson.data) {
      const td = meJson.data.templateData && typeof meJson.data.templateData === 'object' ? meJson.data.templateData : {}
      setTemplateData(td)
      const saved = String(td.services_section_title || 'Servicios').trim().slice(0, SERVICE_TITLE_LIMIT)
      setSectionTitle(saved || 'Servicios')
      setSectionDescription(String(td.services_section_description || '').trim().slice(0, SECTION_DESCRIPTION_LIMIT))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const saveSectionContent = async (nextTitle = sectionTitle, nextDescription = sectionDescription) => {
    if (savingSection) return
    const cleanTitle = nextTitle.trim().slice(0, SERVICE_TITLE_LIMIT) || 'Servicios'
    const cleanDescription = nextDescription.trim().slice(0, SECTION_DESCRIPTION_LIMIT)
    setSectionTitle(cleanTitle)
    setSectionDescription(cleanDescription)
    setSavingSection(true)
    setError('')
    const nextTemplate = {
      ...templateData,
      services_section_title: cleanTitle,
      services_section_description: cleanDescription,
    }
    setTemplateData(nextTemplate)
    try {
      const json: any = await apiPut('/me/profile', { template_data: nextTemplate })
      if (!json.ok) setError(json.error || 'No se pudo guardar la presentación de Servicios.')
    } finally {
      setSavingSection(false)
    }
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canAdd) return
    if (!title.trim() || !description.trim()) {
      setError('Completa primero el título y la descripción del servicio.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPost('/me/products', {
        title: title.trim(),
        description: description.trim().slice(0, DESCRIPTION_LIMIT),
        price: '',
        whatsapp_text: '',
        image_url: '',
        is_featured: false,
      })
      if (!json.ok) return setError(json.error || 'No se pudo agregar el servicio.')
      setTitle('')
      setDescription('')
      await load()
    } catch {
      setError('No pudimos guardar el servicio.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: Service) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditDescription((item.description || '').slice(0, DESCRIPTION_LIMIT))
    setError('')
  }

  const saveEdit = async (item: Service) => {
    if (saving || !editTitle.trim()) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPut(`/me/products/${item.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim().slice(0, DESCRIPTION_LIMIT),
      })
      if (!json.ok) return setError(json.error || 'No se pudo actualizar el servicio.')
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const chooseServiceImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (!file || !imageTargetId) return
    setCropFile(file)
    setError('')
  }

  const cancelCrop = () => {
    setCropFile(null)
    setImageTargetId(null)
  }

  const startAdjust = async (item: Service) => {
    if (!item.image_url || saving) return
    setSaving(true)
    setError('')
    try {
      const file = await imageUrlToFile(item.image_url, `service-${item.id}`)
      setImageTargetId(item.id)
      setCropFile(file)
    } catch {
      setError('No pudimos abrir la imagen actual para ajustar su encuadre.')
    } finally {
      setSaving(false)
    }
  }

  const saveCroppedServiceImage = async (blob: Blob) => {
    if (!cropFile || !imageTargetId) return
    const baseName = cropFile.name.replace(/\.[^.]+$/, '') || 'servicio'
    const croppedFile = new File([blob], `${baseName}-crop.jpg`, { type: blob.type || 'image/jpeg', lastModified: Date.now() })

    setSaving(true)
    setError('')
    try {
      const optimized = await optimizeServiceImage(croppedFile)
      const fd = new FormData()
      fd.append('file', optimized, optimized.name)
      const json: any = await apiUpload(`/me/products/${imageTargetId}/image`, fd)
      if (!json.ok) {
        setError(json.error || 'No se pudo cargar la imagen del servicio.')
        return
      }
      await load()
      cancelCrop()
    } catch {
      setError('No pudimos procesar la imagen del servicio.')
    } finally {
      setSaving(false)
    }
  }

  const removeImage = async (item: Service) => {
    if (!window.confirm('¿Quitar la imagen de este servicio?')) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiDelete(`/me/products/${item.id}/image`)
      if (!json.ok) return setError(json.error || 'No se pudo quitar la imagen.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar este servicio?')) return
    await apiDelete(`/me/products/${id}`)
    if (editingId === id) setEditingId(null)
    await load()
  }

  const Counter = ({ value }: { value: string }) => (
    <div className="mt-1 flex items-center justify-between text-[11px]">
      <span className={value.length >= DESCRIPTION_LIMIT ? 'font-bold text-amber-600' : 'text-slate-400'}>{value.length >= DESCRIPTION_LIMIT ? 'Límite de caracteres alcanzado' : 'Máximo 2 líneas'}</span>
      <span className="font-bold text-slate-500">{value.length}/{DESCRIPTION_LIMIT}</span>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Servicios</h1>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm">{items.length}/{MAX_SERVICES}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Agrega hasta 3 servicios. El detalle se amplía al tocar la card en tu perfil.</p>

        <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4">
          <p className="text-xs font-black text-slate-700">Presentación de la sección</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">En el perfil se mostrará “Nuestros servicios”, seguido de este título y una descripción general de hasta 4 líneas.</p>

          <label className="mt-4 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Título principal</label>
          <input
            value={sectionTitle}
            onChange={(event) => setSectionTitle(event.target.value.slice(0, SERVICE_TITLE_LIMIT))}
            onBlur={() => void saveSectionContent()}
            maxLength={SERVICE_TITLE_LIMIT}
            placeholder="Ej. Soluciones industriales"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_TITLE_SUGGESTIONS.map((option) => (
              <button key={option} type="button" onClick={() => { setSectionTitle(option); void saveSectionContent(option, sectionDescription) }} className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500">{option}</button>
            ))}
          </div>

          <label className="mt-4 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Descripción general</label>
          <textarea
            value={sectionDescription}
            onChange={(event) => setSectionDescription(event.target.value.slice(0, SECTION_DESCRIPTION_LIMIT))}
            onBlur={() => void saveSectionContent()}
            maxLength={SECTION_DESCRIPTION_LIMIT}
            rows={4}
            placeholder="Describe de forma general qué tipo de soluciones o servicios ofreces."
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-5 outline-none focus:border-cyan-400"
          />
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Hasta 4 líneas visibles en el perfil</span>
            <span className="font-bold text-slate-500">{sectionDescription.length}/{SECTION_DESCRIPTION_LIMIT}</span>
          </div>
          <button type="button" disabled={savingSection} onClick={() => void saveSectionContent()} className="mt-3 w-full rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">{savingSection ? 'Guardando…' : 'Guardar presentación'}</button>
        </section>

        <section className="mt-5 space-y-3">
          {loading ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-400">Cargando…</div> : items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              {item.image_url ? <div className="aspect-square overflow-hidden bg-slate-100"><img src={item.image_url} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover" /></div> : <div className="flex aspect-square items-center justify-center bg-cyan-50 text-4xl text-cyan-700">◇</div>}
              {editingId === item.id ? (
                <div className="p-4">
                  <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} placeholder="Nombre del servicio" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                  <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value.slice(0, DESCRIPTION_LIMIT))} maxLength={DESCRIPTION_LIMIT} rows={2} placeholder="Descripción breve, máximo 2 líneas" className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                  <Counter value={editDescription} />
                  {item.image_url && <button type="button" disabled={saving} onClick={() => void startAdjust(item)} className="mt-3 w-full rounded-xl bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-700 disabled:opacity-40">Ajustar encuadre de imagen</button>}
                  <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditingId(null)} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600">Cancelar</button><button type="button" disabled={saving || !editTitle.trim()} onClick={() => void saveEdit(item)} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">Guardar</button></div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm font-black">{item.title}</p>
                  {item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.description}</p>}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => startEdit(item)} className="rounded-xl bg-cyan-50 px-2 py-2 text-[11px] font-black text-cyan-700">Editar</button><button type="button" disabled={saving} onClick={() => { setImageTargetId(item.id); imageInputRef.current?.click() }} className="rounded-xl bg-slate-50 px-2 py-2 text-[11px] font-black text-slate-600 disabled:opacity-40">{item.image_url ? 'Reemplazar' : 'Imagen'}</button><button type="button" disabled={saving} onClick={() => void remove(item.id)} className="rounded-xl bg-red-50 px-2 py-2 text-[11px] font-black text-red-600 disabled:opacity-40">Eliminar</button></div>
                  {item.image_url && <button type="button" disabled={saving} onClick={() => void removeImage(item)} className="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 disabled:opacity-40">Quitar imagen</button>}
                </div>
              )}
            </article>
          ))}
        </section>

        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseServiceImage} className="hidden" />

        <form onSubmit={add} className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black">Agregar servicio</h2>
          <input value={title} onChange={(e) => { setTitle(e.target.value); if (error) setError('') }} disabled={!canAdd} maxLength={80} placeholder="Ej. Diseño e impresión" className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" />
          <textarea value={description} onChange={(e) => { setDescription(e.target.value.slice(0, DESCRIPTION_LIMIT)); if (error) setError('') }} disabled={!canAdd} maxLength={DESCRIPTION_LIMIT} rows={2} placeholder="Explica brevemente este servicio" className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" />
          <Counter value={description} />
          {error && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold leading-5 text-amber-800">{error}</p>}
          <button disabled={!canAdd || saving} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : canAdd ? 'Agregar servicio' : 'Límite completado'}</button>
        </form>

        {!canAdd && <FreeLimitUpgradeCard text="Ya utilizas los 3 servicios incluidos. Puedes editar, cambiar imágenes o eliminar cualquiera, o pasar al Plan Básico para ampliar tu perfil." />}
        <div className="mt-5"><FreeUpgradeCard compact /></div>
      </div>

      {cropFile && imageTargetId && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={1}
          outputWidth={1200}
          onSave={(blob) => { void saveCroppedServiceImage(blob) }}
          onCancel={cancelCrop}
        />
      )}
    </main>
  )
}
