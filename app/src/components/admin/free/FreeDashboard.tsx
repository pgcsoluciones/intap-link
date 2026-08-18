import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../../../lib/api'
import { FreeUpgradeCard, basicPlanWhatsAppUrl } from './FreePanelUi'
import FreeProfileDangerZone from './FreeProfileDangerZone'
import FreeFirstRunGuide, { type FreePublicationReadiness } from './FreeFirstRunGuide'
import FreeHelpTip from './FreeHelpTip'
import FreeSupportPanel from './FreeSupportPanel'
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
  freeReadiness?: FreePublicationReadiness | null
}

const freeItems = [
  {
    title: 'Reservar mi identificador',
    text: 'Elige tu enlace corto /usuario',
    to: '/admin/free/identifier',
    icon: '@',
    help: 'Este será tu nombre único en el enlace público. Por ejemplo: kawvo.com/juanperez. Conviene elegir uno corto, fácil de recordar y relacionado contigo o tu negocio.',
  },
  {
    title: 'Estilo de mi perfil (plantillas)',
    text: 'Elige cómo se verá: Impacto, Personal o Esencial',
    to: '/admin/free/style',
    icon: '◫',
    help: 'Aquí eliges la plantilla, los colores y la forma general de tu perfil. No cambia tu información; solamente cambia cómo se presenta visualmente.',
  },
  {
    title: 'Mi información principal',
    text: 'Nombre, foto, actividad y descripción',
    to: '/admin/free/onboarding/identity',
    icon: '✎',
    help: 'Completa el nombre que quieres mostrar, tu foto o imagen principal y una descripción breve para que las personas entiendan rápidamente quién eres y qué haces.',
  },
  {
    title: 'Datos de contacto',
    text: 'WhatsApp, teléfono y correo',
    to: '/admin/free/onboarding/contact',
    icon: '☎',
    help: 'Coloca los medios reales por los que quieres que tus clientes te contacten. Los datos de ejemplo del starter deben cambiarse por los tuyos antes de publicar.',
  },
  {
    title: 'Botones rápidos',
    text: 'Hasta 3: Llamar, Instagram, Ubicación, Email o TikTok',
    to: '/admin/free/quick-actions',
    icon: '◉',
    help: 'Son los botones que aparecen primero en tu perfil. Elige las acciones más importantes para que una persona pueda contactarte o encontrarte con un solo toque.',
  },
  {
    title: 'Ubicación',
    text: 'Dirección y mapa de tu negocio',
    to: '/admin/free/location',
    icon: '⌖',
    help: 'Agrega la dirección real de tu negocio y, si corresponde, el enlace del mapa. Si trabajas sin local físico puedes dejar esta sección sin mostrar.',
  },
  {
    title: 'Mis enlaces',
    text: 'Hasta 3 enlaces importantes',
    to: '/admin/free/links',
    icon: '↗',
    help: 'Puedes agregar páginas, catálogos, formularios u otros enlaces que quieras destacar. Usa nombres sencillos para que el visitante entienda a dónde va.',
  },
  {
    title: 'Mis trabajos (portafolio)',
    text: 'Hasta 5 imágenes de tu trabajo',
    to: '/admin/free/portfolio',
    icon: '▧',
    help: 'Muestra ejemplos reales de lo que haces. El starter incluye imágenes de referencia, pero para publicar debes reemplazarlas por fotografías o trabajos tuyos.',
  },
  {
    title: 'Servicios',
    text: 'Hasta 3 servicios con imagen y descripción',
    to: '/admin/free/services',
    icon: '◇',
    help: 'Explica claramente qué ofreces. Cada servicio puede tener un título, una descripción corta y una imagen. Reemplaza los servicios de ejemplo por los reales.',
  },
  {
    title: 'Mis productos Kawvo (NFC/QR)',
    text: 'Activa y administra tus productos físicos',
    to: '/admin/artifacts',
    icon: '⌁',
    help: 'Aquí administras las tarjetas, etiquetas u otros productos Kawvo vinculados a tu cuenta y al perfil digital.',
  },
]

