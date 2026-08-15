import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'
import { FreeBackButton, FreeUpgradeCard } from './FreePanelUi'

type Service = {
  id: string
  title: string
  description?: string | null
  image_url?: string | null
}

const MAX_SERVICES = 3

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
      canvas.toBlob((result) => {
        if (!result) return reject(new Error('No se pudo optimizar la imagen.'))
        resolve(result)
      }, 'image/webp', quality)
    })

    const baseName = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'servicio'

    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
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

  const canAdd = useMemo(() => items.length < MAX_SERVICES, [items.length])

  const load = async () => {
    const json: any = await apiGet('/me/products')
    if (json.ok) setItems(json.data || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canAdd || !title.trim()) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPost('/me/products', {
        title: title.trim(),
        description: description.trim(),
        price: '',
        whatsapp_text: '',
        image_url: '',
        is_featured: false,
      })
      if (!json.ok) {
        setError(json.error || 'No se pudo agregar el servicio.')
        return
      }
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
    setEditDescription(item.description || '')
    setError('')
  }

  const saveEdit = async (item: Service) => {
    if (saving || !editTitle.trim()) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPut(`/me/products/${item.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      })
      if (!json.ok) {
        setError(json.error || 'No se pudo actualizar el servicio.')
        return
      }
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const chooseImage = (item: Service) => {
    setImageTargetId(item.id)
    setError('')
    imageInputRef.current?.click()
  }

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (!file || !imageTargetId) return

    setSaving(true)
    setError('')
    try {
      const optimized = await optimizeServiceImage(file)
      const fd = new FormData()
      fd.append('file', optimized, optimized.name)
      const json: any = await apiUpload(`/me/products/${imageTargetId}/image`, fd)
      if (!json.ok) {
        setError(json.error || 'No se pudo cargar la imagen del servicio.')
        return
      }
      await load()
    } catch {
      setError('No pudimos procesar la imagen del servicio.')
    } finally {
      setImageTargetId(null)
      setSaving(false)
    }
  }

  const removeImage = async (item: Service) => {
    if (!window.confirm('¿Quitar la imagen de este servicio?')) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiDelete(`/me/products/${item.id}/image`)
      if (!json.ok) {
        setError(json.error || 'No se pudo quitar la imagen.')
        return
      }
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
        <p className="mt-2 text-sm leading-6 text-slate-500">Agrega hasta 3 servicios. Cada uno puede tener imagen, título y una descripción breve; el CTA de WhatsApp se genera automáticamente en tu perfil.</p>

        <section className="mt-5 space-y-3">
          {loading ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-400">Cargando…</div> : items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              {item.image_url ? (
                <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                  <img src={item.image_url} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-cyan-50 text-4xl text-cyan-700">◇</div>
              )}

              {editingId === item.id ? (
                <div className="p-4">
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    maxLength={80}
                    placeholder="Nombre del servicio"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    maxLength={220}
                    rows={3}
                    placeholder="Descripción breve"
                    className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600">Cancelar</button>
                    <button type="button" disabled={saving || !editTitle.trim()} onClick={() => void saveEdit(item)} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">Guardar</button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm font-black">{item.title}</p>
                  {item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.description}</p>}

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={() => startEdit(item)} className="rounded-xl bg-cyan-50 px-2 py-2 text-[11px] font-black text-cyan-700">Editar</button>
                    <button type="button" disabled={saving} onClick={() => chooseImage(item)} className="rounded-xl bg-slate-50 px-2 py-2 text-[11px] font-black text-slate-600 disabled:opacity-40">{item.image_url ? 'Reemplazar' : 'Imagen'}</button>
                    <button type="button" disabled={saving} onClick={() => void remove(item.id)} className="rounded-xl bg-red-50 px-2 py-2 text-[11px] font-black text-red-600 disabled:opacity-40">Eliminar</button>
                  </div>

                  {item.image_url && (
                    <button type="button" disabled={saving} onClick={() => void removeImage(item)} className="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 disabled:opacity-40">Quitar imagen</button>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>

        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden" />

        <form onSubmit={add} className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black">Agregar servicio</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canAdd} maxLength={80} placeholder="Ej. Diseño e impresión" className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canAdd} maxLength={220} rows={3} placeholder="Explica brevemente este servicio" className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" />
          {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
          <button disabled={!canAdd || !title.trim() || saving} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : canAdd ? 'Agregar servicio' : 'Límite completado'}</button>
        </form>

        <p className="mt-3 text-center text-xs leading-5 text-slate-400">El límite solo impide agregar un cuarto servicio; editar, cambiar imagen o eliminar siempre permanece disponible.</p>

        <div className="mt-5">
          <FreeUpgradeCard compact />
        </div>
      </div>
    </main>
  )
}