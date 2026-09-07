import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'
import { FreeUpgradeCard, basicPlanWhatsAppUrl } from './FreePanelUi'
import type { FreePublicationReadiness } from './FreeFirstRunGuide'
import FreeHelpTip from './FreeHelpTip'
import FreeNotificationBell from './FreeNotificationBell'

interface MeData {
  email: string
  profile_id: string | null
  slug: string | null
  name: string | null
  bio: string | null
  avatar_url: string | null
  category: string | null
  is_published: number
  plan_id: string | null
  plan_code?: string
  templateData?: Record<string, any>
  freeReadiness?: FreePublicationReadiness | null
}

type BankSummary = {
  allowed: boolean
  source: 'plan' | 'fair' | 'promotion' | null
  enabled: boolean
  count: number
}

type FreeItem = {
  title: string
  text: string
  to: string
  icon: string
  help: string
  readinessKey?: keyof FreePublicationReadiness['steps']
  stateKey?: 'location'
  available?: boolean
  optional?: boolean
  baseRequired?: boolean
}

const freeItems: FreeItem[] = [
  { title: 'Elige tu usuario', text: 'Ej.: @tuusuario', to: '/admin/free/identifier', icon: '@', help: 'Este será tu nombre único en el enlace público. Conviene elegir uno corto, fácil de recordar y relacionado contigo o tu negocio.', readinessKey: 'identifier', baseRequired: true },
  { title: 'Completa tu presentación', text: 'Foto de perfil, nombre, cargo y descripción', to: '/admin/free/onboarding/identity?from=panel', icon: '◉', help: 'Configura cómo te presentas: foto de perfil, nombre o marca, cargo y descripción.', readinessKey: 'identity', baseRequired: true },
  { title: 'Agrega tus datos de contacto', text: 'WhatsApp, teléfono, correo y otras formas de contactarte', to: '/admin/free/onboarding/contact', icon: '☎', help: 'Coloca los medios reales por los que quieres que tus clientes te contacten.', readinessKey: 'contact' },
  { title: 'Botones de contacto directo', text: 'Hasta 3 botones para que te contacten o encuentren con un toque', to: '/admin/free/quick-actions', icon: '◉', help: 'Elige las acciones más importantes para que una persona pueda contactarte o encontrarte con un solo toque.', readinessKey: 'quick_actions' },
  { title: 'Ubicación', text: 'Dirección y mapa de tu negocio', to: '/admin/free/location', icon: '⌖', help: 'Agrega la dirección real de tu negocio y, si corresponde, el enlace del mapa.', stateKey: 'location' },
  { title: 'Mis enlaces', text: 'Hasta 3 enlaces importantes', to: '/admin/free/links', icon: '↗', help: 'Puedes agregar páginas, catálogos, formularios u otros enlaces que quieras destacar.', available: true },
  { title: 'Muestra tus trabajos realizados', text: 'Máx. 5 fotos · mínimo 3 reales para publicar', to: '/admin/free/portfolio', icon: '▧', help: 'Sustituye las imágenes de ejemplo por fotos reales de tus trabajos. Para publicar necesitas al menos 3.', readinessKey: 'portfolio' },
  { title: 'Agrega tus servicios', text: 'Describe brevemente qué ofreces · mínimo 2 reales para publicar', to: '/admin/free/services', icon: '◇', help: 'Revisa los servicios de ejemplo y sustitúyelos por lo que realmente ofreces.', readinessKey: 'services' },
]

function isStarterAsset(value: unknown) {
  return String(value || '').includes('/assets/free-starter/')
}

function isStarterId(value: unknown) {
  return String(value || '').startsWith('starter:')
}

