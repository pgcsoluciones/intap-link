import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../../lib/api'

type Ticket = {
  id: string
  category?: string
  subject: string
  message?: string | null
  status: string
  admin_note?: string | null
  created_at?: string | null
  updated_at?: string | null
  resolved_at?: string | null
}

const categories = [
  ['editor', 'No sé cómo editar algo'],
  ['publicacion', 'Tengo dudas para publicar'],
  ['producto', 'Tengo dudas con mi producto Kawvo'],
  ['cuenta', 'Necesito ayuda con mi cuenta'],
  ['otro', 'Otra duda'],
] as const

function statusLabel(status: string) {
  if (status === 'in_progress') return 'En proceso'
  if (status === 'resolved') return 'Respondido'
  if (status === 'closed') return 'Cerrado'
  return 'Recibida'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')
}

export default function FreeSupportPanel() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('editor')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const loadTickets = () => {
    apiGet('/me/support-tickets')
      .then((json: any) => {
        if (json?.ok) setTickets(Array.isArray(json.data?.items) ? json.data.items : [])
      })
      .catch(() => undefined)
  }

  useEffect(() => { loadTickets() }, [])

  async function submit() {
    if (sending || message.trim().length < 8) return
    setSending(true)
    setFeedback('')
    try {
      const result: any = await apiPost('/me/support-tickets', {
        category,
        message: message.trim(),
        source_path: window.location.pathname,
      })
      if (!result?.ok) {
        setFeedback(result?.error || 'No pudimos enviar tu solicitud.')
        return
      }
      setMessage('')
      setFeedback(`Enviada. Tu solicitud ${result.data?.reference || ''} quedó en la cola de soporte. Nuestro equipo la atenderá lo antes posible.`)
      loadTickets()
    } catch {
      setFeedback('No pudimos enviar tu solicitud. Intenta nuevamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-[22px] border border-cyan-100 bg-cyan-50/55 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lg">?</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">¿Necesitas ayuda?</p>
          <h2 className="mt-1 text-base font-black text-slate-950">Soporte Kawvo</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">Antes de hacer un cambio importante o eliminar tu perfil, cuéntanos tu duda. Nuestro equipo de soporte podrá darle seguimiento.</p>
        </div>
      </div>

      <button type="button" onClick={() => setOpen((current) => !current)} className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-xs font-black text-cyan-800 shadow-sm">
        {open ? 'Cerrar formulario' : 'Pedir ayuda'}
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-cyan-100 pt-4">
          <label className="block text-xs font-black text-slate-700">
            ¿Con qué necesitas ayuda?
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100">
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="block text-xs font-black text-slate-700">
            Cuéntanos tu duda
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} rows={4} placeholder="Ejemplo: no sé qué debo cambiar antes de publicar mi perfil…" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
          </label>

          <p className="rounded-xl bg-white/80 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-500">Al enviarla, tu solicitud entra en una cola de atención. El equipo de soporte la revisará por orden y te responderá lo antes posible.</p>

          <button type="button" onClick={() => void submit()} disabled={sending || message.trim().length < 8} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35">
            {sending ? 'Enviando…' : 'Enviar a soporte'}
          </button>
          {feedback && <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600">{feedback}</p>}
        </div>
      )}

      {tickets.length > 0 && (
        <div className="mt-4 border-t border-cyan-100 pt-4">
          <p className="text-xs font-black text-slate-700">Tus solicitudes recientes</p>
          <div className="mt-2 space-y-2">
            {tickets.slice(0, 3).map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => setSelectedTicket(ticket)} className="block w-full rounded-xl bg-white p-3 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-800">{ticket.subject}</strong>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{statusLabel(ticket.status)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-400">
                  <span>{formatDate(ticket.created_at)}</span>
                  <span className="text-cyan-700">Ver solicitud →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="support-ticket-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTicket(null) }}>
          <article className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Solicitud de soporte</p>
                <h3 id="support-ticket-title" className="mt-1 text-lg font-black text-slate-950">{selectedTicket.subject}</h3>
              </div>
              <button type="button" onClick={() => setSelectedTicket(null)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">Cerrar</button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-500">Estado</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-cyan-700 shadow-sm">{statusLabel(selectedTicket.status)}</span>
            </div>

            {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
              <p className="mt-3 rounded-2xl bg-cyan-50 px-4 py-3 text-xs font-semibold leading-5 text-cyan-900">Tu solicitud está en la cola de atención. Nuestro equipo la está gestionando y te responderá lo antes posible.</p>
            )}

            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tu mensaje</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTicket.message || 'Sin mensaje disponible.'}</p>
            </div>

            {selectedTicket.admin_note && (
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Respuesta del equipo de soporte</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-950">{selectedTicket.admin_note}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
              <div className="rounded-xl bg-slate-50 p-3"><strong className="block text-slate-700">Enviada</strong><span className="mt-1 block">{formatDate(selectedTicket.created_at)}</span></div>
              <div className="rounded-xl bg-slate-50 p-3"><strong className="block text-slate-700">Última actualización</strong><span className="mt-1 block">{formatDate(selectedTicket.updated_at)}</span></div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
