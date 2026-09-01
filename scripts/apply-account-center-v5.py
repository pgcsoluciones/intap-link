#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, required: bool = False):
    p = ROOT / path
    text = p.read_text()
    if old in text:
        text = text.replace(old, new)
        p.write_text(text)
        print(f'✓ {path}')
        return True
    if required:
        raise SystemExit(f'No encontré patrón requerido en {path}: {old[:80]}')
    return False

# 1) Centro robusto de notificaciones: pantalla propia, apta para texto, imágenes/promos y acciones.
notifications = r'''import { useEffect, useMemo, useState } from 'react'
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
'''
(ROOT / 'app/src/components/admin/free/FreeNotifications.tsx').write_text(notifications)
print('✓ FreeNotifications.tsx')

# 2) Bell: contador + acceso directo al centro, sin bandeja modal duplicada.
bell = r'''import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'

type Props = { hideTrigger?: boolean }

export default function FreeNotificationBell({ hideTrigger = false }: Props) {
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  const load = async () => {
    try {
      const json: any = await apiGet('/me/notifications?limit=1')
      if (json?.ok) setUnread(Number(json.data?.unread_count || 0))
    } catch { /* badge opcional */ }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    const onFocus = () => void load()
    const onOpen = () => navigate('/admin/free/notifications?from=account')
    window.addEventListener('focus', onFocus)
    window.addEventListener('kawvo:open-notifications', onOpen)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('kawvo:open-notifications', onOpen) }
  }, [navigate])

  if (hideTrigger) return null
  return (
    <button type="button" onClick={() => navigate('/admin/free/notifications')} aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}
'''
(ROOT / 'app/src/components/admin/free/FreeNotificationBell.tsx').write_text(bell)
print('✓ FreeNotificationBell.tsx')

# 3) App route.
app_path = ROOT / 'app/src/App.tsx'
app = app_path.read_text()
if "./components/admin/free/FreeNotifications" not in app:
    # insert close to FreeAccount import, irrespective of quote style
    m = re.search(r"(import FreeAccount from ['\"]\.\/components\/admin\/free\/FreeAccount['\"]\n)", app)
    if not m: raise SystemExit('No encontré import FreeAccount en App.tsx')
    app = app[:m.end()] + "import FreeNotifications from './components/admin/free/FreeNotifications'\n" + app[m.end():]
if 'path="/admin/free/notifications"' not in app:
    anchor = '<Route path="/admin/free/account" element={<AdminGuard planScope="free"><FreeAccount /></AdminGuard>} />'
    if anchor not in app: raise SystemExit('No encontré ruta Mi cuenta en App.tsx')
    app = app.replace(anchor, anchor + '\n        <Route path="/admin/free/notifications" element={<AdminGuard planScope="free"><FreeNotifications /></AdminGuard>} />')
app_path.write_text(app)
print('✓ App.tsx: ruta Notificaciones')

# 4) Mi cuenta: continuidad, invitación y un solo Centro de ayuda.
account_path = ROOT / 'app/src/components/admin/free/FreeAccount.tsx'
account = account_path.read_text()
account = account.replace("  const openNotifications = () => {\n    window.dispatchEvent(new Event('kawvo:open-notifications'))\n    setUnreadCount(0)\n  }", "  const openNotifications = () => navigate('/admin/free/notifications?from=account')")
account = account.replace("const url = 'https://nfc.kawvoia.com'", "const url = `${webUrl}/invitacion`")
account = account.replace("const text = 'Conoce Kawvo Link y crea una presentación digital para compartir tus datos y servicios.'", "const text = 'Me he creado un perfil en Kawvo Link para presentar lo que hago y compartir mis datos en un solo lugar. Crea tú también tu presentación digital; te lo recomiendo.'")
account = account.replace('Conoce Kawvo Link y crea una presentación digital para compartir tus datos y servicios.<br/><span className="mt-2 block font-semibold text-cyan-700">https://nfc.kawvoia.com</span>', 'Me he creado un perfil en Kawvo Link para presentar lo que hago y compartir mis datos en un solo lugar. Crea tú también tu presentación digital; te lo recomiendo.<br/><span className="mt-2 block font-semibold text-cyan-700">{webUrl}/invitacion</span>')
account = account.replace("navigate('/admin/artifacts')", "navigate('/admin/artifacts?from=account')")
# Remove any duplicated help settings row; the real support component remains.
account = re.sub(r'^\s*<SettingsRow[^\n]*label="Centro de ayuda(?: y tickets)?"[^\n]*\/>\n?', '', account, flags=re.M)
# Hidden bell is no longer needed inside account.
account = account.replace("      <FreeNotificationBell hideTrigger />\n", '')
account_path.write_text(account)
print('✓ FreeAccount.tsx: continuidad + invitación + ayuda única')

# 5) Centro de ayuda: conservar todas sus funciones, pero con fachada gris de Mi cuenta.
support_path = ROOT / 'app/src/components/admin/free/FreeSupportPanel.tsx'
support = support_path.read_text()
support = support.replace('className="overflow-hidden rounded-[22px] border border-cyan-100 bg-cyan-50/55 transition-all duration-200"', 'className="overflow-hidden rounded-[22px] bg-[#f5f5f5] transition-all duration-200"')
support = support.replace('className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lg"', 'className="flex h-11 w-11 shrink-0 items-center justify-center text-[24px] text-slate-500"')
support = support.replace('text-cyan-700">Centro de ayuda</span>', 'text-slate-400">KAWVO</span>')
support = support.replace('>Ayuda y tickets</span>', '>Centro de ayuda y tickets</span>')
support = support.replace('border-t border-cyan-100 px-4 pb-4 pt-4', 'border-t border-slate-200 px-4 pb-4 pt-4')
support = support.replace('border-t border-cyan-100 pt-4', 'border-t border-slate-200 pt-4')
support_path.write_text(support)
print('✓ FreeSupportPanel.tsx: misma función, diseño Mi cuenta')

