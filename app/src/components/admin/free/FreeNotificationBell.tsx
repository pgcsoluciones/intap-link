import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPatch } from '../../../lib/api'

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
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

export default function FreeNotificationBell() {
  const bellRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [selected, setSelected] = useState<NotificationItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const json: any = await apiGet('/me/notifications?limit=30')
      if (json?.ok) {
        setItems(Array.isArray(json.data?.items) ? json.data.items : [])
        setUnread(Number(json.data?.unread_count || 0))
      }
    } catch { /* bell stays usable */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    const onFocus = () => void load()
    const onOpenNotifications = () => {
      setSelected(null)
      setOpen(true)
      void load()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('kawvo:open-notifications', onOpenNotifications)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('kawvo:open-notifications', onOpenNotifications)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && bellRef.current && !bellRef.current.contains(target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const openItem = async (item: NotificationItem) => {
    const nextItem = item.read_at ? item : { ...item, read_at: new Date().toISOString() }
    setSelected(nextItem)
    setOpen(false)
    if (!item.read_at) {
      setItems((current) => current.map((entry) => entry.id === item.id ? nextItem : entry))
      setUnread((value) => Math.max(0, value - 1))
      try { await apiPatch(`/me/notifications/${item.id}/read`, {}) } catch { /* optimistic read */ }
    }
  }

  const markAllRead = async () => {
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
    setUnread(0)
    try { await apiPatch('/me/notifications/read-all', {}) } catch { /* optimistic read */ }
  }

  const deleteSelected = async () => {
    if (!selected || deleting) return
    setDeleting(true)
    try {
      const json: any = await apiDelete(`/me/notifications/${selected.id}`)
      if (json?.ok) {
        setSelected(null)
        await load()
      }
    } finally {
      setDeleting(false)
    }
  }

  const act = () => {
    if (!selected) return
    if (selected.source_type === 'support_ticket' && selected.source_id) {
      window.dispatchEvent(new CustomEvent('kawvo:open-support-ticket', { detail: { ticketId: selected.source_id } }))
      setSelected(null)
      setOpen(false)
      window.setTimeout(() => document.getElementById('kawvo-support-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
      return
    }
    if (selected.action_url) {
      if (/^https?:\/\//i.test(selected.action_url)) window.open(selected.action_url, '_blank', 'noopener,noreferrer')
      else window.location.href = selected.action_url
    }
  }

  return (
    <div ref={bellRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); if (!open) void load() }}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg shadow-sm transition hover:bg-slate-50"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[76px] z-[90] mx-auto max-h-[72vh] w-auto max-w-[430px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Bandeja de entrada</p>
              <h2 className="mt-1 text-base font-black text-slate-950">Notificaciones</h2>
            </div>
            <button type="button" onClick={() => void markAllRead()} className="text-[11px] font-black text-cyan-700">Marcar todo leído</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading && items.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm leading-6 text-slate-500">No tienes notificaciones todavía.</p>
            ) : items.map((item) => (
              <button key={item.id} type="button" onClick={() => void openItem(item)} className={`mb-1 block w-full rounded-2xl p-3 text-left transition hover:bg-slate-50 ${item.read_at ? 'bg-white' : 'bg-cyan-50/70'}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-slate-200' : 'bg-cyan-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900">{item.title}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{item.message}</span>
                    <span className="mt-1 block text-[10px] font-semibold text-slate-400">{formatDate(item.created_at)}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <article className="w-full max-w-[430px] rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Notificación Kawvo</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{selected.title}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">Cerrar</button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.message}</p>
            {selected.created_at && <p className="mt-3 text-[11px] font-semibold text-slate-400">{formatDate(selected.created_at)}</p>}
            {(selected.source_type === 'support_ticket' || selected.action_url) && (
              <button type="button" onClick={act} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
                {selected.action_label || (selected.source_type === 'support_ticket' ? 'Abrir solicitud' : 'Ver más')}
              </button>
            )}
            <button type="button" disabled={deleting} onClick={() => void deleteSelected()} className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 disabled:opacity-40">
              {deleting ? 'Eliminando…' : 'Eliminar notificación'}
            </button>
          </article>
        </div>
      )}
    </div>
  )
}
