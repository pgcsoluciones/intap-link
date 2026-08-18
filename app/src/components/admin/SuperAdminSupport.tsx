import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

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
  category: string
  subject: string
  message: string
  status: string
  priority: string
  source_path?: string | null
  admin_note?: string | null
  response_channel?: string | null
  responded_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  resolved_at?: string | null
  user_email?: string | null
  profile_email?: string | null
  user_phone?: string | null
  profile_slug?: string | null
  profile_name?: string | null
  events?: EventItem[]
}

function statusLabel(status: string) {
  if (status === 'in_progress') return 'En proceso'
  if (status === 'resolved') return 'Respondido'
  if (status === 'closed') return 'Cerrado'
  return 'Recibido'
}

function eventLabel(event: EventItem) {
  if (event.status_key === 'submitted') return 'Enviada'
  if (event.status_key === 'received') return 'Recibida'
  if (event.status_key === 'in_progress') return 'En proceso'
  if (event.status_key === 'responded') return 'Respuesta de soporte'
  if (event.status_key === 'user_reply') return 'Respuesta del usuario'
  if (event.status_key === 'closed') return 'Cerrado'
  return 'Actualización'
}

function channelLabel(channel?: string | null) {
  if (channel === 'email') return 'Correo'
  if (channel === 'whatsapp') return 'WhatsApp'
  return 'Sistema'
}

