import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost } from '../../../lib/api'
import { FreeBackButton, basicPlanWhatsAppUrl } from './FreePanelUi'
import FreeNotificationBell from './FreeNotificationBell'
import FreeProfileDangerZone from './FreeProfileDangerZone'
import FreeSupportPanel from './FreeSupportPanel'

type MeData = {
  email?: string | null
  name?: string | null
  slug?: string | null
  plan_id?: string | null
  plan_code?: string | null
}

type ResourceItem = {
  id: string
  title: string
  description?: string | null
  url: string
  category?: string | null
}

type SessionItem = {
  id: string
  label: string
  created_at?: string | null
  expires_at?: string | null
  is_current?: boolean
}

type AiUsage = {
  remaining_today?: number
  remaining_month?: number
  daily_limit?: number
  monthly_limit?: number
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')
}

function planLabel(me: MeData | null) {
  const plan = String(me?.plan_code || me?.plan_id || 'free').toLowerCase()
  if (plan === 'basic') return 'Plan Básico'
  if (plan === 'pro') return 'Plan Pro'
  return 'Plan Gratis'
}

export default function FreeAccount() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [bankActive, setBankActive] = useState(false)
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [sessionBusy, setSessionBusy] = useState('')
  const [shareFeedback, setShareFeedback] = useState('')
  const [qrBusy, setQrBusy] = useState(false)

  const webUrl = useMemo(() => (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, ''), [])
  const publicUrl = me?.slug ? `${webUrl}/${me.slug}` : ''

  const loadSessions = async () => {
    try {
      const json: any = await apiGet('/me/account/sessions')
      if (json?.ok) setSessions(Array.isArray(json.data?.items) ? json.data.items : [])
    } catch { /* account remains usable */ }
  }

  useEffect(() => {
    Promise.all([
      apiGet('/me').catch(() => ({ ok: false })),
      apiGet('/me/bank-accounts').catch(() => ({ ok: false })),
      apiGet('/me/ai-profile-assistant/context').catch(() => ({ ok: false })),
      apiGet('/me/account/resources').catch(() => ({ ok: false })),
      apiGet('/me/account/sessions').catch(() => ({ ok: false })),
      apiGet('/me/notifications?limit=1').catch(() => ({ ok: false })),
    ]).then(([meJson, bankJson, aiJson, resourcesJson, sessionsJson, notificationsJson]: any[]) => {
      if (meJson?.ok) setMe(meJson.data || null)
      if (bankJson?.ok) {
        setBankActive(Boolean(bankJson.data?.access?.allowed && bankJson.data?.enabled !== false))
      }
      if (aiJson?.ok) setAiUsage(aiJson.data?.usage || null)
      if (resourcesJson?.ok) setResources(Array.isArray(resourcesJson.data?.items) ? resourcesJson.data.items : [])
      if (sessionsJson?.ok) setSessions(Array.isArray(sessionsJson.data?.items) ? sessionsJson.data.items : [])
      if (notificationsJson?.ok) setUnreadCount(Number(notificationsJson.data?.unread_count || 0))
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const ticketId = new URLSearchParams(window.location.search).get('ticket')
    if (!ticketId) return
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('kawvo:open-support-ticket', { detail: { ticketId } }))
      document.getElementById('kawvo-support-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [])

  const openNotifications = () => {
    window.dispatchEvent(new Event('kawvo:open-notifications'))
    setUnreadCount(0)
  }

  const downloadQr = async () => {
    if (!publicUrl || qrBusy) return
    setQrBusy(true)
    setShareFeedback('')
    try {
      const QRCode = await import('qrcode')
      const dataUrl = await QRCode.toDataURL(publicUrl, {
        width: 1400,
        margin: 3,
        errorCorrectionLevel: 'H',
        color: { dark: '#111111', light: '#FFFFFF' },
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `kawvo-${me?.slug || 'perfil'}-qr.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setShareFeedback('QR descargado.')
    } catch {
      setShareFeedback('No pudimos generar el QR en este momento.')
    } finally {
      setQrBusy(false)
    }
  }

  const inviteFriend = async () => {
    const url = 'https://nfc.kawvoia.com'
    const text = 'Conoce Kawvo Link y crea una presentación digital para compartir tus datos y servicios.'
    setShareFeedback('')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Kawvo Link', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setShareFeedback('Invitación copiada para compartir.')
    } catch (error: any) {
      if (error?.name !== 'AbortError') setShareFeedback('No pudimos abrir el menú para compartir.')
    }
  }

  const revokeSession = async (session: SessionItem) => {
    if (session.is_current || sessionBusy) return
    setSessionBusy(session.id)
    try {
      const json: any = await apiDelete(`/me/account/sessions/${session.id}`)
      if (json?.ok) await loadSessions()
    } finally {
      setSessionBusy('')
    }
  }

  const handleLogout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    window.location.replace('/admin/login')
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">KAWVO LINK</p>
            <h1 className="mt-0.5 text-xl font-black tracking-[-0.03em]">Mi cuenta</h1>
          </div>
          <div className="flex items-center gap-2">
            <FreeNotificationBell />
            <button type="button" onClick={() => void handleLogout()} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">Salir</button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[430px] space-y-4 px-5 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />

        <article className="rounded-[26px] bg-slate-950 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300">Tu plan actual</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">{planLabel(me)}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-300">{me?.email || 'Tu cuenta Kawvo'}</p>
            </div>
            <a href={basicPlanWhatsAppUrl()} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-950">Mejorar plan</a>
          </div>
        </article>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={openNotifications} className="rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm">
            <span className="text-xl">🔔</span>
            <span className="mt-3 block text-sm font-black">Notificaciones</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{unreadCount > 0 ? `${unreadCount} sin leer` : 'Ver mensajes'}</span>
          </button>
          <button type="button" onClick={() => navigate('/admin/artifacts')} className="rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm">
            <span className="text-xl">⌁</span>
            <span className="mt-3 block text-sm font-black">Mis productos</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">NFC y QR vinculados</span>
          </button>
        </div>

        <article className="rounded-[22px] border border-violet-100 bg-violet-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Asistente IA</p>
              <h2 className="mt-1 text-base font-black text-slate-950">Cuotas disponibles</h2>
            </div>
            <button type="button" onClick={() => navigate('/admin/free/ai-profile')} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-violet-700 shadow-sm">Abrir IA</button>
          </div>
          {aiUsage ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Hoy</p><p className="mt-1 text-xl font-black text-slate-950">{aiUsage.remaining_today ?? '—'}</p><p className="text-[10px] text-slate-400">solicitudes disponibles</p></div>
              <div className="rounded-2xl bg-white p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Este mes</p><p className="mt-1 text-xl font-black text-slate-950">{aiUsage.remaining_month ?? '—'}</p><p className="text-[10px] text-slate-400">solicitudes disponibles</p></div>
            </div>
          ) : <p className="mt-3 text-xs leading-5 text-slate-500">La información de uso aparecerá aquí cuando esté disponible.</p>}
        </article>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={!publicUrl || qrBusy} onClick={() => void downloadQr()} className="rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm disabled:opacity-40">
            <span className="text-xl">▦</span>
            <span className="mt-3 block text-sm font-black">Descargar QR</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">QR de tu perfil</span>
          </button>
          <button type="button" onClick={() => void inviteFriend()} className="rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm">
            <span className="text-xl">↗</span>
            <span className="mt-3 block text-sm font-black">Invitar a un amigo</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">Compartir Kawvo Link</span>
          </button>
        </div>
        {shareFeedback && <p className="rounded-xl bg-white px-3 py-2 text-center text-xs font-semibold text-slate-500">{shareFeedback}</p>}

        {bankActive && (
          <button type="button" onClick={() => navigate('/admin/free/bank-accounts')} className="flex w-full items-center gap-3 rounded-[22px] border border-emerald-100 bg-emerald-50 p-4 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl">▤</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">Cuentas bancarias</span><span className="mt-1 block text-xs leading-5 text-slate-500">Administrar tus datos bancarios</span></span>
            <span className="font-black text-emerald-700">›</span>
          </button>
        )}

        <article className="rounded-[22px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-700">Seguridad</p>
          <h2 className="mt-1 text-base font-black">Dispositivos vinculados</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Revisa dónde tienes sesiones activas y cierra las que ya no uses.</p>
          <div className="mt-4 space-y-2">
            {sessions.length === 0 ? <p className="text-xs text-slate-400">No encontramos otras sesiones activas.</p> : sessions.map((session) => (
              <div key={session.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">{session.label}{session.is_current ? ' · Este dispositivo' : ''}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-400">Iniciada: {formatDate(session.created_at)}</p>
                  </div>
                  {!session.is_current && <button type="button" disabled={sessionBusy === session.id} onClick={() => void revokeSession(session)} className="shrink-0 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-rose-600 shadow-sm disabled:opacity-40">{sessionBusy === session.id ? 'Cerrando…' : 'Cerrar'}</button>}
                </div>
              </div>
            ))}
          </div>
        </article>

        {resources.length > 0 && (
          <article className="rounded-[22px] border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-700">Recursos</p>
            <h2 className="mt-1 text-base font-black">Recursos de Kawvo</h2>
            <div className="mt-3 space-y-2">
              {resources.map((resource) => (
                <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="block rounded-2xl bg-slate-50 p-3 transition hover:bg-slate-100">
                  <p className="text-sm font-black text-slate-800">{resource.title}</p>
                  {resource.description && <p className="mt-1 text-xs leading-5 text-slate-500">{resource.description}</p>}
                </a>
              ))}
            </div>
          </article>
        )}

        <FreeSupportPanel />

        {me?.slug && <FreeProfileDangerZone slug={me.slug} email={me.email || ''} />}
      </section>
    </main>
  )
}
