import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../../lib/api'

type Ticket = {
  id: string
  subject: string
  status: string
  admin_note?: string | null
  created_at?: string | null
}

const categories = [
  ['editor', 'No sé cómo editar algo'],
  ['publicacion', 'Tengo dudas para publicar'],
  ['producto', 'Tengo dudas con mi producto Kawvo'],
  ['cuenta', 'Necesito ayuda con mi cuenta'],
  ['otro', 'Otra duda'],
] as const

function statusLabel(status: string) {
  if (status === 'in_progress') return 'En seguimiento'
  if (status === 'resolved') return 'Resuelto'
  if (status === 'closed') return 'Cerrado'
  return 'Recibido'
}

export default function FreeSupportPanel() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('editor')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])

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
      setFeedback(`Listo. Tu solicitud ${result.data?.reference || ''} fue enviada a soporte.`)
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
          <p className="mt-1 text-xs leading-5 text-slate-600">Antes de hacer un cambio importante o eliminar tu perfil, cuéntanos tu duda. Nuestro equipo podrá darle seguimiento desde Super Admin.</p>
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
              <div key={ticket.id} className="rounded-xl bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-800">{ticket.subject}</strong>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{statusLabel(ticket.status)}</span>
                </div>
                {ticket.admin_note && <p className="mt-2 leading-5 text-slate-600">Respuesta: {ticket.admin_note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
