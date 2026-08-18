import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../../../lib/api'

type EventItem = {
  id: string
  status_key: string
  message?: string | null
  channel?: string | null
  actor_type?: string | null
  created_at?: string | null
}

type Ticket = {
  id: string
  category?: string
  subject: string
  message?: string | null
  status: string
  admin_note?: string | null
  response_channel?: string | null
  created_at?: string | null
  updated_at?: string | null
  resolved_at?: string | null
  events?: EventItem[]
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

function eventLabel(event: EventItem) {
  if (event.status_key === 'submitted') return 'Enviada'
  if (event.status_key === 'received') return 'Recibida'
  if (event.status_key === 'in_progress') return 'En proceso'
  if (event.status_key === 'responded') return 'Respuesta de soporte'
  if (event.status_key === 'user_reply') return 'Tu respuesta'
  if (event.status_key === 'closed') return 'Cerrada'
  return 'Actualización'
}

function channelLabel(channel?: string | null) {
  if (channel === 'email') return 'Correo'
  if (channel === 'whatsapp') return 'WhatsApp'
  return 'Sistema'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')
}

export default function FreeSupportPanel() {
  const panelRef = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('editor')
  const [message, setMessage] = useState('')
  const [messageResetKey, setMessageResetKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [reply, setReply] = useState('')
  const [replyFeedback, setReplyFeedback] = useState('')

  const loadTickets = async () => {
    try {
      const json: any = await apiGet('/me/support-tickets')
      if (json?.ok) setTickets(Array.isArray(json.data?.items) ? json.data.items : [])
    } catch { /* keep existing list */ }
  }

  const openTicketById = async (ticketId: string) => {
    setReply('')
    setReplyFeedback('')
    try {
      const json: any = await apiGet(`/me/support-tickets/${ticketId}`)
      if (json?.ok) {
        setSelectedTicket(json.data)
        setOpen(true)
      }
    } catch { /* notification stays available */ }
  }

  useEffect(() => {
    void loadTickets()
    const timer = window.setInterval(() => void loadTickets(), 30000)
    const onFocus = () => void loadTickets()
    const onOpenTicket = (event: Event) => {
      const ticketId = String((event as CustomEvent)?.detail?.ticketId || '')
      if (ticketId) void openTicketById(ticketId)
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('kawvo:open-support-ticket', onOpenTicket as EventListener)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('kawvo:open-support-ticket', onOpenTicket as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selectedTicket) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, selectedTicket])

  async function submit() {
    if (sending) return
    const cleanMessage = message.trim()
    if (cleanMessage.length < 8) {
      setFeedback('Escribe un poco más sobre tu duda antes de enviarla.')
      return
    }
    setSending(true)
    setFeedback('')
    try {
      const result: any = await apiPost('/me/support-tickets', {
        category,
        message: cleanMessage,
        source_path: window.location.pathname,
      })
      if (!result?.ok) {
        setFeedback(result?.error || 'No pudimos enviar tu solicitud.')
        return
      }
      setMessage('')
      setMessageResetKey((current) => current + 1)
      setFeedback(`Enviada. Tu solicitud ${result.data?.reference || ''} quedó en la cola de soporte. Nuestro equipo la atenderá lo antes posible.`)
      await loadTickets()
    } catch {
      setFeedback('No pudimos enviar tu solicitud. Intenta nuevamente.')
    } finally {
      setSending(false)
    }
  }

  async function sendReply() {
    if (!selectedTicket || sending) return
    if (reply.trim().length < 2) {
      setReplyFeedback('Escribe tu respuesta antes de enviarla.')
      return
    }
    setSending(true)
    setReplyFeedback('')
    try {
      const json: any = await apiPost(`/me/support-tickets/${selectedTicket.id}/reply`, { message: reply.trim() })
      if (!json?.ok) {
        setReplyFeedback(json?.error || 'No pudimos enviar tu respuesta.')
        return
      }
      setSelectedTicket(json.data)
      setReply('')
      setReplyFeedback('Respuesta enviada. El ticket volvió a la cola de seguimiento del equipo de soporte.')
      await loadTickets()
    } catch {
      setReplyFeedback('No pudimos enviar tu respuesta. Intenta nuevamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section ref={panelRef} id="kawvo-support-panel" className="overflow-hidden rounded-[22px] border border-cyan-100 bg-cyan-50/55 transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="kawvo-support-content"
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lg">?</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">¿Necesitas ayuda?</span>
          <span className="mt-1 block text-base font-black text-slate-950">Soporte Kawvo</span>
          <span className="mt-1 block text-xs leading-5 text-slate-600">Envía una duda y revisa el seguimiento de tus solicitudes.</span>
        </span>
        <span aria-hidden="true" className={`shrink-0 text-xl font-black text-cyan-700 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div id="kawvo-support-content" className="border-t border-cyan-100 px-4 pb-4 pt-4">
          <p className="mb-4 rounded-xl bg-white/75 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-500">Antes de hacer un cambio importante o eliminar tu perfil, cuéntanos tu duda. Nuestro equipo de soporte podrá darle seguimiento.</p>

          <div className="space-y-3">
            <label className="block text-xs font-black text-slate-700">
              ¿Con qué necesitas ayuda?
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100">
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label className="block text-xs font-black text-slate-700">
              Cuéntanos tu duda
              <textarea key={messageResetKey} value={message} onChange={(event) => setMessage(event.target.value.slice(0, 1200))} maxLength={1200} rows={4} placeholder="Ejemplo: no sé qué debo cambiar antes de publicar mi perfil…" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
            </label>

            <p className="rounded-xl bg-white/80 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-500">Al enviarla, tu solicitud entra en una cola de atención. El equipo de soporte la revisará por orden y te responderá lo antes posible.</p>

            <button type="button" onClick={() => void submit()} disabled={sending} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35">
              {sending ? 'Enviando…' : 'Enviar a soporte'}
            </button>
            {feedback && <p className={`rounded-xl px-3 py-2 text-xs font-semibold leading-5 ${feedback.startsWith('Escribe') || feedback.startsWith('No pudimos') ? 'bg-rose-50 text-rose-700' : 'bg-white text-slate-600'}`}>{feedback}</p>}
          </div>

          {tickets.length > 0 && (
            <div className="mt-4 border-t border-cyan-100 pt-4">
              <p className="text-xs font-black text-slate-700">Tus solicitudes recientes</p>
              <div className="mt-2 space-y-2">
                {tickets.slice(0, 3).map((ticket) => (
                  <button key={ticket.id} type="button" onClick={() => void openTicketById(ticket.id)} className="block w-full rounded-xl bg-white p-3 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-sm">
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

            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tu mensaje inicial</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTicket.message || 'Sin mensaje disponible.'}</p>
            </div>

            {(selectedTicket.events || []).length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Seguimiento</p>
                <div className="mt-3 space-y-3">
                  {(selectedTicket.events || []).map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${event.status_key === 'responded' ? 'bg-emerald-500' : event.status_key === 'user_reply' ? 'bg-violet-500' : event.status_key === 'in_progress' ? 'bg-cyan-500' : 'bg-slate-300'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-800">{eventLabel(event)}{event.channel ? ` · ${channelLabel(event.channel)}` : ''}</p>
                        {event.message && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{event.message}</p>}
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">{formatDate(event.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
              <p className="mt-3 rounded-2xl bg-cyan-50 px-4 py-3 text-xs font-semibold leading-5 text-cyan-900">Tu solicitud está en la cola de atención. Nuestro equipo la está gestionando y te responderá lo antes posible.</p>
            )}

            {selectedTicket.admin_note && (
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Última respuesta del equipo · {channelLabel(selectedTicket.response_channel)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-950">{selectedTicket.admin_note}</p>
              </div>
            )}

            {selectedTicket.status !== 'closed' && (
              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                <p className="text-xs font-black text-violet-950">¿Necesitas responder o agregar información?</p>
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={1200} rows={3} placeholder="Escribe aquí tu respuesta…" className="mt-2 w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-4 focus:ring-violet-100" />
                <button type="button" onClick={() => void sendReply()} disabled={sending} className="mt-2 w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{sending ? 'Enviando…' : 'Responder a soporte'}</button>
                {replyFeedback && <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold ${replyFeedback.startsWith('Escribe') || replyFeedback.startsWith('No pudimos') ? 'bg-rose-50 text-rose-700' : 'bg-white text-violet-800'}`}>{replyFeedback}</p>}
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