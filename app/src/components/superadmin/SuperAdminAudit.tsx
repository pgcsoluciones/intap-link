/**
 * SuperAdminAudit — log de auditoría filtrable.
 * Consume: GET /api/v1/superadmin/audit?page&limit&action&target_type&from&to
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

interface AuditRow {
  id: string
  admin_user_id: string
  admin_email: string | null
  action: string
  target_type: string
  target_id: string | null
  before_json: string | null
  after_json: string | null
  ip: string | null
  created_at: string
}

interface Meta { page: number; limit: number; total: number; pages: number }

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    plan_changed:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
    module_assigned:     'bg-purple-500/20 text-purple-400 border-purple-500/30',
    module_revoked:      'bg-red-500/20 text-red-400 border-red-500/30',
    override_set:        'bg-amber-500/20 text-amber-400 border-amber-500/30',
    profile_activated:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    profile_deactivated: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  const cls = colors[action] ?? 'bg-white/5 text-slate-400 border-white/10'
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {action}
    </span>
  )
}

export default function SuperAdminAudit() {
  const navigate = useNavigate()
  const [rows, setRows]       = useState<AuditRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const [page, setPage]         = useState(1)
  const [actionFilter, setAction] = useState('')
  const [typeFilter, setType]   = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (actionFilter) params.set('action', actionFilter)
    if (typeFilter)   params.set('target_type', typeFilter)
    apiGet(`/superadmin/audit?${params}`)
      .then((res: any) => {
        if (res.ok) { setRows(res.data); setMeta(res.meta) }
        else setError(res.error || 'Error al cargar auditoría')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [page, actionFilter, typeFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-intap-dark" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-10 bg-intap-dark/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-intap-mint font-black text-sm">INTAP</span>
          <span className="text-white/20">|</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Super Admin</span>
        </div>
        <nav className="flex items-center gap-1">
          <button onClick={() => navigate('/superadmin')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Overview</button>
          <button onClick={() => navigate('/superadmin/subscribers')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Suscriptores</button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white">Auditoría</button>
        </nav>
        <button onClick={() => navigate('/admin')} className="text-xs text-slate-500 hover:text-white transition-colors">← Admin</button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-black">Log de Auditoría</h1>
            {meta && <p className="text-xs text-slate-500 mt-1">{meta.total} eventos registrados</p>}
          </div>
          {loading && <div className="w-5 h-5 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin" />}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-5">
          <select
            value={actionFilter}
            onChange={e => { setAction(e.target.value); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="" className="bg-gray-900">Todas las acciones</option>
            <option value="plan_changed" className="bg-gray-900">plan_changed</option>
            <option value="module_assigned" className="bg-gray-900">module_assigned</option>
            <option value="module_revoked" className="bg-gray-900">module_revoked</option>
            <option value="override_set" className="bg-gray-900">override_set</option>
            <option value="profile_activated" className="bg-gray-900">profile_activated</option>
            <option value="profile_deactivated" className="bg-gray-900">profile_deactivated</option>
          </select>
          <select
            value={typeFilter}
            onChange={e => { setType(e.target.value); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="" className="bg-gray-900">Todos los tipos</option>
            <option value="profile" className="bg-gray-900">profile</option>
            <option value="module" className="bg-gray-900">module</option>
            <option value="user" className="bg-gray-900">user</option>
          </select>
          {(actionFilter || typeFilter) && (
            <button onClick={() => { setAction(''); setType(''); setPage(1) }} className="px-3 py-2 text-xs text-slate-400 hover:text-white">Limpiar</button>
          )}
        </div>

        {error && (
          <div className="glass-card p-4 border-red-500/20 text-center mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="glass-card p-10 text-center">
            <p className="text-slate-400 text-sm">Sin registros de auditoría.</p>
          </div>
        )}

        <div className="flex flex-col gap-2 mb-6">
          {rows.map(row => (
            <div key={row.id} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpanded(prev => prev === row.id ? null : row.id)}
                className="w-full p-4 text-left flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <ActionBadge action={row.action} />
                    <span className="text-xs text-slate-400">{row.admin_email || row.admin_user_id.slice(0, 12) + '…'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    {row.target_type && <span>tipo: {row.target_type}</span>}
                    {row.target_id   && <span>id: {row.target_id.slice(0, 12)}…</span>}
                    {row.ip          && <span>ip: {row.ip}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-slate-500">{formatDate(row.created_at)}</p>
                  <span className="text-slate-500 text-sm">{expanded === row.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === row.id && (row.before_json || row.after_json) && (
                <div className="border-t border-white/10 p-4 bg-white/2">
                  <div className="grid grid-cols-2 gap-3">
                    {row.before_json && (
                      <div>
                        <p className="text-[11px] text-slate-500 font-bold mb-1">ANTES</p>
                        <pre className="text-[11px] text-slate-300 bg-white/5 rounded-xl p-3 overflow-x-auto">
                          {JSON.stringify(JSON.parse(row.before_json), null, 2)}
                        </pre>
                      </div>
                    )}
                    {row.after_json && (
                      <div>
                        <p className="text-[11px] text-slate-500 font-bold mb-1">DESPUÉS</p>
                        <pre className="text-[11px] text-slate-300 bg-white/5 rounded-xl p-3 overflow-x-auto">
                          {JSON.stringify(JSON.parse(row.after_json), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold disabled:opacity-30 hover:bg-white/10 transition-colors">← Anterior</button>
            <span className="text-xs text-slate-500">Pág {meta.page} de {meta.pages}</span>
            <button onClick={() => setPage(p => Math.min(meta.pages, p + 1))} disabled={page === meta.pages}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold disabled:opacity-30 hover:bg-white/10 transition-colors">Siguiente →</button>
          </div>
        )}
      </main>
    </div>
  )
}
