import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../lib/api'
import SuperAdminLayout, { type SuperAdminSection } from './SuperAdminLayout'

interface MetricsOverview {
  ok: boolean
  data?: Record<string, any>
  metrics?: Record<string, any>
  error?: string
}

interface Subscriber {
  user_id?: string
  id?: string
  email?: string
  slug?: string
  plan_id?: string
  is_active?: number | boolean
  is_published?: number | boolean
  created_at?: string | null
  profile_id?: string
}

interface BillingOverview {
  payments?: {
    total?: number
    pending?: number
    under_review?: number
    confirmed?: number
    confirmed_amount_cents?: number
  }
  subscriptions?: {
    active?: number
    past_due?: number
    suspended?: number
  }
  gateways?: {
    enabled?: number
  }
}

interface BillingGateway {
  id: string
  provider: string
  status: string
  display_name: string
  currency: string
  notes?: string | null
}

interface BillingPayment {
  id: string
  user_email?: string | null
  profile_slug?: string | null
  plan_id?: string | null
  amount_cents?: number
  currency?: string
  status?: string
  source?: string
  created_at?: string
}

interface BillingSubscription {
  id: string
  user_email?: string | null
  profile_slug?: string | null
  plan_id?: string
  status?: string
  source?: string
  current_period_end?: string | null
  created_at?: string
}