# 6) Productos: si se abrió desde Mi cuenta, el regreso vuelve a Mi cuenta.
artifact_path = ROOT / 'app/src/components/admin/ArtifactActivation.tsx'
artifact = artifact_path.read_text()
artifact = artifact.replace('export function ArtifactManager() {\n', "export function ArtifactManager() {\n  const navigate = useNavigate()\n  const fromAccount = new URLSearchParams(window.location.search).get('from') === 'account'\n")
# Insert a visible back action at the start of ArtifactManager's main, only once.
needle = 'return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-[\'Inter\'] text-slate-950">'
pos = artifact.find(needle, artifact.find('export function ArtifactManager()'))
if pos >= 0 and 'Regresar a Mi cuenta' not in artifact[pos:pos+1200]:
    replacement = needle + '<section className="mx-auto mb-4 w-full max-w-[760px]">{fromAccount && <button type="button" onClick={() => navigate(\'/admin/free/account\')} className="text-sm font-black text-slate-600">← Regresar a Mi cuenta</button>}</section>'
    artifact = artifact[:pos] + artifact[pos:].replace(needle, replacement, 1)
artifact_path.write_text(artifact)
print('✓ ArtifactManager: regreso a Mi cuenta')

# 7) Notificaciones con imagen opcional en API. Migración aditiva y compatible.
for rel in ['api/migrations/0043_user_notification_media.sql', 'api/migrations-preview/0043_user_notification_media.sql']:
    (ROOT / rel).write_text("ALTER TABLE user_notifications ADD COLUMN image_url TEXT;\n")
    print(f'✓ {rel}')

api_path = ROOT / 'api/src/preview-support-tickets.ts'
api = api_path.read_text()
api = api.replace('SELECT id, type, title, message, source_type, source_id, action_label, action_url, read_at, created_at', 'SELECT id, type, title, message, image_url, source_type, source_id, action_label, action_url, read_at, created_at')
api_path.write_text(api)
print('✓ API notifications: image_url')

# 8) Presentación social de compartir bancos + landing /invitacion con Graph Card.
mw_path = ROOT / 'functions/_middleware.ts'
mw = mw_path.read_text()
invite_anchor = "  // Card específica de la demo interactiva.\n"
if "url.pathname === '/invitacion'" not in mw:
    invitation = """  // Card social para invitaciones compartidas desde Mi cuenta.\n  if (url.pathname === '/invitacion' || url.pathname === '/invitacion/') {\n    return injectSimpleSocialCard({\n      title: 'Te recomiendo Kawvo Link | Crea tu presentación digital',\n      description: 'Crea tu presentación digital para mostrar quién eres, qué haces y cómo contactarte, todo en un solo lugar.',\n      image: `${url.origin}/assets/og/kawvo-link-og.png`,\n      canonicalUrl: `${url.origin}/invitacion`,\n    });\n  }\n\n"""
    mw = mw.replace(invite_anchor, invitation + invite_anchor)
# Dynamic bank-share card before static/dynamic profile handling.
bank_anchor = "  const staticProfile = getStaticProfileDiscovery(slug, discoveryRuntime);\n"
if 'share=bancos: social card bancaria' not in mw:
    bank = """  // share=bancos: social card bancaria aprobada para WhatsApp y redes.\n  if (url.searchParams.get('share') === 'bancos' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug)) {\n    const bankMeta = await getDynamicProfileSeoBundle(slug, discoveryRuntime);\n    if (bankMeta) {\n      const response = await context.next();\n      const contentType = response.headers.get('content-type') || '';\n      if (contentType.includes('text/html')) {\n        const html = await response.text();\n        const cleanName = bankMeta.title.split('|')[0].trim();\n        const pageUrl = `${url.origin}/${encodeURIComponent(slug)}?share=bancos`;\n        const updatedHtml = injectHeadMetadata(html, {\n          title: `Datos bancarios de ${cleanName} | Kawvo Link`,\n          description: 'Consulta los datos bancarios compartidos desde su presentación digital Kawvo Link.',\n          url: pageUrl,\n          image: bankMeta.image,\n          imageType: bankMeta.imageType,\n          siteName: 'Kawvo Link',\n          ogType: 'website',\n          twitterCard: 'summary_large_image',\n          language: discoveryRuntime.language === 'en' ? 'en-US' : 'es-DO',\n        });\n        const headers = new Headers(response.headers);\n        headers.set('content-type', 'text/html; charset=UTF-8');\n        headers.set('x-robots-tag', 'noindex, nofollow, noarchive');\n        return withSecurityHeaders(new Response(updatedHtml, { status: response.status, statusText: response.statusText, headers }));\n      }\n      return withSecurityHeaders(response);\n    }\n  }\n\n"""
    mw = mw.replace(bank_anchor, bank + bank_anchor)
mw_path.write_text(mw)
print('✓ middleware: Graph Card bancos + /invitacion')

print('\n✓ Account Center v5 aplicado')
