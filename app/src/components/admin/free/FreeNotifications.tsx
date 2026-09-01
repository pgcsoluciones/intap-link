import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPatch } from '../../../lib/api'

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  image_url?: string | null
  source_type?: string | null
  source_id?: string | null
  action_label?: string | null
  action_url?: string | null
  read_at?: string | null
  created_at?: string | null
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')
}

export default function FreeNotifications() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [selected, setSelected] = useState<NotificationItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = async () => {
    setLoading(true)
    try {
      const json: any = await apiGet('/me/notifications?limit=50')
      if (json?.ok) setItems(Array.isArray(json.data?.items) ? json.data.items : [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [])

  const visible = useMemo(() => filter === 'unread' ? items.filter((item) => !item.read_at) : items, [items, filter])
  const unread = items.filter((item) => !item.read_at).length

  const openItem = async (item: NotificationItem) => {
    setSelected(item)
    if (!item.read_at) {
      const readAt = new Date().toISOString()
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry))
      setSelected({ ...item, read_at: readAt })
      try { await apiPatch(`/me/notifications/${item.id}/read`, {}) } catch { /* optimistic */ }
    }
  }

  const markSelectedRead = async () => {
    if (!selected || selected.read_at) return
    const readAt = new Date().toISOString()
    setSelected({ ...selected, read_at: readAt })
    setItems((current) => current.map((entry) => entry.id === selected.id ? { ...entry, read_at: readAt } : entry))
    try { await apiPatch(`/me/notifications/${selected.id}/read`, {}) } catch { /* optimistic */ }
  }

  const markAllRead = async () => {
    const readAt = new Date().toISOString()
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })))
    try { await apiPatch('/me/notifications/read-all', {}) } catch { /* optimistic */ }
  }

  const removeSelected = async () => {
    if (!selected || deleting) return
    setDeleting(true)
    try {
      const json: any = await apiDelete(`/me/notifications/${selected.id}`)
      if (json?.ok) {
        setItems((current) => current.filter((item) => item.id !== selected.id))
        setSelected(null)
      }
    } finally { setDeleting(false) }
  }

  const act = () => {
    if (!selected) return
    if (selected.source_type === 'support_ticket' && selected.source_id) {
      navigate(`/admin/free/account?ticket=${encodeURIComponent(selected.source_id)}`)
      return
    }
    if (!selected.action_url) return
    if (/^https?:\/\//i.test(selected.action_url)) window.open(selected.action_url, '_blank', 'noopener,noreferrer')
    else window.location.href = selected.action_url
  }

  return (
    <main className="min-h-screen bg-white pb-24 font-['Inter'] text-slate-900">
      <section className="mx-auto w-full max-w-[560px] px-5 pt-6">
        <div className="flex items-center gap-3 pb-5">
          <button type="button" onClick={() => navigate('/admin/free/account')} aria-label="Regresar a Mi cuenta" className="text-[34px] font-light leading-none text-slate-500">←</button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Mi cuenta</p>
            <h1 className="text-[30px] font-black tracking-[-0.04em] text-slate-950">Notificaciones</h1>
          </div>
          {unread > 0 && <span className="rounded-full bg-cyan-600 px-3 py-1.5 text-xs font-black text-white">{unread} nuevas</span>}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#f5f5f5] p-2">
          <div className="flex gap-1">
            <button type="button" onClick={() => setFilter('all')} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === 'all' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Todas</button>
            <button type="button" onClick={() => setFilter('unread')} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === 'unread' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Sin leer</button>
          </div>
          {unread > 0 && <button type="button" onClick={() => void markAllRead()} className="px-2 text-xs font-black text-cyan-700">Marcar todas leídas</button>}
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] bg-[#f5f5f5]">
          {loading && items.length === 0 ? <p className="p-5 text-sm text-slate-500">Cargando notificaciones…</p> : visible.length === 0 ? (
            <div className="p-7 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500">🔔</div><p className="mt-3 text-base font-bold text-slate-800">No hay notificaciones aquí</p><p className="mt-1 text-sm text-slate-500">Cuando Kawvo tenga algo importante para ti, aparecerá en este centro.</p></div>
          ) : visible.map((item) => (
            <button key={item.id} type="button" onClick={() => void openItem(item)} className="flex w-full gap-3 border-b border-slate-200 p-4 text-left last:border-b-0">
              <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-slate-300' : 'bg-cyan-500'}`} />
              {item.image_url && <img src={item.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />}
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold text-slate-900">{item.title}</span><span className="mt-1 line-clamp-2 block text-[13px] leading-5 text-slate-500">{item.message}</span><span className="mt-2 block text-[11px] font-semibold text-slate-400">{formatDate(item.created_at)}</span></span>
              <span className="self-center text-[28px] font-light text-slate-400">›</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Detalle de notificación" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <article className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            {selected.image_url && <img src={selected.image_url} alt="" className="max-h-[320px] w-full rounded-t-[28px] object-cover" />}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Kawvo</p><h2 className="mt-1 text-xl font-black text-slate-950">{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
              <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{selected.message}</p>
              {selected.created_at && <p className="mt-3 text-[11px] font-semibold text-slate-400">{formatDate(selected.created_at)}</p>}
              {(selected.action_url || (selected.source_type === 'support_ticket' && selected.source_id)) && <button type="button" onClick={act} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white">{selected.action_label || (selected.source_type === 'support_ticket' ? 'Abrir ticket' : 'Ver más')}</button>}
              {!selected.read_at && <button type="button" onClick={() => void markSelectedRead()} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">Marcar como leída</button>}
              <button type="button" disabled={deleting} onClick={() => void removeSelected()} className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 disabled:opacity-40">{deleting ? 'Eliminando…' : 'Eliminar notificación'}</button>
            </div>
          </article>
        </div>
      )}
    </main>
  )
}
