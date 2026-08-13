import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost } from '../../../lib/api'

type Service = { id: string; title: string; description?: string | null }
const MAX_SERVICES = 3

export default function FreeServices() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Service[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
      const json: any = await apiPost('/me/products', { title: title.trim(), description: description.trim(), price: '', whatsapp_text: '', image_url: '', is_featured: false })
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

  const remove = async (id: string) => {
    await apiDelete(`/me/products/${id}`)
    await load()
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">
        <button onClick={() => navigate('/admin/free')} className="mb-5 text-sm font-bold text-cyan-700">← Mi panel</button>
        <div className="flex items-end justify-between">
          <div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Servicios</h1></div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm">{items.length}/{MAX_SERVICES}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Cuenta de forma sencilla qué ofreces. Sin precios ni controles avanzados.</p>

        <section className="mt-5 space-y-3">
          {loading ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-400">Cargando…</div> : items.map((item) => (
            <article key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-lg text-cyan-700">◇</div><div className="min-w-0 flex-1"><p className="text-sm font-black">{item.title}</p>{item.description && <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>}</div><button onClick={() => void remove(item.id)} className="self-start rounded-xl bg-red-50 px-2.5 py-2 text-xs font-bold text-red-600">Eliminar</button></div>
            </article>
          ))}
        </section>

        <form onSubmit={add} className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black">Agregar servicio</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canAdd} maxLength={80} placeholder="Ej. Diseño e impresión" className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canAdd} maxLength={220} rows={3} placeholder="Explica brevemente este servicio" className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" />
          {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
          <button disabled={!canAdd || !title.trim() || saving} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : canAdd ? 'Agregar servicio' : 'Límite completado'}</button>
        </form>
      </div>
    </main>
  )
}