export default function FreeDashboard() {
  const navigate = useNavigate()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [me, setMe] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [hasSuperAdminAccess, setHasSuperAdminAccess] = useState(false)
  const [watermarkUpsellOpen, setWatermarkUpsellOpen] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [locationConfigured, setLocationConfigured] = useState(false)
  const [contactConfirmed, setContactConfirmed] = useState(false)
  const [quickActionsConfirmed, setQuickActionsConfirmed] = useState(false)
  const [portfolioConfirmed, setPortfolioConfirmed] = useState(false)
  const [servicesConfirmed, setServicesConfirmed] = useState(false)
  const [bankSummary, setBankSummary] = useState<BankSummary>({ allowed: false, source: null, enabled: false, count: 0 })

  useEffect(() => {
    Promise.all([
      apiGet('/me'),
      apiGet('/superadmin/metrics/overview').catch(() => ({ ok: false })),
      apiGet('/me/bank-accounts').catch(() => ({ ok: false })),
      apiGet('/me/contact').catch(() => ({ ok: false })),
      apiGet('/me/free/quick-actions').catch(() => ({ ok: false })),
      apiGet('/me/gallery').catch(() => ({ ok: false })),
      apiGet('/me/products').catch(() => ({ ok: false })),
    ]).then(([meJson, superAdminJson, bankJson, contactJson, quickJson, galleryJson, servicesJson]: any[]) => {
      if (meJson?.ok) setMe(meJson.data)
      setHasSuperAdminAccess(Boolean(superAdminJson?.ok))

      if (bankJson?.ok) {
        setBankSummary({
          allowed: Boolean(bankJson.data?.access?.allowed),
          source: bankJson.data?.access?.source || null,
          enabled: bankJson.data?.enabled !== false,
          count: Array.isArray(bankJson.data?.items) ? bankJson.data.items.length : 0,
        })
      }

      if (contactJson?.ok && contactJson.data) {
        const whatsapp = String(contactJson.data.whatsapp || '').trim()
        const email = String(contactJson.data.email || '').trim()
        const phoneDigits = String(contactJson.data.phone || '').replace(/\D/g, '')
        const place = String(contactJson.data.place_name || contactJson.data.address || '').trim()
        const mapUrl = String(contactJson.data.map_url || '').trim()
        const starterPhone = phoneDigits === '8090000000' || phoneDigits === '18090000000'
        const starterMap = mapUrl.includes('Santo+Domingo%2C+Rep%C3%BAblica+Dominicana')
        setContactConfirmed(Boolean(whatsapp || email || (phoneDigits && !starterPhone)))
        setLocationConfigured(Boolean(place && mapUrl && !starterMap))
      }

      if (quickJson?.ok) {
        const selected = Array.isArray(quickJson.data?.selected) ? quickJson.data.selected : []
        const real = selected.filter((item: any) => {
          const url = String(item?.url || '')
          if (url.includes('18090000000')) return false
          if (url.includes('instagram.com/intaprd')) return false
          if (url.includes('Santo+Domingo%2C+Rep%C3%BAblica+Dominicana')) return false
          return Boolean(url.trim())
        })
        setQuickActionsConfirmed(real.length >= 2)
      }

      if (galleryJson?.ok) {
        const photos = Array.isArray(galleryJson.photos) ? galleryJson.photos : []
        const realPhotos = photos.filter((photo: any) => !isStarterId(photo?.id) || !isStarterAsset(photo?.image_key))
        setPortfolioConfirmed(realPhotos.length >= 3)
      }

      if (servicesJson?.ok) {
        const items = Array.isArray(servicesJson.data) ? servicesJson.data : []
        const realServices = items.filter((item: any) => !isStarterId(item?.id) || !isStarterAsset(item?.image_url))
        setServicesConfirmed(realServices.length >= 2)
      }
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    const top = Number(sessionStorage.getItem('kawvo_free_dashboard_scroll_y') || 0)
    if (Number.isFinite(top) && top > 0) window.requestAnimationFrame(() => window.scrollTo({ top, left: 0, behavior: 'auto' }))
  }, [loading])

  useEffect(() => {
    const rememberScroll = () => sessionStorage.setItem('kawvo_free_dashboard_scroll_y', String(window.scrollY))
    document.addEventListener('click', rememberScroll, true)
    window.addEventListener('pagehide', rememberScroll)
    return () => {
      document.removeEventListener('click', rememberScroll, true)
      window.removeEventListener('pagehide', rememberScroll)
    }
  }, [])

  const togglePublished = async () => {
    if (!me || publishing) return
    const next = me.is_published ? 0 : 1
    if (next === 1 && !effectivePublishReady) {
      setPublishError('Aún no puedes publicar. Reemplaza el contenido de ejemplo por tus datos y contenido reales.')
      return
    }
    setPublishing(true)
    setPublishError('')
    try {
      const result: any = await apiPut('/me/profile', { is_published: next === 1 })
      if (result.ok) {
        setMe({ ...me, is_published: next })
        if (next === 1) void apiPost('/me/notifications/profile-published', {}).catch(() => undefined)
      } else if (result.error === 'profile_incomplete') {
        setPublishError(result.message || 'Completa los pasos mínimos antes de publicar.')
        setMe({ ...me, freeReadiness: result.readiness || me.freeReadiness })
      } else {
        setPublishError(result.error || 'No pudimos cambiar el estado de publicación.')
      }
    } finally { setPublishing(false) }
  }

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
      if (!result?.ok || !result?.avatar_url) { setAvatarError(result?.error || 'No pudimos cambiar tu foto.'); return }
      setMe((current) => current ? { ...current, avatar_url: result.avatar_url } : current)
    } catch { setAvatarError('No pudimos cambiar tu foto.') }
    finally { setAvatarUploading(false) }
  }

  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch { setLinkCopied(false) }
  }

  const sharePublicUrl = async (url: string) => {
    setShareMessage('')
    try {
      if (navigator.share) {
        await navigator.share({ title: me?.name || 'Mi perfil', url })
        setShareMessage('Perfil listo para compartir.')
        return
      }
      await navigator.clipboard.writeText(url)
      setShareMessage('Enlace copiado para compartir.')
    } catch (error: any) {
      if (error?.name !== 'AbortError') setShareMessage('No pudimos abrir el menú para compartir.')
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  const publicUrl = me?.slug ? `${webUrl}/${me.slug}` : null
  const readiness = me?.freeReadiness
  const templateData = me?.templateData || {}
  const identityConfirmed = templateData.free_identity_confirmed === true
  const nameReady = Boolean(identityConfirmed && String(me?.name || '').trim() && String(me?.name || '').trim().toLowerCase() !== 'tu nombre o negocio')
  const roleReady = Boolean(identityConfirmed && String(templateData.role || '').trim())
  const usernameReady = Boolean(readiness?.steps?.identifier)
  const photoReady = Boolean(me?.avatar_url && !isStarterAsset(me.avatar_url))
  const baseReady = nameReady && roleReady && usernameReady && photoReady
  const effectivePublishReady = baseReady && contactConfirmed && quickActionsConfirmed && portfolioConfirmed && servicesConfirmed
  const publishMissing = [
    !baseReady ? 'los datos esenciales' : '',
    !contactConfirmed ? 'contacto real' : '',
    !quickActionsConfirmed ? 'accesos rápidos reales' : '',
    !portfolioConfirmed ? '3 imágenes reales de portafolio' : '',
    !servicesConfirmed ? '2 servicios revisados' : '',
  ].filter(Boolean)

  const baseChecklist = [
    { label: 'Nombre', done: nameReady },
    { label: 'Cargo', done: roleReady },
    { label: 'Usuario', done: usernameReady },
    { label: 'Foto', done: photoReady },
  ]

  const completedForItem = (item: FreeItem) => {
    if (item.readinessKey === 'identifier') return usernameReady
    if (item.readinessKey === 'identity') return nameReady && roleReady && photoReady
    if (item.readinessKey === 'contact') return contactConfirmed
    if (item.readinessKey === 'quick_actions') return quickActionsConfirmed
    if (item.readinessKey === 'portfolio') return portfolioConfirmed
    if (item.readinessKey === 'services') return servicesConfirmed
    if (item.stateKey === 'location') return locationConfigured
    return false
  }

  const renderEditItem = (item: FreeItem) => {
    const completed = completedForItem(item)
    const locked = !baseReady && !item.baseRequired
    const neutral = Boolean(item.optional || item.available)
    const statusLabel = locked ? 'Bloqueado' : item.optional ? 'Opcional' : item.available ? 'Disponible' : completed ? 'Completado' : 'Por revisar'
    const cardClass = locked ? 'border-amber-200 bg-amber-50/50 opacity-75' : neutral ? 'border-slate-200 bg-white' : completed ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
    const iconClass = locked ? 'bg-amber-100 text-amber-700' : neutral ? 'bg-slate-100 text-slate-600' : completed ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
    const badgeClass = locked ? 'bg-amber-100 text-amber-800' : neutral ? 'bg-slate-100 text-slate-500' : completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
    const open = () => { if (!locked) navigate(item.to) }
    return (
      <div key={item.title} className={`relative flex w-full items-center gap-3 rounded-[22px] border p-4 transition ${!locked ? 'hover:-translate-y-0.5 hover:shadow-md' : ''} ${cardClass}`}>
        <button type="button" disabled={locked} onClick={open} className="flex min-w-0 flex-1 items-center gap-4 text-left disabled:cursor-not-allowed">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${iconClass}`}>{locked ? '🔒' : completed && !neutral ? '✓' : item.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2"><span className="block text-sm font-black text-slate-900">{item.title}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${badgeClass}`}>{statusLabel}</span></span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-500">{locked ? 'Completa primero nombre, cargo, usuario y foto de perfil.' : item.text}</span>
          </span>
        </button>
        <FreeHelpTip title={item.title} text={item.help} />
        <button type="button" disabled={locked} onClick={open} aria-label={`Abrir ${item.title}`} className="text-lg text-slate-300 disabled:cursor-not-allowed">›</button>
      </div>
    )
  }

  return (
    <>
      {avatarFile && <ImageCropModal file={avatarFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setAvatarFile(null)} />}
      <main className="min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3">
            <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">KAWVO LINK</p><h1 className="mt-0.5 text-xl font-black tracking-[-0.03em]">Mi panel</h1></div>
            <div className="flex items-center gap-2">
              <FreeNotificationBell />
              {hasSuperAdminAccess && <button type="button" onClick={() => navigate('/superadmin')} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">Super Admin</button>}
              <button type="button" onClick={() => navigate('/admin/free/account')} aria-label="Mi cuenta" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">Mi cuenta</button>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[430px] space-y-4 px-5 pt-5">
          <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} aria-label="Cambiar foto de perfil" className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ring-offset-2 transition hover:ring-2 hover:ring-cyan-300 disabled:opacity-60">
                  {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">👤</div>}
                  <span className="absolute inset-x-0 bottom-0 bg-slate-950/75 py-1 text-center text-[9px] font-black text-white">{avatarUploading ? 'Subiendo…' : 'Cambiar'}</span>
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={avatarUploading} onChange={chooseAvatar} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="truncate text-base font-black">{me?.name || me?.email || 'Mi perfil'}</p><span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700">Gratis</span></div>
                {me?.slug && <p className="mt-0.5 text-xs font-semibold text-slate-400">@{me.slug}</p>}
                {me?.category && <p className="mt-1 text-xs font-bold text-cyan-600">{me.category}</p>}
              </div>
            </div>
            {avatarError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{avatarError}</p>}

            <button type="button" onClick={() => navigate(usernameReady ? '/admin/free/onboarding/identity?from=panel' : '/admin/free/identifier')} className="mt-5 flex w-full items-center justify-between rounded-2xl border-2 border-cyan-300 bg-cyan-50 px-4 py-4 text-left shadow-sm">
              <span className="min-w-0 flex-1">
                <span className="inline-flex rounded-full bg-cyan-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">Empieza por aquí · Recomendado</span>
                <span className="mt-2 block text-base font-black text-slate-950">Personaliza tu perfil</span>
                <span className="mt-1 block text-xs font-medium leading-5 text-slate-600">Completa primero estos 4 datos esenciales.</span>
                <span className="mt-3 flex flex-wrap gap-2">{baseChecklist.map((item) => <span key={item.label} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{item.done ? '✓ ' : ''}{item.label}</span>)}</span>
              </span>
              <span className="ml-3 text-xl font-black text-cyan-700">›</span>
            </button>

            {me?.slug ? <a href={`/api/v1/me/free/profile-preview/${encodeURIComponent(me.slug)}?full=1`} target="_blank" rel="noopener noreferrer" className="mt-2 flex w-full items-center justify-center rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700">Ver vista previa</a> : <button type="button" disabled className="mt-2 w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-400">Ver vista previa</button>}
            <button type="button" disabled={!baseReady} onClick={() => navigate('/admin/free/editor')} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Diseño, plantilla y colores</button>
            {!baseReady && <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">La vista previa ya está disponible. Las demás ediciones se habilitan al completar los 4 datos esenciales.</p>}
          </article>

          <div className="rounded-[24px] border border-cyan-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Tu borrador</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Haz tuyo el perfil base</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">El contenido precargado se mantiene en amarillo hasta que lo sustituyas por información real.</p>
          </div>
          <div className="grid grid-cols-1 gap-3">{freeItems.map(renderEditItem)}</div>

          {publicUrl && (
            <article className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Enlace de tu perfil</p><p className="mt-2 truncate text-sm font-black text-cyan-700">{publicUrl.replace(/^https?:\/\//, '')}</p></div>
                <FreeHelpTip title="Vista previa" text="Puedes revisar tu borrador desde el inicio. Publicarlo requiere reemplazar el contenido de ejemplo por información real." />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <a href={`/api/v1/me/free/profile-preview/${encodeURIComponent(me?.slug || '')}?full=1`} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">Ver vista previa</a>
                <button type="button" onClick={() => void copyPublicUrl(publicUrl)} disabled={!me?.is_published} className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-black transition-all duration-200 ${!me?.is_published ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : linkCopied ? 'scale-[1.04] border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{linkCopied ? '✓ Enlace copiado' : 'Copiar enlace'}</button>
                <button type="button" onClick={() => void sharePublicUrl(publicUrl)} disabled={!me?.is_published} className="min-h-10 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Compartir perfil</button>
              </div>
              {shareMessage && <p className="mt-2 text-xs font-semibold text-slate-500">{shareMessage}</p>}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-black">{me?.is_published ? 'Publicado' : 'Borrador'}</p><p className="mt-0.5 text-xs text-slate-400">{me?.is_published ? 'Tu perfil está visible.' : 'Solo tú puedes verlo por ahora.'}</p></div>
                  <button onClick={togglePublished} disabled={publishing || (!me?.is_published && !effectivePublishReady)} className={`rounded-full px-4 py-2 text-xs font-black ${me?.is_published ? 'bg-slate-100 text-slate-700' : effectivePublishReady ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-400'} disabled:cursor-not-allowed disabled:opacity-80`}>{publishing ? 'Guardando…' : me?.is_published ? 'Ocultar' : effectivePublishReady ? 'Publicar' : 'Completa los datos'}</button>
                </div>
                {!me?.is_published && !effectivePublishReady && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-800"><strong>Publicar está deshabilitado.</strong> Todavía faltan {publishMissing.join(', ')}.</div>}
              </div>
            </article>
          )}

          {publishError && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-800">{publishError}</p>}

          <article className={`rounded-[24px] border p-5 ${bankSummary.allowed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Cuentas bancarias</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Facilita las transferencias bancarias</h2>
                {bankSummary.allowed ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Disponible para tu perfil. {bankSummary.enabled ? 'Sección activa' : 'Sección desactivada'} · {bankSummary.count}/3 cuentas configuradas{bankSummary.source === 'fair' || bankSummary.source === 'promotion' ? ' · Beneficio promocional' : ''}.</p> : <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Disponible en Plan Plus y en promociones vigentes para Free.</p>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${bankSummary.allowed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{bankSummary.allowed ? 'Disponible' : 'Bloqueado'}</span>
            </div>
            <button type="button" disabled={!baseReady} onClick={() => navigate('/admin/free/bank-accounts')} className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-black ${bankSummary.allowed ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}>{bankSummary.allowed ? 'Administrar cuentas bancarias' : 'Ver por qué está bloqueado'}</button>
          </article>

          <button type="button" disabled={!baseReady} onClick={() => navigate('/admin/free/ai-profile')} className="flex w-full items-center gap-3 rounded-[22px] border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-4 text-left shadow-sm transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-xl text-white">✦</span>
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">IA de Kawvo</span><span className="mt-0.5 block text-base font-black text-slate-950">Optimiza tu perfil</span><span className="mt-1 block text-xs font-medium leading-5 text-slate-600">Úsala después de completar tus datos esenciales.</span></span>
            <span className="text-xl font-black text-cyan-700">›</span>
          </button>

          <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
            <button type="button" disabled={!baseReady} onClick={() => setWatermarkUpsellOpen((current) => !current)} className="flex w-full items-center justify-between gap-4 p-4 text-left disabled:cursor-not-allowed disabled:opacity-50" aria-expanded={watermarkUpsellOpen}>
              <span className="min-w-0"><span className="block text-sm font-black text-slate-900">Quitar marca de agua</span><span className="mt-0.5 block text-xs font-semibold text-slate-400">Disponible en Plan Plus</span></span>
              <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full transition ${watermarkUpsellOpen ? 'bg-violet-600' : 'bg-slate-200'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${watermarkUpsellOpen ? 'left-6' : 'left-1'}`} /></span>
            </button>
            {watermarkUpsellOpen && <div className="border-t border-violet-100 bg-violet-50/70 p-4"><p className="text-sm font-black text-slate-900">Personaliza aún más tu perfil</p><p className="mt-1 text-xs leading-5 text-slate-600">Puedes quitar la marca de agua y disfrutar otros beneficios. Pásate al Plan Plus.</p><a href={basicPlanWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-black text-violet-700 shadow-sm">Conocer Plan Plus</a></div>}
          </section>

          {hasSuperAdminAccess && <button type="button" onClick={() => navigate('/superadmin')} className="flex w-full items-center justify-between rounded-[22px] border border-slate-800 bg-slate-950 p-4 text-left text-white shadow-sm"><span><span className="block text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">Acceso interno</span><span className="mt-1 block text-sm font-black">Abrir Super Admin</span><span className="mt-1 block text-xs text-slate-300">Productos, promociones, pagos, suscriptores y operación SaaS.</span></span><span className="text-xl text-slate-400">›</span></button>}

          <FreeUpgradeCard />
        </section>
      </main>
    </>
  )
}
