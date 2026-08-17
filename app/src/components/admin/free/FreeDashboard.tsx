import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../../../lib/api'
import { FreeUpgradeCard, basicPlanWhatsAppUrl } from './FreePanelUi'

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
}

const freeItems = [
  { title: 'Estilo de mi perfil', text: 'Impacto, Personal o Esencial', to: '/admin/free/style', icon: '◫' },
  { title: 'Editar identidad', text: 'Nombre, foto y descripción', to: '/admin/free/onboarding/identity', icon: '✎' },
  { title: 'Datos de contacto', text: 'WhatsApp, teléfono y correo', to: '/admin/free/onboarding/contact', icon: '☎' },
  { title: 'Accesos rápidos', text: 'Elige hasta 3: Llamar, Instagram, Ubicación, Email o TikTok', to: '/admin/free/quick-actions', icon: '◉' },
  { title: 'Ubicación', text: 'Dirección y mapa de tu negocio', to: '/admin/free/location', icon: '⌖' },
  { title: 'Mis enlaces', text: 'Hasta 3 accesos importantes', to: '/admin/free/links', icon: '↗' },
  { title: 'Portafolio', text: 'Hasta 5 imágenes de tu trabajo', to: '/admin/free/portfolio', icon: '▧' },
  { title: 'Servicios', text: 'Hasta 3 servicios, sin complicaciones', to: '/admin/free/services', icon: '◇' },
  { title: 'Mis productos físicos', text: 'Activa y administra tus productos INTAP', to: '/admin/artifacts', icon: '⌁' },
]

export default function FreeDashboard() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [hasSuperAdminAccess, setHasSuperAdminAccess] = useState(false)
  const [watermarkUpsellOpen, setWatermarkUpsellOpen] = useState(false)

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
    setPublishing(true)
    const next = me.is_published ? 0 : 1
    try {
      const result: any = await apiPut('/me/profile', { is_published: next === 1 })
      if (result.ok) setMe({ ...me, is_published: next })
    } finally {
      setPublishing(false)
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
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">INTAP LINK</p>
            <h1 className="mt-0.5 text-xl font-black tracking-[-0.03em]">Mi panel</h1>
          </div>
          <div className="flex items-center gap-2">
            {hasSuperAdminAccess && (
              <button
                type="button"
                onClick={() => navigate('/superadmin')}
                className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
              >
                Super Admin
              </button>
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
          <button
            type="button"
            onClick={() => setWatermarkUpsellOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-4 p-4 text-left"
            aria-expanded={watermarkUpsellOpen}
          >
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-900">Quitar marca de agua</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-400">Disponible en Plan Básico</span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${watermarkUpsellOpen ? 'bg-violet-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${watermarkUpsellOpen ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          {watermarkUpsellOpen && (
            <div className="border-t border-violet-100 bg-violet-50/70 p-4">
              <p className="text-sm font-black text-slate-900">Personaliza aún más tu perfil</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Puedes quitar la marca de agua y disfrutar otros beneficios. Pásate al Plan Básico.</p>
              <a
                href={basicPlanWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-black text-violet-700 shadow-sm"
              >
                Conocer Plan Básico
              </a>
            </div>
          )}
        </section>

        {hasSuperAdminAccess && (
          <button
            type="button"
            onClick={() => navigate('/superadmin')}
            className="flex w-full items-center justify-between rounded-[22px] border border-slate-800 bg-slate-950 p-4 text-left text-white shadow-sm"
          >
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">Acceso interno</span>
              <span className="mt-1 block text-sm font-black">Abrir Super Admin</span>
              <span className="mt-1 block text-xs text-slate-300">Productos, códigos, pagos, suscriptores y operación SaaS.</span>
            </span>
            <span className="text-xl text-slate-400">›</span>
          </button>
        )}

        {publicUrl && (
          <article className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Tu enlace público</p>
            <p className="mt-2 truncate text-sm font-black text-cyan-700">{publicUrl.replace(/^https?:\/\//, '')}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={`${publicUrl}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-10 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700"
              >
                Vista previa
              </a>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(publicUrl)}
                className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600"
              >
                Copiar enlace
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-black">{me?.is_published ? 'Publicado' : 'Borrador'}</p>
                <p className="mt-0.5 text-xs text-slate-400">{me?.is_published ? 'Tu perfil está visible.' : 'Solo tú puedes verlo por ahora.'}</p>
              </div>
              <button onClick={togglePublished} disabled={publishing} className={`rounded-full px-4 py-2 text-xs font-black ${me?.is_published ? 'bg-slate-100 text-slate-700' : 'bg-cyan-600 text-white'} disabled:opacity-50`}>
                {publishing ? 'Guardando…' : me?.is_published ? 'Ocultar' : 'Publicar'}
              </button>
            </div>
          </article>
        )}

        <div className="pt-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tu perfil</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Lo esencial para empezar</h2>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {freeItems.map((item) => (
            <button key={item.title} onClick={() => navigate(item.to)} className="flex w-full items-center gap-4 rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-xl font-black text-slate-700">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-400">{item.text}</span>
              </span>
              <span className="text-lg text-slate-300">›</span>
            </button>
          ))}
        </div>

        <FreeUpgradeCard />
      </section>
    </main>
  )
}
