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

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [metricsJson, subscribersJson]: any[] = await Promise.all([
          apiGet('/superadmin/metrics/overview'),
          apiGet('/superadmin/subscribers?limit=25'),
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
