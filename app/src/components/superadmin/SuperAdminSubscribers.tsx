/**
 * SuperAdminSubscribers — listado paginado de suscriptores.
 * Consume: GET /api/v1/superadmin/subscribers?page&limit&plan&status&q
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Subscriber {
  user_id: string
  email: string
  user_created_at: string | null
  profile_id: string | null
  slug: string | null
  profile_name: string | null
  plan_id: string | null
  is_active: number
  is_published: number
  trial_ends_at: string | null
  admin_notes: string | null
  links_count: number
  active_modules: number
}

interface Meta {
  page: number
  limit: number
  total: number
  pages: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, { label: string; cls: string }> = {
  free:    { label: 'Free',    cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  starter: { label: 'Starter', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  pro:     { label: 'Pro',     cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  agency:  { label: 'Agency',  cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

function PlanBadge({ planId }: { planId: string | null }) {
  if (!planId) return <span className="text-xs text-slate-500">—</span>
  const m = PLAN_LABELS[planId] ?? { label: planId, cls: 'bg-white/5 text-slate-400 border-white/10' }
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase ${m.cls}`}>
      {m.label}
    </span>
  )
}

function StatusDot({ active }: { active: number }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${active ? 'text-emerald-400' : 'text-red-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SuperAdminSubscribers() {
  const navigate = useNavigate()

  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Filtros
  const [q, setQ]             = useState('')
  const [planFilter, setPlan] = useState('')
  const [statusFilter, setStatus] = useState('')
  const [page, setPage]       = useState(1)
  const [inputQ, setInputQ]   = useState('')  // input buffer

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (q)            params.set('q', q)
    if (planFilter)   params.set('plan', planFilter)
    if (statusFilter) params.set('status', statusFilter)
    apiGet(`/superadmin/subscribers?${params}`)
      .then((res: any) => {
        if (res.ok) {
          setSubscribers(res.data)
          setMeta(res.meta)
        } else {
          setError(res.error || 'Error al cargar suscriptores')
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [page, q, planFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const applySearch = () => {
    setPage(1)
    setQ(inputQ)
  }

  const clearFilters = () => {
    setQ('')
    setInputQ('')
    setPlan('')
    setStatus('')
    setPage(1)
  }

  const hasFilters = q || planFilter || statusFilter

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
          <button onClick={() => navigate('/superadmin')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Overview</button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white">Suscriptores</button>
          <button onClick={() => navigate('/superadmin/audit')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Auditoría</button>
        </nav>
        <button onClick={() => navigate('/admin')} className="text-xs text-slate-500 hover:text-white transition-colors">
          ← Admin
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header + filters */}
        <div className="mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-black">Suscriptores</h1>
              {meta && (
                <p className="text-xs text-slate-500 mt-1">
                  {meta.total} {meta.total === 1 ? 'usuario' : 'usuarios'} en total
                </p>
              )}
            </div>
            {loading && (
              <div className="w-5 h-5 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin mt-1" />
            )}
          </div>

          {/* Search + filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-1 min-w-48 gap-2">
              <input
                type="text"
                value={inputQ}
                onChange={e => setInputQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applySearch()}
                placeholder="Buscar por email, slug o nombre…"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/40"
              />
              <button
                onClick={applySearch}
                className="px-4 py-2 bg-intap-mint/20 border border-intap-mint/30 text-intap-mint text-xs font-bold rounded-xl hover:bg-intap-mint/30 transition-colors"
              >
                Buscar
              </button>
            </div>
            <select
              value={planFilter}
              onChange={e => { setPlan(e.target.value); setPage(1) }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
            >
              <option value="">Todos los planes</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="agency">Agency</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => { setStatus(e.target.value); setPage(1) }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 border-red-500/20 text-center mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Tabla */}
        {!loading && !error && subscribers.length === 0 && (
          <div className="glass-card p-10 text-center">
            <p className="text-slate-400 text-sm">
              {hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay suscriptores aún.'}
            </p>
          </div>
        )}

        {subscribers.length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            {subscribers.map(sub => (
              <button
                key={sub.user_id}
                onClick={() => navigate(`/superadmin/subscribers/${sub.user_id}`)}
                className="glass-card p-4 text-left hover:border-white/20 transition-all group w-full"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white truncate">
                        {sub.email || sub.user_id}
                      </p>
                      <StatusDot active={sub.is_active} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {sub.slug && (
                        <span className="text-xs text-slate-400">/{sub.slug}</span>
                      )}
                      {sub.profile_name && sub.profile_name !== sub.email && (
                        <span className="text-xs text-slate-500 truncate max-w-32">{sub.profile_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Badges + meta */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <PlanBadge planId={sub.plan_id} />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">{sub.links_count} links</span>
                      {sub.active_modules > 0 && (
                        <span className="text-[11px] text-purple-400">{sub.active_modules} módulos</span>
                      )}
                    </div>
                    {sub.trial_ends_at && (
                      <span className="text-[11px] text-amber-400">
                        Trial: {formatDate(sub.trial_ends_at)}
                      </span>
                    )}
                  </div>

                  <span className="text-slate-500 group-hover:text-slate-300 transition-colors text-lg leading-none shrink-0 mt-0.5">›</span>
                </div>

                {/* IDs en segunda línea */}
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-slate-600 font-mono">uid: {sub.user_id.slice(0, 12)}…</span>
                  {sub.profile_id && (
                    <span className="text-[10px] text-slate-600 font-mono">pid: {sub.profile_id.slice(0, 12)}…</span>
                  )}
                  {sub.user_created_at && (
                    <span className="text-[10px] text-slate-600 ml-auto">Registrado: {formatDate(sub.user_created_at)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Paginación */}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold disabled:opacity-30 hover:bg-white/10 transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-slate-500">
              Página {meta.page} de {meta.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
              disabled={page === meta.pages}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold disabled:opacity-30 hover:bg-white/10 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
