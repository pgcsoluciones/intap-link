import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost, apiUpload } from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'
import { basicPlanWhatsAppUrl } from './FreePanelUi'
import FreeNotificationBell from './FreeNotificationBell'
import FreeProfileDangerZone from './FreeProfileDangerZone'
import FreeSupportPanel from './FreeSupportPanel'

type MeData = {
  email?: string | null
  name?: string | null
  slug?: string | null
  avatar_url?: string | null
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

type RowProps = {
  icon: ReactNode
  label: string
  detail?: string
  badge?: string
  onClick?: () => void
  href?: string
  danger?: boolean
}

function planLabel(me: MeData | null) {
  const plan = String(me?.plan_code || me?.plan_id || 'free').toLowerCase()
  if (plan === 'basic') return 'BÁSICO'
  if (plan === 'pro') return 'PRO'
  return 'FREE'
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-400">{children}</p>
}

function SettingsRow({ icon, label, detail, badge, onClick, href, danger = false }: RowProps) {
  const content = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center text-[24px] ${danger ? 'text-rose-500' : 'text-slate-500'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[17px] font-medium leading-6 ${danger ? 'text-rose-600' : 'text-slate-800'}`}>{label}</span>
        {detail && <span className="mt-0.5 block text-[12px] leading-5 text-slate-400">{detail}</span>}
      </span>
      {badge && <span className="mr-1 rounded-lg bg-slate-500 px-2.5 py-1 text-[12px] font-bold text-white">{badge}</span>}
      <span className="text-[28px] font-light leading-none text-slate-400">›</span>
    </>
  )

  const className = 'flex min-h-[70px] w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left last:border-b-0'
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>
  return <button type="button" onClick={onClick} className={className}>{content}</button>
}

export default function FreeAccount() {
  const navigate = useNavigate()
  const avatarInputRef = useRef<HTMLInputElement>(null)
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [showAi, setShowAi] = useState(false)
  const [showDevices, setShowDevices] = useState(false)

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
      if (bankJson?.ok) setBankActive(Boolean(bankJson.data?.access?.allowed && bankJson.data?.enabled !== false))
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

  const chooseAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (avatarInputRef.current) avatarInputRef.current.value = ''
    if (!file || avatarUploading) return
    setAvatarError('')
    setAvatarFile(file)
  }

  const uploadAvatar = async (blob: Blob) => {
    if (avatarUploading) return
    setAvatarFile(null)
    setAvatarUploading(true)
    setAvatarError('')
    try {
      const form = new FormData()
      form.append('file', blob, 'avatar.jpg')
      const result: any = await apiUpload('/me/profile/avatar', form)
      if (!result?.ok || !result?.avatar_url) {
        setAvatarError(result?.error || 'No pudimos cambiar tu foto.')
        return
      }
      setMe((current) => current ? { ...current, avatar_url: result.avatar_url } : current)
    } catch {
      setAvatarError('No pudimos cambiar tu foto.')
    } finally {
      setAvatarUploading(false)
    }
  }

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
      const dataUrl = await QRCode.toDataURL(publicUrl, { width: 1400, margin: 3, errorCorrectionLevel: 'H', color: { dark: '#111111', light: '#FFFFFF' } })
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

  const shareBankAccounts = async () => {
    if (!publicUrl) return
    const url = `${publicUrl}?share=bancos#bancos`
    const text = 'Te comparto mis datos bancarios para transferencias.'
    setShareFeedback('')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cuentas bancarias', text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareFeedback('Enlace de cuentas bancarias copiado.')
    } catch (error: any) {
      if (error?.name !== 'AbortError') setShareFeedback('No pudimos compartir el enlace en este momento.')
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

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="loading-spinner" /></div>

  const profileLabel = me?.name || me?.email || 'Mi cuenta Kawvo'

  return (
    <>
      {avatarFile && <ImageCropModal file={avatarFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setAvatarFile(null)} />}
      <FreeNotificationBell hideTrigger />

      <main className="min-h-screen bg-white pb-24 font-['Inter'] text-slate-900">
        <section className="mx-auto w-full max-w-[430px] px-5 pt-6">
          <div className="flex items-center gap-3 pb-5">
            <button type="button" onClick={() => navigate('/admin/free')} aria-label="Volver" className="text-[34px] font-light leading-none text-slate-500">←</button>
            <h1 className="text-[32px] font-black tracking-[-0.045em] text-slate-950">Mi cuenta</h1>
          </div>

          <SectionTitle>CUENTA</SectionTitle>
          <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
            <div className="flex min-h-[92px] items-center gap-3 border-b border-slate-200 px-4 py-3">
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
                {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xl text-slate-500">●</span>}
                <span className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-0.5 text-center text-[8px] font-bold text-white">Editar</span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={avatarUploading} onChange={chooseAvatar} />
              <button type="button" onClick={() => avatarInputRef.current?.click()} className="min-w-0 flex-1 text-left">
                <span className="block text-[18px] font-bold leading-6 text-slate-900">{profileLabel}</span>
                {me?.slug && <span className="mt-0.5 block text-[12px] text-slate-400">@{me.slug}</span>}
              </button>
              <span className="rounded-lg bg-slate-500 px-2.5 py-1 text-[12px] font-bold text-white">{planLabel(me)}</span>
              <span className="text-[28px] font-light text-slate-400">›</span>
            </div>

            <SettingsRow icon="✦" label="Mejora tu plan" href={basicPlanWhatsAppUrl()} />
            <SettingsRow icon="♧" label="Notificaciones" detail={unreadCount > 0 ? `${unreadCount} sin leer` : undefined} onClick={openNotifications} />
            <SettingsRow icon="✧" label="Cuotas de IA" detail={aiUsage ? `${aiUsage.remaining_today ?? '—'} hoy · ${aiUsage.remaining_month ?? '—'} este mes` : undefined} onClick={() => setShowAi((value) => !value)} />
            {showAi && (
              <div className="border-b border-slate-200 bg-white/70 px-5 py-4 text-sm text-slate-600">
                <div className="flex justify-between"><span>Disponibles hoy</span><strong>{aiUsage?.remaining_today ?? '—'}</strong></div>
                <div className="mt-2 flex justify-between"><span>Disponibles este mes</span><strong>{aiUsage?.remaining_month ?? '—'}</strong></div>
                <button type="button" onClick={() => navigate('/admin/free/ai-profile')} className="mt-3 font-bold text-cyan-700">Abrir asistente IA</button>
              </div>
            )}
            <SettingsRow icon="▣" label="Dispositivos vinculados" detail={`${sessions.length} sesión${sessions.length === 1 ? '' : 'es'} activa${sessions.length === 1 ? '' : 's'}`} onClick={() => setShowDevices((value) => !value)} />
            {showDevices && (
              <div className="border-b border-slate-200 bg-white/70 px-4 py-3">
                {sessions.length === 0 ? <p className="text-sm text-slate-400">No encontramos sesiones activas.</p> : sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0">
                    <div className="min-w-0"><p className="text-sm font-semibold text-slate-700">{session.label}{session.is_current ? ' · Este dispositivo' : ''}</p></div>
                    {!session.is_current && <button type="button" disabled={sessionBusy === session.id} onClick={() => void revokeSession(session)} className="text-xs font-bold text-rose-600">{sessionBusy === session.id ? 'Cerrando…' : 'Cerrar'}</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {avatarError && <p className="mt-2 text-xs font-semibold text-rose-600">{avatarError}</p>}

          <div className="mt-8">
            <SectionTitle>MI KAWVO</SectionTitle>
            <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
              <SettingsRow icon="⌁" label="Mis productos" detail="NFC y QR vinculados" onClick={() => navigate('/admin/artifacts')} />
              <SettingsRow icon="▦" label={qrBusy ? 'Generando QR…' : 'Descargar QR de mi perfil'} onClick={() => void downloadQr()} />
              {bankActive && <SettingsRow icon="$" label="Enviar cuentas bancarias" detail="Comparte el enlace directo a tus datos bancarios" onClick={() => void shareBankAccounts()} />}
              <SettingsRow icon="↗" label="Invitar a un amigo" onClick={() => void inviteFriend()} />
            </div>
          </div>
          {shareFeedback && <p className="mt-3 text-center text-xs font-semibold text-slate-500">{shareFeedback}</p>}

          <div className="mt-8">
            <SectionTitle>AYUDA Y RECURSOS</SectionTitle>
            <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
              <SettingsRow icon="◎" label="Centro de ayuda y tickets" onClick={() => document.getElementById('kawvo-support-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
              {resources.map((resource) => <SettingsRow key={resource.id} icon="□" label={resource.title} detail={resource.description || undefined} href={resource.url} />)}
            </div>
          </div>

          <div className="mt-8">
            <SectionTitle>CUENTA Y SEGURIDAD</SectionTitle>
            <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
              <SettingsRow icon="↪" label="Cerrar sesión" onClick={() => void handleLogout()} />
            </div>
          </div>

          <div className="mt-8" id="account-support">
            <FreeSupportPanel />
          </div>

          {me?.slug && (
            <div className="mt-8">
              <FreeProfileDangerZone slug={me.slug} email={me.email || ''} />
            </div>
          )}
        </section>
      </main>
    </>
  )
}