export default function SuperAdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedDetail, setSelectedDetail] = useState<Ticket | null>(null)
  const [note, setNote] = useState('')
  const [replyChannel, setReplyChannel] = useState<'system' | 'email' | 'whatsapp'>('system')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('active')
  const [feedback, setFeedback] = useState('')

  const selected = useMemo(() => selectedDetail || tickets.find((ticket) => ticket.id === selectedId) || null, [tickets, selectedId, selectedDetail])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const query = filter === 'active' || filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`
      const json: any = await apiGet(`/superadmin/support-tickets${query}`)
      if (!json?.ok) throw new Error(json?.error || 'No se pudieron cargar los tickets.')
      const items = Array.isArray(json.data?.items) ? json.data.items : []
      setTickets(filter === 'active' ? items.filter((item: Ticket) => ['open', 'in_progress'].includes(item.status)) : items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los tickets.')
    } finally {
      setLoading(false)
    }
  }

  async function openTicket(ticket: Ticket) {
    if (selectedId === ticket.id) {
      setSelectedId('')
      setSelectedDetail(null)
      setNote('')
      return
    }
    setSelectedId(ticket.id)
    setSelectedDetail(ticket)
    setNote('')
    setReplyChannel((ticket.response_channel as any) || 'system')
    setFeedback('')
    setError('')
    try {
      const json: any = await apiGet(`/superadmin/support-tickets/${ticket.id}`)
      if (json?.ok) {
        setSelectedDetail(json.data)
        setNote('')
        setReplyChannel((json.data?.response_channel as any) || 'system')
      }
    } catch { /* summary remains usable */ }
  }

  useEffect(() => { void load() }, [filter])

  async function update(status: string) {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const json: any = await apiPatch(`/superadmin/support-tickets/${selected.id}`, { status })
      if (!json?.ok) throw new Error(json?.error || 'No se pudo actualizar el ticket.')
      setFeedback(`Estado actualizado: ${statusLabel(status)}.`)
      await load()
      const detail: any = await apiGet(`/superadmin/support-tickets/${selected.id}`)
      if (detail?.ok) setSelectedDetail(detail.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el ticket.')
    } finally {
      setSaving(false)
    }
  }

  async function respond() {
    if (!selected || saving) return
    setError('')
    setFeedback('')
    if (note.trim().length < 2) {
      setError('Escribe la respuesta antes de enviarla.')
      return
    }
    if (replyChannel === 'email' && !(selected.user_email || selected.profile_email)) {
      setError('No hay un correo disponible para este usuario. Selecciona Sistema o WhatsApp.')
      return
    }
    if (replyChannel === 'whatsapp' && !selected.user_phone) {
      setError('No hay un número de WhatsApp o teléfono disponible para este usuario. Selecciona Sistema o Correo.')
      return
    }

    setSaving(true)
    try {
      const json: any = await apiPost(`/superadmin/support-tickets/${selected.id}/respond`, {
        channel: replyChannel,
        message: note.trim(),
      })
      if (!json?.ok) throw new Error(json?.error || 'No se pudo registrar la respuesta.')
      if (replyChannel === 'whatsapp' && json.data?.whatsapp_url) {
        window.open(json.data.whatsapp_url, '_blank', 'noopener,noreferrer')
        setFeedback('Respuesta registrada. Se abrió WhatsApp con el mensaje preparado para enviarlo al usuario y también se creó una notificación en su panel.')
      } else if (replyChannel === 'email') {
        setFeedback('Respuesta enviada por correo, guardada en el ticket y notificada dentro del panel del usuario.')
      } else {
        setFeedback('Respuesta publicada y enviada a la bandeja de notificaciones del usuario.')
      }
      setNote('')
      await load()
      const detail: any = await apiGet(`/superadmin/support-tickets/${selected.id}`)
      if (detail?.ok) setSelectedDetail(detail.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo responder el ticket.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuperAdminLayout currentSection="support">
      <section style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: '#0891b2' }}>Soporte</div>
            <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 900 }}>Tickets de usuarios</h1>
            <p style={{ margin: '7px 0 0', color: '#64748b', maxWidth: 680 }}>Gestiona cada solicitud desde que llega hasta que recibe respuesta. Puedes contestar dentro del sistema, por correo o preparar la respuesta por WhatsApp.</p>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={{ border: '1px solid #dbe3ee', borderRadius: 12, padding: '10px 12px', background: '#fff', fontWeight: 800 }}>
            <option value="active">Pendientes</option>
            <option value="all">Todos</option>
            <option value="open">Recibidos</option>
            <option value="in_progress">En proceso</option>
            <option value="resolved">Respondidos</option>
            <option value="closed">Cerrados</option>
          </select>
        </div>

        {error && <div role="alert" style={{ padding: 14, borderRadius: 14, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 28, color: '#64748b' }}>Cargando tickets…</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 28, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>No hay tickets en este estado.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {tickets.map((ticket) => (
              <article key={ticket.id} style={{ background: '#fff', border: selectedId === ticket.id ? '2px solid #06b6d4' : '1px solid #e2e8f0', borderRadius: 18, padding: 18 }}>
                <button type="button" onClick={() => void openTicket(ticket)} style={{ width: '100%', border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{ticket.subject}</div>
                      <div style={{ marginTop: 5, color: '#64748b', fontSize: 13 }}>{ticket.user_email || ticket.profile_email || 'Usuario'} {ticket.profile_slug ? `· @${ticket.profile_slug}` : ''}</div>
                      {ticket.user_phone && <div style={{ marginTop: 4, color: '#475569', fontSize: 13, fontWeight: 700 }}>Teléfono / WhatsApp: {ticket.user_phone}</div>}
                    </div>
                    <span style={{ borderRadius: 999, background: ticket.status === 'open' ? '#ecfeff' : '#f1f5f9', padding: '6px 10px', fontSize: 11, fontWeight: 900, color: '#0f6175' }}>{statusLabel(ticket.status)}</span>
                  </div>
                  <p style={{ margin: '12px 0 0', color: '#334155', lineHeight: 1.55 }}>{ticket.message}</p>
                  <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12 }}>{ticket.source_path || 'Editor'} · {ticket.created_at || ''}</div>
                </button>

                {selectedId === ticket.id && selected && (
                  <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'grid', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 9 }}>Proceso del ticket</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {(selected.events || []).map((event) => (
                          <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 10, alignItems: 'start' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 999, background: event.status_key === 'responded' ? '#10b981' : event.status_key === 'user_reply' ? '#8b5cf6' : event.status_key === 'in_progress' ? '#0ea5e9' : '#94a3b8', marginTop: 5 }} />
                            <div><strong style={{ fontSize: 12 }}>{eventLabel(event)}</strong>{event.channel && <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b' }}>· {channelLabel(event.channel)}</span>}<div style={{ marginTop: 2, fontSize: 12, color: '#64748b' }}>{event.message || ''}</div><div style={{ marginTop: 2, fontSize: 10, color: '#94a3b8' }}>{event.created_at || ''}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 900, color: '#334155' }}>
                      Respuesta de soporte <span style={{ color: '#e11d48' }}>*</span>
                      <textarea value={note} onChange={(event) => { setNote(event.target.value); if (error) setError('') }} rows={5} placeholder="Escribe aquí una nueva respuesta para el usuario…" autoComplete="off" style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', border: error && note.trim().length < 2 ? '2px solid #fb7185' : '1px solid #cbd5e1', borderRadius: 12, padding: 12, resize: 'vertical', font: 'inherit' }} />
                    </label>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>Canal de respuesta <span style={{ color: '#e11d48' }}>*</span></label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(['system', 'email', 'whatsapp'] as const).map((channel) => (
                          <button key={channel} type="button" onClick={() => { setReplyChannel(channel); if (error) setError('') }} style={{ border: replyChannel === channel ? '2px solid #0891b2' : '1px solid #cbd5e1', borderRadius: 12, padding: '9px 12px', background: replyChannel === channel ? '#ecfeff' : '#fff', color: '#334155', fontWeight: 900, cursor: 'pointer' }}>{channelLabel(channel)}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, lineHeight: 1.5, color: '#64748b' }}>{replyChannel === 'system' ? 'El usuario recibirá una notificación en su panel y podrá abrir el ticket desde su bandeja de entrada.' : replyChannel === 'email' ? `Se enviará al correo ${selected.user_email || selected.profile_email || 'registrado'} y también se notificará dentro del panel.` : `Se abrirá WhatsApp con el mensaje preparado para ${selected.user_phone || 'el número registrado'}. También se creará una notificación en el panel.`}</div>
                    </div>

                    {feedback && <div style={{ borderRadius: 12, background: '#ecfdf5', padding: 11, color: '#166534', fontSize: 12, fontWeight: 800 }}>{feedback}</div>}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" disabled={saving} onClick={() => void update('in_progress')} style={{ border: 0, borderRadius: 11, padding: '10px 14px', background: '#e0f2fe', color: '#075985', fontWeight: 900, cursor: 'pointer' }}>Marcar en proceso</button>
                      <button type="button" disabled={saving} onClick={() => void respond()} style={{ border: 0, borderRadius: 11, padding: '10px 14px', background: '#0f172a', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>{saving ? 'Procesando…' : replyChannel === 'whatsapp' ? 'Responder por WhatsApp' : replyChannel === 'email' ? 'Enviar por correo' : 'Responder en el sistema'}</button>
                      <button type="button" disabled={saving} onClick={() => void update('closed')} style={{ border: 0, borderRadius: 11, padding: '10px 14px', background: '#f1f5f9', color: '#475569', fontWeight: 900, cursor: 'pointer' }}>Cerrar ticket</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </SuperAdminLayout>
  )
}
