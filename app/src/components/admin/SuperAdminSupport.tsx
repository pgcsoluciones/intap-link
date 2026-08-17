import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type Ticket = {
  id: string
  category: string
  subject: string
  message: string
  status: string
  priority: string
  source_path?: string | null
  admin_note?: string | null
  created_at?: string | null
  updated_at?: string | null
  resolved_at?: string | null
  user_email?: string | null
  profile_slug?: string | null
  profile_name?: string | null
}

function statusLabel(status: string) {
  if (status === 'in_progress') return 'En seguimiento'
  if (status === 'resolved') return 'Resuelto'
  if (status === 'closed') return 'Cerrado'
  return 'Nuevo'
}

export default function SuperAdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('active')

  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) || null, [tickets, selectedId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const query = filter === 'active' ? '' : `?status=${encodeURIComponent(filter)}`
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

  useEffect(() => { void load() }, [filter])

  useEffect(() => {
    setNote(selected?.admin_note || '')
  }, [selectedId, selected?.admin_note])

  async function update(status: string) {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPatch(`/superadmin/support-tickets/${selected.id}`, {
        status,
        admin_note: note,
      })
      if (!json?.ok) throw new Error(json?.error || 'No se pudo actualizar el ticket.')
      setSelectedId('')
      setNote('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el ticket.')
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
            <p style={{ margin: '7px 0 0', color: '#64748b', maxWidth: 650 }}>Dudas enviadas desde el editor Kawvo Link. Los tickets nuevos y en seguimiento aparecen primero.</p>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={{ border: '1px solid #dbe3ee', borderRadius: 12, padding: '10px 12px', background: '#fff', fontWeight: 800 }}>
            <option value="active">Pendientes</option>
            <option value="open">Nuevos</option>
            <option value="in_progress">En seguimiento</option>
            <option value="resolved">Resueltos</option>
            <option value="closed">Cerrados</option>
          </select>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 14, background: '#fff1f2', color: '#be123c', fontWeight: 700 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 28, color: '#64748b' }}>Cargando tickets…</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 28, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>No hay tickets en este estado.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {tickets.map((ticket) => (
              <article key={ticket.id} style={{ background: '#fff', border: selectedId === ticket.id ? '2px solid #06b6d4' : '1px solid #e2e8f0', borderRadius: 18, padding: 18 }}>
                <button type="button" onClick={() => setSelectedId(selectedId === ticket.id ? '' : ticket.id)} style={{ width: '100%', border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{ticket.subject}</div>
                      <div style={{ marginTop: 5, color: '#64748b', fontSize: 13 }}>{ticket.user_email || 'Usuario'} {ticket.profile_slug ? `· @${ticket.profile_slug}` : ''}</div>
                    </div>
                    <span style={{ borderRadius: 999, background: ticket.status === 'open' ? '#ecfeff' : '#f1f5f9', padding: '6px 10px', fontSize: 11, fontWeight: 900, color: '#0f6175' }}>{statusLabel(ticket.status)}</span>
                  </div>
                  <p style={{ margin: '12px 0 0', color: '#334155', lineHeight: 1.55 }}>{ticket.message}</p>
                  <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12 }}>{ticket.source_path || 'Editor'} · {ticket.created_at || ''}</div>
                </button>

                {selectedId === ticket.id && (
                  <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 900, color: '#334155' }}>
                      Nota o respuesta de soporte
                      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 12, padding: 12, resize: 'vertical', font: 'inherit' }} />
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <button type="button" disabled={saving} onClick={() => void update('in_progress')} style={{ border: 0, borderRadius: 11, padding: '10px 14px', background: '#e0f2fe', color: '#075985', fontWeight: 900, cursor: 'pointer' }}>En seguimiento</button>
                      <button type="button" disabled={saving} onClick={() => void update('resolved')} style={{ border: 0, borderRadius: 11, padding: '10px 14px', background: '#dcfce7', color: '#166534', fontWeight: 900, cursor: 'pointer' }}>Resolver</button>
                      <button type="button" disabled={saving} onClick={() => void update('closed')} style={{ border: 0, borderRadius: 11, padding: '10px 14px', background: '#f1f5f9', color: '#475569', fontWeight: 900, cursor: 'pointer' }}>Cerrar</button>
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
