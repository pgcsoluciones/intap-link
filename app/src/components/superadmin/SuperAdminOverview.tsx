/**
 * SuperAdminOverview — dashboard de métricas del SaaS.
 * Consume: GET /api/v1/superadmin/metrics/overview
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Metrics {
  users:    { total: number; new_7d: number; new_30d: number }
  profiles: { total: number; active: number; inactive: number; by_plan: Array<{ plan_id: string; cnt: number }> }
  leads:    { total: number; new_7d: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:    { label: 'Free',    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  starter: { label: 'Starter', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  pro:     { label: 'Pro',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  agency:  { label: 'Agency',  color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

function PlanBadge({ planId }: { planId: string }) {
  const meta = PLAN_LABELS[planId] ?? { label: planId, color: 'bg-white/5 text-slate-400 border-white/10' }
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function MetricCard({ label, value, sub, accent = false }: {
  label: string; value: number | string; sub?: string; accent?: boolean
}) {
  return (
    <div className={`glass-card p-5 ${accent ? 'border-intap-mint/20' : ''}`}>
      <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-black ${accent ? 'text-intap-mint' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SuperAdminOverview() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    apiGet('/superadmin/metrics/overview')
      .then((res: any) => {
        if (res.ok) setMetrics(res.data)
        else setError(res.error || 'Error al cargar métricas')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-intap-dark" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Nav */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-10 bg-intap-dark/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-intap-mint font-black text-sm">INTAP</span>
          <span className="text-white/20">|</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Super Admin</span>
        </div>
        <nav className="flex items-center gap-1">
          <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white">Overview</button>
          <button onClick={() => navigate('/superadmin/subscribers')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Suscriptores</button>
          <button onClick={() => navigate('/superadmin/audit')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Auditoría</button>
        </nav>
        <button onClick={() => navigate('/admin')} className="text-xs text-slate-500 hover:text-white transition-colors">
          ← Admin
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-black">Overview</h1>
          <p className="text-xs text-slate-500 mt-1">Métricas generales del SaaS</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="glass-card p-4 border-red-500/20 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-xs text-slate-400 underline">
              Reintentar
            </button>
          </div>
        )}

        {metrics && (
          <>
            {/* Usuarios */}
            <section className="mb-8">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Usuarios</p>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Total" value={metrics.users.total} accent />
                <MetricCard label="Nuevos 7d"  value={metrics.users.new_7d}  sub="últimos 7 días" />
                <MetricCard label="Nuevos 30d" value={metrics.users.new_30d} sub="últimos 30 días" />
              </div>
            </section>

            {/* Perfiles */}
            <section className="mb-8">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Perfiles</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <MetricCard label="Total"    value={metrics.profiles.total}    accent />
                <MetricCard label="Activos"  value={metrics.profiles.active}   sub={`${metrics.profiles.total > 0 ? Math.round(metrics.profiles.active / metrics.profiles.total * 100) : 0}%`} />
                <MetricCard label="Inactivos" value={metrics.profiles.inactive} />
              </div>

              {/* Por plan */}
              {metrics.profiles.by_plan.length > 0 && (
                <div className="glass-card p-5">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-4">Distribución por plan</p>
                  <div className="flex flex-col gap-3">
                    {metrics.profiles.by_plan
                      .sort((a, b) => b.cnt - a.cnt)
                      .map(row => {
                        const pct = metrics.profiles.total > 0
                          ? Math.round(row.cnt / metrics.profiles.total * 100)
                          : 0
                        return (
                          <div key={row.plan_id} className="flex items-center gap-3">
                            <div className="w-20 shrink-0">
                              <PlanBadge planId={row.plan_id} />
                            </div>
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-intap-mint/60 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-white w-8 text-right">{row.cnt}</span>
                            <span className="text-xs text-slate-500 w-8">{pct}%</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </section>

            {/* Leads */}
            <section className="mb-8">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Leads / Contactos</p>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Total leads" value={metrics.leads.total} accent />
                <MetricCard label="Nuevos 7d"   value={metrics.leads.new_7d} sub="últimos 7 días" />
              </div>
            </section>

            {/* Quick actions */}
            <section>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Acceso rápido</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate('/superadmin/subscribers')}
                  className="glass-card p-4 text-left hover:border-intap-mint/20 transition-colors"
                >
                  <p className="text-sm font-bold mb-1">Ver suscriptores</p>
                  <p className="text-xs text-slate-400">Listado completo con filtros</p>
                </button>
                <button
                  onClick={() => navigate('/superadmin/audit')}
                  className="glass-card p-4 text-left hover:border-intap-mint/20 transition-colors"
                >
                  <p className="text-sm font-bold mb-1">Log de auditoría</p>
                  <p className="text-xs text-slate-400">Historial de acciones admin</p>
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
