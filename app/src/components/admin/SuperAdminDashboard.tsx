import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../lib/api'

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

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
              INTAP LINK
            </p>
            <h1 className="mt-2 text-3xl font-black">Super Admin</h1>
            <p className="mt-2 text-sm text-slate-400">
              Vista inicial de métricas y suscriptores. Las acciones de cambio de plan, módulos y overrides se conectarán en el siguiente lote.
            </p>
          </div>

          <Link
            to="/admin"
            className="rounded-full border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-300 hover:bg-white/10"
          >
            Volver al panel
          </Link>
        </header>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">
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
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {formatMetricLabel(key)}
                  </p>
                  <p className="mt-3 text-base font-bold leading-relaxed text-white">
                    {formatMetricValue(key, value)}
                  </p>
                </div>
              ))}

              {Object.keys(metricData).length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:col-span-4">
                  <p className="text-sm text-slate-400">No se recibieron métricas para mostrar.</p>
                </div>
              )}
            </section>

            <section className="mb-8 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">Pagos pendientes</p>
                <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.pending ?? 0}</p>
              </div>

              <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] p-5">
                <p className="text-[10px] font-black uppercase tracking-wide text-yellow-200">En revisión</p>
                <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.under_review ?? 0}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pagos confirmados</p>
                <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.confirmed ?? 0}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Ingresos confirmados</p>
                <p className="mt-3 text-2xl font-black">{formatMoney(billingOverview?.payments?.confirmed_amount_cents, 'DOP')}</p>
              </div>
            </section>

            <section className="mb-8 grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-xl font-black">Pasarelas</h2>
                <p className="mb-5 mt-1 text-sm text-slate-500">Configuradas para uso futuro. Todas pueden permanecer deshabilitadas hasta activar cobros.</p>

                <div className="space-y-3">
                  {gateways.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div>
                        <p className="font-bold">{g.display_name}</p>
                        <p className="text-xs text-slate-500">{g.provider} · {g.currency}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                        {statusLabel(g.status)}
                      </span>
                    </div>
                  ))}

                  {gateways.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-500">No hay pasarelas configuradas.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-xl font-black">Suscripciones billing</h2>
                <p className="mb-5 mt-1 text-sm text-slate-500">Últimas 10 suscripciones registradas.</p>

                <div className="space-y-3">
                  {subscriptions.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-bold">{s.profile_slug || s.user_email || 'Sin perfil'}</p>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">
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

            <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-xl font-black">Pagos recientes</h2>
              <p className="mb-5 mt-1 text-sm text-slate-500">Últimos 10 pagos registrados. El registro manual se conectará en el siguiente lote.</p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-white/10 px-3 py-3">Cliente</th>
                      <th className="border-b border-white/10 px-3 py-3">Perfil</th>
                      <th className="border-b border-white/10 px-3 py-3">Plan</th>
                      <th className="border-b border-white/10 px-3 py-3">Monto</th>
                      <th className="border-b border-white/10 px-3 py-3">Estado</th>
                      <th className="border-b border-white/10 px-3 py-3">Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="text-slate-300">
                        <td className="border-b border-white/5 px-3 py-3">{p.user_email || '—'}</td>
                        <td className="border-b border-white/5 px-3 py-3">{p.profile_slug || '—'}</td>
                        <td className="border-b border-white/5 px-3 py-3">{p.plan_id || '—'}</td>
                        <td className="border-b border-white/5 px-3 py-3">{formatMoney(p.amount_cents, p.currency || 'DOP')}</td>
                        <td className="border-b border-white/5 px-3 py-3">{statusLabel(p.status)}</td>
                        <td className="border-b border-white/5 px-3 py-3">{p.source || '—'}</td>
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

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
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
                      <th className="border-b border-white/10 px-3 py-3">Email</th>
                      <th className="border-b border-white/10 px-3 py-3">Slug</th>
                      <th className="border-b border-white/10 px-3 py-3">Plan</th>
                      <th className="border-b border-white/10 px-3 py-3">Activo</th>
                      <th className="border-b border-white/10 px-3 py-3">Publicado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s, index) => (
                      <tr key={s.user_id || s.id || s.profile_id || index} className="text-slate-300">
                        <td className="border-b border-white/5 px-3 py-3">{s.email || '—'}</td>
                        <td className="border-b border-white/5 px-3 py-3">{s.slug || '—'}</td>
                        <td className="border-b border-white/5 px-3 py-3">{s.plan_id || '—'}</td>
                        <td className="border-b border-white/5 px-3 py-3">{s.is_active ? 'Sí' : 'No'}</td>
                        <td className="border-b border-white/5 px-3 py-3">{s.is_published ? 'Sí' : 'No'}</td>
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
  )
}