export default function SuperAdminDashboard() {
  const [currentSection, setCurrentSection] = useState<SuperAdminSection>('dashboard')
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null)
  const [gateways, setGateways] = useState<BillingGateway[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [metricsJson, subscribersJson, billingJson, gatewaysJson, paymentsJson, subscriptionsJson]: any[] = await Promise.all([
          apiGet('/superadmin/metrics/overview'),
          apiGet('/superadmin/subscribers?limit=25'),
          apiGet('/superadmin/billing/overview'),
          apiGet('/superadmin/billing/gateways'),
          apiGet('/superadmin/billing/payments?limit=10'),
          apiGet('/superadmin/billing/subscriptions?limit=10'),
        ])

        if (cancelled) return

        if (!metricsJson?.ok) {
          setError(metricsJson?.error || 'No se pudieron cargar las métricas.')
        } else {
          setMetrics(metricsJson)
        }

        if (subscribersJson?.ok) {
          const list = subscribersJson.data?.subscribers || subscribersJson.data || subscribersJson.subscribers || []
          setSubscribers(Array.isArray(list) ? list : [])
        }

        if (billingJson?.ok) setBillingOverview(billingJson.data || null)
        if (gatewaysJson?.ok) setGateways(Array.isArray(gatewaysJson.data?.gateways) ? gatewaysJson.data.gateways : [])
        if (paymentsJson?.ok) setPayments(Array.isArray(paymentsJson.data?.payments) ? paymentsJson.data.payments : [])
        if (subscriptionsJson?.ok) setSubscriptions(Array.isArray(subscriptionsJson.data?.subscriptions) ? subscriptionsJson.data.subscriptions : [])
      } catch (err) {
        if (!cancelled) setError('No se pudo conectar con Super Admin.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const metricData = metrics?.data || metrics?.metrics || {}

  function formatMoney(cents?: number, currency = 'DOP') {
    const amount = (cents ?? 0) / 100
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  function statusLabel(status?: string) {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      proof_submitted: 'Comprobante enviado',
      under_review: 'En revisión',
      confirmed: 'Confirmado',
      rejected: 'Rechazado',
      refunded: 'Reembolsado',
      cancelled: 'Cancelado',
      expired: 'Vencido',
      active: 'Activa',
      past_due: 'Pago vencido',
      suspended: 'Suspendida',
      disabled: 'Deshabilitada',
      test: 'Prueba',
      ready: 'Lista',
    }
    return labels[status || ''] || status || '—'
  }

  function formatMetricLabel(key: string) {
    const labels: Record<string, string> = {
      users: 'Usuarios',
      profiles: 'Perfiles',
      leads: 'Leads',
      plans: 'Planes',
    }
    return labels[key] || key.replace(/_/g, ' ')
  }

  function formatMetricValue(key: string, value: any) {
    if (value == null) return '0'
    if (typeof value !== 'object') return String(value)

    if (key === 'users') {
      return `Total: ${value.total ?? 0} · Nuevos 7 días: ${value.new_7d ?? 0}`
    }

    if (key === 'profiles') {
      return `Total: ${value.total ?? 0} · Activos: ${value.active ?? 0} · Inactivos: ${value.inactive ?? 0}`
    }

    if (key === 'leads') {
      return `Total: ${value.total ?? 0} · Nuevos 7 días: ${value.new_7d ?? 0}`
    }

    if (key === 'plans' && Array.isArray(value.by_plan)) {
      return value.by_plan.map((p: any) => `${p.plan_id || 'sin plan'}: ${p.cnt ?? 0}`).join(' · ')
    }

    return Object.entries(value)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ')
  }

  function renderBillingSection() {
    return (
      <div className="rounded-3xl bg-white px-4 py-8 text-slate-900 shadow-sm">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
              INTAP LINK
            </p>
            <h1 className="mt-2 text-3xl font-black">Billing / Pagos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Control de pagos manuales, revisión, suscripciones billing, pasarelas y trazabilidad financiera.
            </p>
          </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Pagos pendientes</p>
            <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.pending ?? 0}</p>
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-yellow-700">En revisión</p>
            <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.under_review ?? 0}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pagos confirmados</p>
            <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.confirmed ?? 0}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Ingresos confirmados</p>
            <p className="mt-3 text-2xl font-black">{formatMoney(billingOverview?.payments?.confirmed_amount_cents, 'DOP')}</p>
          </div>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Pasarelas</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">Configuradas para uso futuro. Todas pueden permanecer deshabilitadas hasta activar cobros.</p>

            <div className="space-y-3">
              {gateways.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                <p className="font-bold">{g.display_name}</p>
                <p className="text-xs text-slate-500">{g.provider} · {g.currency}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                {statusLabel(g.status)}
                  </span>
                </div>
              ))}

              {gateways.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">No hay pasarelas configuradas.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Suscripciones billing</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">Últimas 10 suscripciones registradas.</p>

            <div className="space-y-3">
              {subscriptions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                <p className="font-bold">{s.profile_slug || s.user_email || 'Sin perfil'}</p>
                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {statusLabel(s.status)}
                </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                Plan: {s.plan_id || '—'} · Fuente: {s.source || '—'}
                  </p>
                </div>
              ))}

              {subscriptions.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">Todavía no hay suscripciones billing registradas.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Pagos recientes</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">Últimos 10 pagos registrados. El registro manual se conectará en el siguiente lote.</p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3">Cliente</th>
                  <th className="border-b border-slate-200 px-3 py-3">Perfil</th>
                  <th className="border-b border-slate-200 px-3 py-3">Plan</th>
                  <th className="border-b border-slate-200 px-3 py-3">Monto</th>
                  <th className="border-b border-slate-200 px-3 py-3">Estado</th>
                  <th className="border-b border-slate-200 px-3 py-3">Origen</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="text-slate-700">
                <td className="border-b border-slate-100 px-3 py-3">{p.user_email || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-3">{p.profile_slug || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-3">{p.plan_id || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-3">{formatMoney(p.amount_cents, p.currency || 'DOP')}</td>
                <td className="border-b border-slate-100 px-3 py-3">{statusLabel(p.status)}</td>
                <td className="border-b border-slate-100 px-3 py-3">{p.source || '—'}</td>
                  </tr>
                ))}

                {payments.length === 0 && (
                  <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Todavía no hay pagos registrados.
                </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        </div>
      </div>
    )
  }

  function renderPaymentLinksSection() {
    const mockLinks = [
      {
        id: 'demo-1',
        client: 'Cliente demo',
        concept: 'Activación plan Basic',
        amount: 150000,
        currency: 'DOP',
        status: 'pending',
        reference: 'INTAP-LINK-001',
      },
      {
        id: 'demo-2',
        client: 'Perfil Juan',
        concept: 'Renovación mensual',
        amount: 250000,
        currency: 'DOP',
        status: 'confirmed',
        reference: 'INTAP-LINK-002',
      },
    ]

    return (
      <div className="rounded-3xl bg-white px-4 py-8 text-slate-900 shadow-sm">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
              INTAP LINK
            </p>
            <h1 className="mt-2 text-3xl font-black">Enlaces de pago</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Base operativa para crear cobros compartibles por WhatsApp, registrar pagos manuales,
              recibir comprobantes y conectar futuras pasarelas.
            </p>
          </header>

          <section className="mb-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Total enlaces</p>
              <p className="mt-3 text-2xl font-black text-slate-900">0</p>
              <p className="mt-1 text-xs text-slate-500">Pendiente de backend</p>
            </div>

            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-yellow-700">Pendientes</p>
              <p className="mt-3 text-2xl font-black text-slate-900">0</p>
              <p className="mt-1 text-xs text-slate-500">Cobros sin confirmar</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Pagados</p>
              <p className="mt-3 text-2xl font-black text-slate-900">0</p>
              <p className="mt-1 text-xs text-slate-500">Pagos confirmados</p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-red-700">Vencidos</p>
              <p className="mt-3 text-2xl font-black text-slate-900">0</p>
              <p className="mt-1 text-xs text-slate-500">Enlaces expirados</p>
            </div>
          </section>

          <section className="mb-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="mb-5">
                <h2 className="text-xl font-black text-slate-900">Crear enlace de pago</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Formulario base inspirado en Avanxy. En el próximo lote se conectará a endpoints reales de INTAP LINK.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Cliente / Perfil</span>
                  <input
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    placeholder="Seleccionar perfil"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Tipo de cobro</span>
                  <select
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  >
                    <option>Suscripción</option>
                    <option>Activación de plan</option>
                    <option>Servicio adicional</option>
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Concepto</span>
                  <input
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    placeholder="Ej: Activación plan Basic mensual"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Monto</span>
                  <input
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    placeholder="1500.00"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Moneda</span>
                  <select
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  >
                    <option>DOP</option>
                    <option>USD</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Vence el</span>
                  <input
                    disabled
                    type="date"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Método sugerido</span>
                  <select
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  >
                    <option>Transferencia bancaria</option>
                    <option>Pago manual</option>
                    <option>Pasarela futura</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                disabled
                className="mt-6 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white opacity-60"
              >
                Generar enlace de pago
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="mb-5">
                <h2 className="text-xl font-black text-slate-900">Configuración de cobro</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Información que verá el cliente en el enlace público.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">WhatsApp soporte</span>
                  <input
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    placeholder="8090000000"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Email soporte</span>
                  <input
                    disabled
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    placeholder="soporte@intaprd.com"
                  />
                </label>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-900">Cuentas bancarias</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Aquí se configurarán bancos, titulares, cuentas y notas de referencia para el pago.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Enlaces recientes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Vista base de cobros generados. Se reemplazará por datos reales cuando conectemos backend.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                Módulo en preparación
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-3">Cliente</th>
                    <th className="border-b border-slate-200 px-3 py-3">Concepto</th>
                    <th className="border-b border-slate-200 px-3 py-3">Monto</th>
                    <th className="border-b border-slate-200 px-3 py-3">Estado</th>
                    <th className="border-b border-slate-200 px-3 py-3">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLinks.map((item) => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="border-b border-slate-100 px-3 py-3">{item.client}</td>
                      <td className="border-b border-slate-100 px-3 py-3">{item.concept}</td>
                      <td className="border-b border-slate-100 px-3 py-3">{formatMoney(item.amount, item.currency)}</td>
                      <td className="border-b border-slate-100 px-3 py-3">{statusLabel(item.status)}</td>
                      <td className="border-b border-slate-100 px-3 py-3">{item.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    )
  }

  function renderSectionPlaceholder() {
    const titles: Record<SuperAdminSection, { title: string; description: string }> = {
      dashboard: {
        title: 'Dashboard',
        description: 'Resumen ejecutivo del SaaS.',
      },
      subscribers: {
        title: 'Suscriptores',
        description: 'Gestión de usuarios, perfiles, planes y estado comercial.',
      },
      billing: {
        title: 'Billing / Pagos',
        description: 'Pagos manuales, revisión, confirmación, suscripciones y trazabilidad.',
      },
      paymentLinks: {
        title: 'Enlaces de pago',
        description: 'Creación y seguimiento de enlaces de pago para planes, servicios o activaciones.',
      },
      landing: {
        title: 'Landing marketing',
        description: 'Administración de la landing pública de INTAP LINK: hero, beneficios, planes, CTA y contenido comercial.',
      },
      plans: {
        title: 'Planes y módulos',
        description: 'Control de planes, límites, módulos, trials, overrides y funciones premium.',
      },
      gateways: {
        title: 'Pasarelas',
        description: 'Configuración y estado de PayPal, Azul, CardNet, Stripe e INTAP Payment Link.',
      },
      audit: {
        title: 'Auditoría',
        description: 'Historial de acciones administrativas y cambios sensibles del sistema.',
      },
      admins: {
        title: 'Admins / Roles',
        description: 'Gestión de usuarios administrativos, permisos y roles internos.',
      },
      settings: {
        title: 'Configuración',
        description: 'Ajustes generales del SaaS y parámetros operativos.',
      },
    }

    const current = titles[currentSection]

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
          INTAP LINK
        </p>
        <h1 className="mt-3 text-3xl font-black">{current.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {current.description}
        </p>

        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          Este módulo ya quedó separado visualmente dentro del Super Admin. En el próximo lote se conecta su contenido funcional real sin cargar todo en una sola pantalla.
        </div>
      </div>
    )
  }

  return (
    <SuperAdminLayout
      currentSection={currentSection}
      onNavigate={setCurrentSection}
      onLogout={() => {
        window.location.href = '/admin/login'
      }}
    >
      {currentSection === 'dashboard' ? (
        <div className="rounded-3xl bg-white px-4 py-8 text-slate-900 shadow-sm">
          <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
              INTAP LINK
            </p>
            <h1 className="mt-2 text-3xl font-black">Super Admin</h1>
            <p className="mt-2 text-sm text-slate-600">
              Vista inicial de métricas y suscriptores. Las acciones de cambio de plan, módulos y overrides se conectarán en el siguiente lote.
            </p>
          </div>

          <Link
            to="/admin"
            className="rounded-full border border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-white/10"
          >
            Volver al panel
          </Link>
        </header>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
            Cargando Super Admin...
          </div>
        )}

        {!loading && error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <section className="mb-8 grid gap-4 md:grid-cols-4">
              {Object.entries(metricData).slice(0, 8).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {formatMetricLabel(key)}
                  </p>
                  <p className="mt-3 text-base font-bold leading-relaxed text-slate-900">
                    {formatMetricValue(key, value)}
                  </p>
                </div>
              ))}

              {Object.keys(metricData).length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-4">
                  <p className="text-sm text-slate-600">No se recibieron métricas para mostrar.</p>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Suscriptores</h2>
                  <p className="text-sm text-slate-500">Primeros 25 registros.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-3">Email</th>
                      <th className="border-b border-slate-200 px-3 py-3">Slug</th>
                      <th className="border-b border-slate-200 px-3 py-3">Plan</th>
                      <th className="border-b border-slate-200 px-3 py-3">Activo</th>
                      <th className="border-b border-slate-200 px-3 py-3">Publicado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s, index) => (
                      <tr key={s.user_id || s.id || s.profile_id || index} className="text-slate-700">
                        <td className="border-b border-slate-100 px-3 py-3">{s.email || '—'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.slug || '—'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.plan_id || '—'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.is_active ? 'Sí' : 'No'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.is_published ? 'Sí' : 'No'}</td>
                      </tr>
                    ))}

                    {subscribers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                          No hay suscriptores para mostrar o tu usuario no tiene permiso Super Admin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
          </div>
        </div>
      ) : currentSection === 'billing' ? (
        renderBillingSection()
      ) : currentSection === 'paymentLinks' ? (
        renderPaymentLinksSection()
      ) : (
        renderSectionPlaceholder()
      )}
    </SuperAdminLayout>
  )
}
