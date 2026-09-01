import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost, apiUpload } from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'
import { UpgradeCrownIcon, basicPlanWhatsAppUrl } from './FreePanelUi'
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
  if (plan === 'basic') return 'PLUS'
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
        {detail && <span className="mt-0.5 block text-[13px] leading-5 text-slate-500">{detail}</span>}
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
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [shareFeedback, setShareFeedback] = useState('')
  const [qrBusy, setQrBusy] = useState(false)
  const [qrPreview, setQrPreview] = useState('')
  const [showQrPreview, setShowQrPreview] = useState(false)
  const [showInvitePreview, setShowInvitePreview] = useState(false)
  const [pwaInstalled, setPwaInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone) || localStorage.getItem('kawvo_pwa_installed') === '1')
  const [pwaInstallReady, setPwaInstallReady] = useState(() => Boolean((window as any).__kawvoInstallPrompt))
  const [showPwaHelp, setShowPwaHelp] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [showAi, setShowAi] = useState(false)

  const webUrl = useMemo(() => (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, ''), [])
  const publicUrl = me?.slug ? `${webUrl}/${me.slug}` : ''

  useEffect(() => {
    Promise.all([
      apiGet('/me').catch(() => ({ ok: false })),
      apiGet('/me/bank-accounts').catch(() => ({ ok: false })),
      apiGet('/me/ai-profile-assistant/context').catch(() => ({ ok: false })),
      apiGet('/me/account/resources').catch(() => ({ ok: false })),
      apiGet('/me/notifications?limit=1').catch(() => ({ ok: false })),
    ]).then(([meJson, bankJson, aiJson, resourcesJson, notificationsJson]: any[]) => {
      if (meJson?.ok) setMe(meJson.data || null)
      if (bankJson?.ok) setBankActive(Boolean(bankJson.data?.access?.allowed && bankJson.data?.enabled !== false))
      if (aiJson?.ok) setAiUsage(aiJson.data?.usage || null)
      if (resourcesJson?.ok) setResources(Array.isArray(resourcesJson.data?.items) ? resourcesJson.data.items : [])
      if (notificationsJson?.ok) setUnreadCount(Number(notificationsJson.data?.unread_count || 0))
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onReady = () => setPwaInstallReady(Boolean((window as any).__kawvoInstallPrompt))
    const onInstalled = () => {
      localStorage.setItem('kawvo_pwa_installed', '1')
      setPwaInstalled(true)
      setPwaInstallReady(false)
      setShowPwaHelp(false)
    }
    window.addEventListener('kawvo:pwa-install-ready', onReady)
    window.addEventListener('appinstalled', onInstalled)
    onReady()
    return () => {
      window.removeEventListener('kawvo:pwa-install-ready', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
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

  const openNotifications = () => navigate('/admin/free/notifications?from=account')

  const previewQr = async () => {
    if (!publicUrl || qrBusy) return
    setQrBusy(true)
    setShareFeedback('')
    try {
      const QRCode = await import('qrcode')
      const dataUrl = await QRCode.toDataURL(publicUrl, { width: 1400, margin: 3, errorCorrectionLevel: 'H', color: { dark: '#111111', light: '#FFFFFF' } })
      setQrPreview(dataUrl)
      setShowQrPreview(true)
    } catch {
      setShareFeedback('No pudimos generar el QR en este momento.')
    } finally {
      setQrBusy(false)
    }
  }

  const downloadQr = () => {
    if (!qrPreview) return
    const link = document.createElement('a')
    link.href = qrPreview
    link.download = `kawvo-${me?.slug || 'perfil'}-qr.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setShareFeedback('QR descargado.')
  }

  const inviteSenderName = String(me?.name || '').trim().split(/\s+/)[0] || 'un amigo'
  const invitationUrl = `https://nfc.kawvoia.com/invitacion?de=${encodeURIComponent(inviteSenderName)}`

  const sendInvite = async () => {
    const url = invitationUrl
    const text = 'Me he creado un perfil en Kawvo Link para presentar lo que hago y compartir mis datos en un solo lugar. Crea tú también tu presentación digital; te lo recomiendo.'
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

  const installPwa = async () => {
    if (pwaInstalled) return
    const prompt = (window as any).__kawvoInstallPrompt
    if (!prompt) {
      setShowPwaHelp(true)
      return
    }
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      ;(window as any).__kawvoInstallPrompt = null
      setPwaInstallReady(false)
      if (choice?.outcome === 'accepted') {
        localStorage.setItem('kawvo_pwa_installed', '1')
        setPwaInstalled(true)
      }
    } catch {
      setShowPwaHelp(true)
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
      {showQrPreview && qrPreview && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Vista previa del código QR" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowQrPreview(false) }}>
          <article className="w-full max-w-[390px] rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Tu código QR</h2><button type="button" onClick={() => setShowQrPreview(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
            <div className="mt-5 flex justify-center"><img src={qrPreview} alt="Vista previa del código QR de tu perfil" className="h-56 w-56 rounded-2xl border border-slate-200" /></div>
            <p className="mt-4 text-center text-sm leading-6 text-slate-500">Este QR abre directamente tu perfil Kawvo.</p>
            <button type="button" onClick={downloadQr} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Descargar código QR</button>
          </article>
        </div>
      )}
      {showPwaHelp && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Cómo instalar Kawvo" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPwaHelp(false) }}>
          <article className="w-full max-w-[390px] rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Instalar app Kawvo</h2><button type="button" onClick={() => setShowPwaHelp(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
            <p className="mt-4 text-sm leading-6 text-slate-600">En iPhone o iPad, abre el menú Compartir del navegador y elige <strong>Agregar a pantalla de inicio</strong>.</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">En Android, abre el menú del navegador y selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</p>
          </article>
        </div>
      )}
      {showInvitePreview && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Vista previa de invitación" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInvitePreview(false) }}>
          <article className="w-full max-w-[390px] rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Invitar a un amigo</h2><button type="button" onClick={() => setShowInvitePreview(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
            <p className="mt-4 text-sm font-semibold text-slate-500">Mensaje que vas a compartir</p>
            <div className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">Me he creado un perfil en Kawvo Link para presentar lo que hago y compartir mis datos en un solo lugar. Crea tú también tu presentación digital; te lo recomiendo.<br/><span className="mt-2 block font-semibold text-cyan-700">{webUrl}/invitacion</span></div>
            <button type="button" onClick={() => void sendInvite()} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Compartir invitación</button>
          </article>
        </div>
      )}

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

            <SettingsRow icon={<span className="text-amber-500"><UpgradeCrownIcon className="h-6 w-6" /></span>} label="Mejora tu plan" detail="Conoce el Plan Plus" href={basicPlanWhatsAppUrl()} />
            <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>} label="Notificaciones" detail={unreadCount > 0 ? `${unreadCount} sin leer` : undefined} onClick={openNotifications} />
            <SettingsRow icon="✧" label="Cuotas de IA" detail={aiUsage ? `${aiUsage.remaining_today ?? '—'} hoy · ${aiUsage.remaining_month ?? '—'} este mes` : undefined} onClick={() => setShowAi((value) => !value)} />
            {showAi && (
              <div className="border-b border-slate-200 bg-white/70 px-5 py-4 text-sm text-slate-600">
                <div className="flex justify-between"><span>Disponibles hoy</span><strong>{aiUsage?.remaining_today ?? '—'}</strong></div>
                <div className="mt-2 flex justify-between"><span>Disponibles este mes</span><strong>{aiUsage?.remaining_month ?? '—'}</strong></div>
                <button type="button" onClick={() => navigate('/admin/free/ai-profile')} className="mt-3 font-bold text-cyan-700">Abrir asistente IA</button>
              </div>
            )}
                      </div>
          {avatarError && <p className="mt-2 text-xs font-semibold text-rose-600">{avatarError}</p>}

          <div className="mt-8">
            <SectionTitle>MI KAWVO</SectionTitle>
            <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
              {!pwaInstalled && <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 15l3 3 3-3M12 8v10"/></svg>} label="Instalar app Kawvo" detail={pwaInstallReady ? "Instálala en este dispositivo" : "Accede a Kawvo como una app"} onClick={() => void installPwa()} />}
              <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>} label="Mis productos" detail="NFC y QR vinculados" onClick={() => navigate('/admin/artifacts?from=account')} />
              <SettingsRow icon="▦" label={qrBusy ? 'Generando QR…' : 'Descargar QR de mi perfil'} onClick={() => void previewQr()} />
              {bankActive && <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18M12 3 3 8h18L12 3Z"/></svg>} label="Enviar enlace de cuentas" detail="Comparte con tus clientes el enlace directo a tus cuentas bancarias" onClick={() => void shareBankAccounts()} />}
              <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 19c.5-3.5 2.6-5.5 5.5-5.5s5 2 5.5 5.5M14 14c2.8-.3 5 1.4 5.5 4.5"/></svg>} label="Invitar a un amigo" onClick={() => setShowInvitePreview(true)} />
            </div>
          </div>
          {shareFeedback && <p className="mt-3 text-center text-xs font-semibold text-slate-500">{shareFeedback}</p>}

          <div className="mt-8">
            <SectionTitle>AYUDA Y RECURSOS</SectionTitle>
            <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
              {resources.map((resource) => <SettingsRow key={resource.id} icon="□" label={resource.title} detail={resource.description || undefined} href={resource.url} />)}
            </div>
          </div>

          <div className="mt-8">
            <SectionTitle>CUENTA Y SEGURIDAD</SectionTitle>
            <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
              <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 4H5v16h5"/><path d="M13 8l4 4-4 4M8 12h9"/></svg>} label="Cerrar sesión" onClick={() => void handleLogout()} />
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
