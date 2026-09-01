#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 1) Centro de notificaciones: las respuestas de soporte se leen dentro del mismo detalle.
p = ROOT / 'app/src/components/admin/free/FreeNotifications.tsx'
s = p.read_text()

if "type SupportTicketDetail" not in s:
    s = s.replace("type NotificationItem = {\n", "type SupportTicketDetail = {\n  id: string\n  subject?: string | null\n  message?: string | null\n  status?: string | null\n  admin_note?: string | null\n  response_channel?: string | null\n  events?: Array<{ id: string; status_key?: string | null; message?: string | null; created_at?: string | null }>\n}\n\ntype NotificationItem = {\n", 1)

s = s.replace("  const [filter, setFilter] = useState<'all' | 'unread'>('all')\n", "  const [filter, setFilter] = useState<'all' | 'unread'>('all')\n  const [ticketDetail, setTicketDetail] = useState<SupportTicketDetail | null>(null)\n  const [ticketLoading, setTicketLoading] = useState(false)\n", 1)

s = s.replace("  const openItem = async (item: NotificationItem) => {\n    setSelected(item)\n", "  const openItem = async (item: NotificationItem) => {\n    setTicketDetail(null)\n    setSelected(item)\n", 1)

old_act = """  const act = () => {
    if (!selected) return
    if (selected.source_type === 'support_ticket' && selected.source_id) {
      navigate(`/admin/free/account?ticket=${encodeURIComponent(selected.source_id)}`)
      return
    }
    if (!selected.action_url) return
    if (/^https?:\\/\\//i.test(selected.action_url)) window.open(selected.action_url, '_blank', 'noopener,noreferrer')
    else window.location.href = selected.action_url
  }
"""
new_act = """  const act = async () => {
    if (!selected) return
    if (selected.source_type === 'support_ticket' && selected.source_id) {
      setTicketLoading(true)
      try {
        const json: any = await apiGet(`/me/support-tickets/${selected.source_id}`)
        if (json?.ok) setTicketDetail(json.data || null)
      } finally {
        setTicketLoading(false)
      }
      return
    }
    if (!selected.action_url) return
    if (/^https?:\\/\\//i.test(selected.action_url)) window.open(selected.action_url, '_blank', 'noopener,noreferrer')
    else window.location.href = selected.action_url
  }
"""
if old_act in s:
    s = s.replace(old_act, new_act, 1)

s = s.replace("onClick={act}", "onClick={() => void act()}")

anchor = """              {(selected.action_url || (selected.source_type === 'support_ticket' && selected.source_id)) && <button type=\"button\" onClick={() => void act()} className=\"mt-5 w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white\">{selected.action_label || (selected.source_type === 'support_ticket' ? 'Abrir ticket' : 'Ver más')}</button>}
"""
if anchor in s and "Respuesta de soporte" not in s:
    extra = anchor + """              {ticketLoading && <p className=\"mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500\">Cargando respuesta…</p>}
              {ticketDetail && (
                <section className=\"mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50\">
                  <div className=\"border-b border-slate-200 px-4 py-3\">
                    <p className=\"text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700\">Respuesta de soporte</p>
                    <p className=\"mt-1 text-sm font-black text-slate-900\">{ticketDetail.subject || 'Tu solicitud'}</p>
                  </div>
                  <div className=\"p-4\">
                    {ticketDetail.admin_note ? (
                      <p className=\"whitespace-pre-wrap text-sm leading-6 text-slate-700\">{ticketDetail.admin_note}</p>
                    ) : (
                      <p className=\"text-sm leading-6 text-slate-500\">Abre el seguimiento para ver las últimas novedades de tu solicitud.</p>
                    )}
                    {(ticketDetail.events || []).filter((event) => event.message).slice(-3).map((event) => (
                      <div key={event.id} className=\"mt-3 border-t border-slate-200 pt-3\">
                        <p className=\"whitespace-pre-wrap text-xs leading-5 text-slate-600\">{event.message}</p>
                        {event.created_at && <p className=\"mt-1 text-[10px] font-semibold text-slate-400\">{formatDate(event.created_at)}</p>}
                      </div>
                    ))}
                    <button type=\"button\" onClick={() => navigate(`/admin/free/account?ticket=${encodeURIComponent(ticketDetail.id)}`)} className=\"mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700\">Ir al Centro de ayuda y tickets</button>
                  </div>
                </section>
              )}
"""
    s = s.replace(anchor, extra, 1)

p.write_text(s)
print('✓ Notificaciones: respuesta de ticket inline sin salir del detalle')

# 2) Invitación: URL dinámica con primer nombre del usuario.
p = ROOT / 'app/src/components/admin/free/FreeAccount.tsx'
s = p.read_text()

old = """  const sendInvite = async () => {
    const url = `${webUrl}/invitacion`
    const text = 'Me he creado un perfil en Kawvo Link para presentar lo que hago y compartir mis datos en un solo lugar. Crea tú también tu presentación digital; te lo recomiendo.'
"""
new = """  const inviteSenderName = String(me?.name || '').trim().split(/\\s+/)[0] || 'un amigo'
  const invitationUrl = `https://nfc.kawvoia.com/invitacion?de=${encodeURIComponent(inviteSenderName)}`

  const sendInvite = async () => {
    const url = invitationUrl
    const text = 'Me he creado un perfil en Kawvo Link para presentar lo que hago y compartir mis datos en un solo lugar. Crea tú también tu presentación digital; te lo recomiendo.'
"""
if old in s:
    s = s.replace(old, new, 1)
else:
    # fallback sobre la versión anterior si el literal todavía usa URL fija
    s = s.replace("  const sendInvite = async () => {\n    const url = 'https://nfc.kawvoia.com/invitacion'\n", new.split("  const sendInvite",1)[0] + "  const sendInvite = async () => {\n    const url = invitationUrl\n", 1)

s = s.replace("https://nfc.kawvoia.com/invitacion</span>", "{invitationUrl}</span>")
s = s.replace("https://nfc.kawvoia.com/invitacion<br/>", "{invitationUrl}<br/>")
s = s.replace("https://nfc.kawvoia.com/invitacion", "{invitationUrl}", 1) if "<span className=\"mt-2 block font-semibold text-cyan-700\">https://nfc.kawvoia.com/invitacion" in s else s

# V5 suele renderizar el preview como literal dentro de un span. Sustitución robusta específica.
s = s.replace('<span className="mt-2 block font-semibold text-cyan-700">https://nfc.kawvoia.com/invitacion</span>', '<span className="mt-2 block break-all font-semibold text-cyan-700">{invitationUrl}</span>')

p.write_text(s)
print('✓ Invitación: /invitacion?de=Nombre según usuario que comparte')

print('✓ Account Center V5.3 aplicado')