export default function FreeDashboard() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [hasSuperAdminAccess, setHasSuperAdminAccess] = useState(false)
  const [watermarkUpsellOpen, setWatermarkUpsellOpen] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      apiGet('/me'),
      apiGet('/superadmin/metrics/overview').catch(() => ({ ok: false })),
    ]).then(([meJson, superAdminJson]: any[]) => {
      if (meJson?.ok) setMe(meJson.data)
      setHasSuperAdminAccess(Boolean(superAdminJson?.ok))
    }).finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    window.location.replace('/admin/login')
  }

  const togglePublished = async () => {
    if (!me || publishing) return
    const next = me.is_published ? 0 : 1
    if (next === 1 && me.freeReadiness && !me.freeReadiness.ready) {
      setPublishError('Todavía faltan algunos pasos. Sigue la guía y te avisaremos cuando esté listo para publicar.')
      return
    }
    setPublishing(true)
    setPublishError('')
    try {
      const result: any = await apiPut('/me/profile', { is_published: next === 1 })
      if (result.ok) {
        setMe({ ...me, is_published: next })
      } else if (result.error === 'profile_incomplete') {
        setPublishError(result.message || 'Completa los pasos mínimos antes de publicar.')
        setMe({ ...me, freeReadiness: result.readiness || me.freeReadiness })
      } else {
        setPublishError(result.error || 'No pudimos cambiar el estado de publicación.')
      }
    } finally {
      setPublishing(false)
    }
  }

  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      setLinkCopied(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  const publicUrl = me?.slug ? `${webUrl}/${me.slug}` : null

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">KAWVO LINK</p>
            <h1 className="mt-0.5 text-xl font-black tracking-[-0.03em]">Mi panel</h1>
          </div>
          <div className="flex items-center gap-2">
            <FreeNotificationBell />
            {hasSuperAdminAccess && (
              <button type="button" onClick={() => navigate('/superadmin')} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">Super Admin</button>
            )}
            <button onClick={handleLogout} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">Salir</button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[430px] space-y-4 px-5 pt-5">
        <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">👤</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-black">{me?.name || me?.email || 'Mi perfil'}</p>
                <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700">Gratis</span>
              </div>
              {me?.slug && <p className="mt-0.5 text-xs font-semibold text-slate-400">@{me.slug}</p>}
              {me?.category && <p className="mt-1 text-xs font-bold text-cyan-600">{me.category}</p>}
            </div>
            <button onClick={() => navigate('/admin/free/onboarding/identity')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Editar</button>
          </div>
        </article>

        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <button type="button" onClick={() => setWatermarkUpsellOpen((current) => !current)} className="flex w-full items-center justify-between gap-4 p-4 text-left" aria-expanded={watermarkUpsellOpen}>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-900">Quitar marca de agua</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-400">Disponible en Plan Básico</span>
            </span>
            <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full transition ${watermarkUpsellOpen ? 'bg-violet-600' : 'bg-slate-200'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${watermarkUpsellOpen ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          {watermarkUpsellOpen && (
            <div className="border-t border-violet-100 bg-violet-50/70 p-4">
              <p className="text-sm font-black text-slate-900">Personaliza aún más tu perfil</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Puedes quitar la marca de agua y disfrutar otros beneficios. Pásate al Plan Básico.</p>
              <a href={basicPlanWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-black text-violet-700 shadow-sm">Conocer Plan Básico</a>
            </div>
          )}
        </section>

        {hasSuperAdminAccess && (
          <button type="button" onClick={() => navigate('/superadmin')} className="flex w-full items-center justify-between rounded-[22px] border border-slate-800 bg-slate-950 p-4 text-left text-white shadow-sm">
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">Acceso interno</span>
              <span className="mt-1 block text-sm font-black">Abrir Super Admin</span>
              <span className="mt-1 block text-xs text-slate-300">Productos, códigos, pagos, suscriptores y operación SaaS.</span>
            </span>
            <span className="text-xl text-slate-400">›</span>
          </button>
        )}

        {me?.freeReadiness && <FreeFirstRunGuide readiness={me.freeReadiness} />}

        {publicUrl && (
          <article className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Tu enlace público</p>
                <p className="mt-2 truncate text-sm font-black text-cyan-700">{publicUrl.replace(/^https?:\/\//, '')}</p>
              </div>
              <FreeHelpTip title="Vista previa" text="Puedes abrir tu perfil aunque todavía esté en borrador. La vista previa no significa que ya esté publicado; solo te permite revisar cómo lo verá otra persona." />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`${publicUrl}?preview=1`} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">Vista previa</a>
              <button
                type="button"
                onClick={() => void copyPublicUrl(publicUrl)}
                className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-black transition-all duration-200 ${linkCopied ? 'scale-[1.04] border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                aria-live="polite"
              >
                {linkCopied ? '✓ Enlace copiado' : 'Copiar enlace'}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-black">{me?.is_published ? 'Publicado' : 'Borrador'}</p>
                <p className="mt-0.5 text-xs text-slate-400">{me?.is_published ? 'Tu perfil está visible.' : 'Solo tú puedes verlo por ahora.'}</p>
              </div>
              <button onClick={togglePublished} disabled={publishing || (!me?.is_published && Boolean(me?.freeReadiness && !me.freeReadiness.ready))} className={`rounded-full px-4 py-2 text-xs font-black ${me?.is_published ? 'bg-slate-100 text-slate-700' : me?.freeReadiness?.ready ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-400'} disabled:cursor-not-allowed disabled:opacity-80`}>
                {publishing ? 'Guardando…' : me?.is_published ? 'Ocultar' : me?.freeReadiness?.ready ? 'Publicar' : 'Completa los pasos'}
              </button>
            </div>
          </article>
        )}

        {publishError && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-800">{publishError}</p>}

        <div className="pt-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tu perfil</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Lo esencial para empezar</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Toca el signo <strong>?</strong> cuando quieras saber para qué sirve una sección.</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {freeItems.map((item) => (
            <div key={item.title} className="relative flex w-full items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <button onClick={() => navigate(item.to)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-xl font-black text-slate-700">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-400">{item.text}</span>
                </span>
              </button>
              <FreeHelpTip title={item.title} text={item.help} />
              <button type="button" onClick={() => navigate(item.to)} aria-label={`Abrir ${item.title}`} className="text-lg text-slate-300">›</button>
            </div>
          ))}
        </div>

        <FreeUpgradeCard />
        <FreeSupportPanel />

        {me?.slug && <FreeProfileDangerZone slug={me.slug} email={me.email || ''} />}
      </section>
    </main>
  )
}
