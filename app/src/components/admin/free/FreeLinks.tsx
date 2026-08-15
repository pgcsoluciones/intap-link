import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost, apiPut } from '../../../lib/api'
import { FreeBackButton, FreeLimitUpgradeCard, FreeUpgradeCard } from './FreePanelUi'

type LinkItem = {
  id: string
  label: string
  url: string
  is_active?: number
}

const MAX_LINKS = 3

function normalizeUrl(value: string) {
  const clean = value.trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) return clean
  return `https://${clean}`
}

export default function FreeLinks() {
  const navigate = useNavigate()
  const [items, setItems] = useState<LinkItem[]>([])
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editUrl, setEditUrl] = useState('')

  const canAdd = useMemo(() => items.length < MAX_LINKS, [items.length])

  const load = async () => {
    const json: any = await apiGet('/me/links')
    if (json.ok) setItems(json.data || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canAdd || saving) return
    const normalized = normalizeUrl(url)
    if (!label.trim() || !normalized) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPost('/me/links', { label: label.trim(), url: normalized })
      if (!json.ok) return setError(json.error || 'No se pudo agregar el enlace.')
      setLabel('')
      setUrl('')
      await load()
    } catch {
      setError('No pudimos guardar el enlace.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (item: LinkItem) => {
    await apiPut(`/me/links/${item.id}`, { is_active: item.is_active === 0 })
    await load()
  }

  const startEdit = (item: LinkItem) => {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditUrl(item.url)
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditLabel('')
    setEditUrl('')
  }

  const saveEdit = async (item: LinkItem) => {
    if (saving) return
    const normalized = normalizeUrl(editUrl)
    if (!editLabel.trim() || !normalized) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPut(`/me/links/${item.id}`, { label: editLabel.trim(), url: normalized })
      if (!json.ok) return setError(json.error || 'No se pudo actualizar el enlace.')
      cancelEdit()
      await load()
    } catch {
      setError('No pudimos actualizar el enlace.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    await apiDelete(`/me/links/${id}`)
    if (editingId === id) cancelEdit()
    await load()
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Mis enlaces</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Agrega hasta 3 accesos importantes. Al completar el límite todavía puedes editar, ocultar o eliminar.</p>

        <section className="mt-5 space-y-3">
          {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-400">Cargando…</div> : items.map((item) => (
            <article key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.04)]">
              {editingId === item.id ? (
                <div>
                  <div className="space-y-3">
                    <input value={editLabel} onChange={(event) => setEditLabel(event.target.value)} maxLength={80} placeholder="Nombre del enlace" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                    <input value={editUrl} onChange={(event) => setEditUrl(event.target.value)} placeholder="www.ejemplo.com" inputMode="url" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={cancelEdit} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600">Cancelar</button>
                    <button type="button" disabled={saving || !editLabel.trim() || !editUrl.trim()} onClick={() => void saveEdit(item)} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">↗</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.label}</p><p className="mt-1 truncate text-xs text-slate-400">{item.url.replace(/^https?:\/\//, '')}</p></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.is_active === 0 ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{item.is_active === 0 ? 'Oculto' : 'Visible'}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3"><button onClick={() => startEdit(item)} className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700">Editar</button><button onClick={() => void toggle(item)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{item.is_active === 0 ? 'Mostrar' : 'Ocultar'}</button><button onClick={() => void remove(item.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">Eliminar</button></div>
                </>
              )}
            </article>
          ))}
        </section>

        <form onSubmit={add} className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="text-sm font-black">Agregar enlace</h2><span className="text-xs font-bold text-slate-400">{items.length}/{MAX_LINKS}</span></div>
          <div className="mt-4 space-y-3"><input value={label} onChange={(e) => setLabel(e.target.value)} disabled={!canAdd} placeholder="Ej. Mi catálogo" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" /><input value={url} onChange={(e) => setUrl(e.target.value)} disabled={!canAdd} placeholder="www.ejemplo.com" inputMode="url" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" /></div>
          {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
          <button disabled={!canAdd || !label.trim() || !url.trim() || saving} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : canAdd ? 'Agregar enlace' : 'Límite completado'}</button>
        </form>

        {!canAdd && <FreeLimitUpgradeCard text="Ya utilizas los 3 enlaces disponibles. Puedes administrarlos libremente o pasar al Plan Básico para ampliar tu alcance." />}
        <div className="mt-5"><FreeUpgradeCard compact /></div>
      </div>
    </main>
  )
}
