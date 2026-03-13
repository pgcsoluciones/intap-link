/**
 * SuperAdminSubscriberDetail — detalle completo de un suscriptor.
 *
 * Consume:
 *   GET  /superadmin/subscribers/:userId        → carga inicial
 *   POST /superadmin/profiles/:id/change-plan   → cambio de plan
 *   POST /superadmin/profiles/:id/modules       → asignar módulo
 *   DELETE /superadmin/profiles/:id/modules/:mc → revocar módulo
 *   POST /superadmin/profiles/:id/override      → crear/editar override
 *   PATCH /superadmin/profiles/:id/status       → activar / desactivar
 *
 * Regla: después de cada mutación, se recarga el detail completo.
 * Los datos del schema se leen del response — no se asumen columnas extra.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api'

// ─── Tipos — derivados estrictamente del payload de producción ────────────────

interface UserInfo {
  id: string
  email: string
  created_at: string | null
}

interface ProfileInfo {
  id: string
  slug: string | null
  name: string | null
  plan_id: string | null
  is_active: number
  is_published: number
  trial_ends_at: string | null
  admin_notes: string | null
  // Límites efectivos (JOIN con plan_limits)
  max_links: number | null
  max_photos: number | null
  max_faqs: number | null
  max_products: number | null
  max_videos: number | null
  can_use_vcard: number | null
}

interface ActiveModule {
  module_code: string
  module_name: string
  expires_at: string | null
  activated_at: string
  assigned_by: string | null
  assignment_reason: string | null
}

interface PlanOverride {
  max_links: number | null
  max_photos: number | null
  max_faqs: number | null
  max_products: number | null
  max_videos: number | null
  can_use_vcard: number | null
  trial_plan_id: string | null
  trial_ends_at: string | null
  override_reason: string | null
  overridden_by: string | null
}

interface AuditEntry {
  action: string
  target_type: string
  target_id: string | null
  before_json: string | null
  after_json: string | null
  created_at: string
}

interface SubscriberDetail {
  user: UserInfo
  profile: ProfileInfo
  plan_overrides: PlanOverride | null
  active_modules: ActiveModule[]
  stats: { links_count: number; leads_count: number }
  recent_audit: AuditEntry[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLANS = [
  { id: 'free',    label: 'Free' },
  { id: 'starter', label: 'Starter' },
  { id: 'pro',     label: 'Pro' },
  { id: 'agency',  label: 'Agency' },
]

const MODULE_OPTIONS = [
  { code: 'extra_links',  label: 'Extra Links (+5 links)' },
  { code: 'extra_photos', label: 'Extra Photos (+5 fotos)' },
  { code: 'extra_faqs',   label: 'Extra FAQs (+5 preguntas)' },
  { code: 'vcard_unlock', label: 'VCard Unlock' },
  { code: 'power_pack',   label: 'Power Pack (todo)' },
]

const PLAN_COLORS: Record<string, string> = {
  free:    'bg-slate-500/20 text-slate-400 border-slate-500/30',
  starter: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pro:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  agency:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

function PlanBadge({ planId }: { planId: string | null }) {
  if (!planId) return <span className="text-xs text-slate-500">sin plan</span>
  const cls = PLAN_COLORS[planId] ?? 'bg-white/5 text-slate-400 border-white/10'
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${cls}`}>
      {planId}
    </span>
  )
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-2 ${
      type === 'success'
        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
        : 'bg-red-500/20 border border-red-500/40 text-red-300'
    }`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">×</button>
    </div>
  )
}

// ─── Sección: Cambiar plan ────────────────────────────────────────────────────

function ChangePlanSection({ profileId, currentPlan, onDone }: {
  profileId: string; currentPlan: string | null; onDone: (msg: string) => void
}) {
  const [planId, setPlanId]   = useState(currentPlan ?? 'free')
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const submit = async () => {
    if (planId === currentPlan) { setError('El plan seleccionado es igual al actual.'); return }
    setLoading(true); setError('')
    const res: any = await apiPost(`/superadmin/profiles/${profileId}/change-plan`, { planId, reason: reason || undefined })
      .catch(() => ({ ok: false, error: 'Error de conexión' }))
    setLoading(false)
    if (res.ok) {
      setReason('')
      onDone(res.message || 'Plan actualizado')
    } else {
      setError(res.error || 'Error al cambiar plan')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <select
          value={planId}
          onChange={e => setPlanId(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-intap-mint/40"
        >
          {PLANS.map(p => (
            <option key={p.id} value={p.id} className="bg-gray-900">
              {p.label}{p.id === currentPlan ? ' (actual)' : ''}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo del cambio (opcional)"
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/40"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={loading || planId === currentPlan}
        className="w-full py-2.5 rounded-xl bg-intap-blue/20 border border-intap-blue/30 text-intap-blue text-sm font-bold hover:bg-intap-blue/30 disabled:opacity-40 transition-colors"
      >
        {loading ? 'Cambiando…' : 'Confirmar cambio de plan'}
      </button>
    </div>
  )
}

// ─── Sección: Asignar módulo ──────────────────────────────────────────────────

function AssignModuleSection({ profileId, activeModules, onDone }: {
  profileId: string; activeModules: ActiveModule[]; onDone: (msg: string) => void
}) {
  const activeCodes = new Set(activeModules.map(m => m.module_code))
  const [moduleCode, setModuleCode] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [reason, setReason]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const finalCode = moduleCode === '__custom' ? customCode.trim() : moduleCode

  const submit = async () => {
    if (!finalCode) { setError('Selecciona o ingresa un código de módulo.'); return }
    setLoading(true); setError('')
    const res: any = await apiPost(`/superadmin/profiles/${profileId}/modules`, {
      moduleCode: finalCode,
      reason: reason || undefined,
    }).catch(() => ({ ok: false, error: 'Error de conexión' }))
    setLoading(false)
    if (res.ok) {
      setModuleCode(''); setCustomCode(''); setReason('')
      onDone(res.message || 'Módulo asignado')
    } else {
      setError(res.error || 'Error al asignar módulo')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={moduleCode}
        onChange={e => setModuleCode(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-intap-mint/40"
      >
        <option value="" className="bg-gray-900">— Seleccionar módulo —</option>
        {MODULE_OPTIONS.map(m => (
          <option key={m.code} value={m.code} disabled={activeCodes.has(m.code)} className="bg-gray-900">
            {m.label}{activeCodes.has(m.code) ? ' ✓ ya asignado' : ''}
          </option>
        ))}
        <option value="__custom" className="bg-gray-900">Código manual…</option>
      </select>
      {moduleCode === '__custom' && (
        <input
          type="text"
          value={customCode}
          onChange={e => setCustomCode(e.target.value)}
          placeholder="Código del módulo (ej: extra_links)"
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/40"
        />
      )}
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo de la asignación (opcional)"
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/40"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={loading || !finalCode}
        className="w-full py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-bold hover:bg-purple-500/30 disabled:opacity-40 transition-colors"
      >
        {loading ? 'Asignando…' : 'Asignar módulo'}
      </button>
    </div>
  )
}

// ─── Sección: Override de límites ─────────────────────────────────────────────

function OverrideSection({ profileId, current, onDone }: {
  profileId: string; current: PlanOverride | null; onDone: (msg: string) => void
}) {
  const [maxLinks,    setMaxLinks]    = useState(current?.max_links?.toString()    ?? '')
  const [maxPhotos,   setMaxPhotos]   = useState(current?.max_photos?.toString()   ?? '')
  const [maxFaqs,     setMaxFaqs]     = useState(current?.max_faqs?.toString()     ?? '')
  const [maxProducts, setMaxProducts] = useState(current?.max_products?.toString() ?? '')
  const [maxVideos,   setMaxVideos]   = useState(current?.max_videos?.toString()   ?? '')
  const [canVcard,    setCanVcard]    = useState<string>(
    current?.can_use_vcard == null ? '' : current.can_use_vcard ? '1' : '0'
  )
  const [trialPlan,   setTrialPlan]   = useState(current?.trial_plan_id ?? '')
  const [trialEnds,   setTrialEnds]   = useState(
    current?.trial_ends_at ? current.trial_ends_at.replace(' ', 'T').slice(0, 16) : ''
  )
  const [reason,      setReason]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const numOrNull = (v: string) => v.trim() === '' ? null : parseInt(v, 10)
  const boolOrNull = (v: string) => v === '' ? null : v === '1' ? 1 : 0

  const submit = async () => {
    const body: Record<string, unknown> = {}
    if (maxLinks.trim()    !== '') body.max_links    = numOrNull(maxLinks)
    if (maxPhotos.trim()   !== '') body.max_photos   = numOrNull(maxPhotos)
    if (maxFaqs.trim()     !== '') body.max_faqs     = numOrNull(maxFaqs)
    if (maxProducts.trim() !== '') body.max_products = numOrNull(maxProducts)
    if (maxVideos.trim()   !== '') body.max_videos   = numOrNull(maxVideos)
    if (canVcard !== '') body.can_use_vcard = boolOrNull(canVcard)
    if (trialPlan.trim()) body.trial_plan_id = trialPlan.trim()
    if (trialEnds.trim()) body.trial_ends_at = trialEnds.trim().replace('T', ' ')
    if (reason.trim())    body.reason = reason.trim()

    if (Object.keys(body).filter(k => k !== 'reason').length === 0) {
      setError('Completa al menos un campo de override.')
      return
    }
    setLoading(true); setError('')
    const res: any = await apiPost(`/superadmin/profiles/${profileId}/override`, body)
      .catch(() => ({ ok: false, error: 'Error de conexión' }))
    setLoading(false)
    if (res.ok) {
      setReason('')
      onDone(res.message || 'Override guardado')
    } else {
      setError(res.error || 'Error al guardar override')
    }
  }

  const numInput = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-slate-500 font-bold uppercase">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => set(e.target.value)}
        placeholder={placeholder}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-intap-mint/40 w-full"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {current && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <p className="text-xs text-amber-300 font-bold mb-1">Override activo</p>
          <p className="text-[11px] text-slate-400">
            {current.override_reason || 'Sin motivo registrado'} · Aplicado por {current.overridden_by || 'sistema'}
          </p>
        </div>
      )}

      {/* Límites */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numInput('Max Links',    maxLinks,    setMaxLinks,    'ej: 20')}
        {numInput('Max Photos',   maxPhotos,   setMaxPhotos,   'ej: 10')}
        {numInput('Max FAQs',     maxFaqs,     setMaxFaqs,     'ej: 15')}
        {numInput('Max Products', maxProducts, setMaxProducts, 'ej: 10')}
        {numInput('Max Videos',   maxVideos,   setMaxVideos,   'ej: 5')}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-bold uppercase">VCard</label>
          <select
            value={canVcard}
            onChange={e => setCanVcard(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-intap-mint/40"
          >
            <option value="" className="bg-gray-900">Sin cambio</option>
            <option value="1" className="bg-gray-900">Habilitado</option>
            <option value="0" className="bg-gray-900">Deshabilitado</option>
          </select>
        </div>
      </div>

      {/* Trial override */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-xs text-slate-500 font-bold uppercase mb-3">Override de trial (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500 font-bold uppercase">Plan de trial</label>
            <select
              value={trialPlan}
              onChange={e => setTrialPlan(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="" className="bg-gray-900">Sin cambio</option>
              {PLANS.map(p => <option key={p.id} value={p.id} className="bg-gray-900">{p.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500 font-bold uppercase">Trial vence</label>
            <input
              type="datetime-local"
              value={trialEnds}
              onChange={e => setTrialEnds(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-intap-mint/40"
            />
          </div>
        </div>
      </div>

      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo del override"
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/40"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-bold hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
      >
        {loading ? 'Guardando…' : current ? 'Actualizar override' : 'Crear override'}
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SuperAdminSubscriberDetail() {
  const navigate      = useNavigate()
  const { userId }    = useParams<{ userId: string }>()

  const [detail, setDetail]   = useState<SubscriberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Módulos
  const [revokingCode, setRevokingCode]     = useState<string | null>(null)
  const [revokeReason, setRevokeReason]     = useState('')
  const [revokeTarget, setRevokeTarget]     = useState<string | null>(null)
  const [revokingLoading, setRevokingLoading] = useState(false)

  // Status
  const [statusLoading, setStatusLoading]   = useState(false)

  // UI toggles para las secciones colapsables
  const [openSection, setOpenSection] = useState<string | null>(null)
  const toggleSection = (s: string) => setOpenSection(prev => prev === s ? null : s)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const load = useCallback(() => {
    if (!userId) return
    setLoading(true); setError('')
    apiGet(`/superadmin/subscribers/${userId}`)
      .then((res: any) => {
        if (res.ok) setDetail(res.data)
        else setError(res.error || 'No encontrado')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => { load() }, [load])

  const handleMutationSuccess = (msg: string) => {
    showToast(msg, 'success')
    setOpenSection(null)
    load()
  }

  // Revocar módulo
  const startRevoke = (code: string) => {
    setRevokeTarget(code)
    setRevokeReason('')
  }
  const confirmRevoke = async () => {
    if (!revokeTarget || !detail) return
    const profileId = detail.profile.id
    setRevokingCode(revokeTarget); setRevokingLoading(true)
    const path = revokeReason.trim()
      ? `/superadmin/profiles/${profileId}/modules/${revokeTarget}?reason=${encodeURIComponent(revokeReason)}`
      : `/superadmin/profiles/${profileId}/modules/${revokeTarget}`
    const res: any = await apiDelete(path).catch(() => ({ ok: false, error: 'Error de conexión' }))
    setRevokingLoading(false); setRevokingCode(null); setRevokeTarget(null)
    if (res.ok) {
      showToast(res.message || 'Módulo revocado', 'success')
      load()
    } else {
      showToast(res.error || 'Error al revocar módulo', 'error')
    }
  }

  // Toggle status
  const toggleStatus = async () => {
    if (!detail) return
    const profileId  = detail.profile.id
    const newActive  = detail.profile.is_active ? 0 : 1
    const reason     = newActive === 0
      ? window.prompt('Motivo de desactivación (opcional):') ?? ''
      : ''
    setStatusLoading(true)
    const res: any = await apiPatch(`/superadmin/profiles/${profileId}/status`, {
      is_active: Boolean(newActive),
      reason: reason || undefined,
    }).catch(() => ({ ok: false, error: 'Error de conexión' }))
    setStatusLoading(false)
    if (res.ok) {
      showToast(res.message || 'Estado actualizado', 'success')
      load()
    } else {
      showToast(res.error || 'Error al cambiar estado', 'error')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && !detail) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-sm w-full">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button onClick={() => navigate('/superadmin/subscribers')} className="text-xs text-slate-400 underline">
            Volver al listado
          </button>
        </div>
      </div>
    )
  }

  if (!detail) return null

  const { user, profile, plan_overrides, active_modules, stats, recent_audit } = detail
  const isActive = Boolean(profile.is_active)

  return (
    <div className="min-h-screen bg-intap-dark" style={{ fontFamily: 'Inter, sans-serif' }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Revoke confirmation modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 max-w-sm w-full">
            <p className="text-sm font-bold mb-1">Revocar módulo</p>
            <p className="text-xs text-slate-400 mb-4">
              ¿Seguro que quieres revocar <strong className="text-white">{revokeTarget}</strong> de este perfil?
            </p>
            <input
              type="text"
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="w-full mb-4 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmRevoke}
                disabled={revokingLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-bold hover:bg-red-500/30 disabled:opacity-40 transition-colors"
              >
                {revokingLoading ? 'Revocando…' : 'Confirmar revocación'}
              </button>
              <button
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-10 bg-intap-dark/80 backdrop-blur-xl">
        <button
          onClick={() => navigate('/superadmin/subscribers')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span className="text-lg leading-none">‹</span>
          <span>Suscriptores</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-intap-mint font-black text-sm">INTAP</span>
          <span className="text-white/20">|</span>
          <span className="text-xs font-bold text-slate-400">Super Admin</span>
        </div>
        <button onClick={() => navigate('/admin')} className="text-xs text-slate-500 hover:text-white transition-colors">
          ← Admin
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* ── Cabecera del suscriptor ── */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-base font-black">{user.email || user.id}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">uid: {user.id}</p>
              {user.created_at && (
                <p className="text-xs text-slate-500 mt-0.5">Registrado: {formatDate(user.created_at)}</p>
              )}
            </div>
            <div className="text-right">
              <PlanBadge planId={profile.plan_id} />
              <div className="mt-1.5">
                <span className={`text-xs font-bold ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isActive ? '● Activo' : '● Inactivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Datos del perfil */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 rounded-xl p-2.5">
              <p className="text-slate-500 mb-0.5">Slug</p>
              <p className="text-white font-mono">/{profile.slug || '—'}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5">
              <p className="text-slate-500 mb-0.5">Profile ID</p>
              <p className="text-white font-mono text-[11px] truncate">{profile.id}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5">
              <p className="text-slate-500 mb-0.5">Publicado</p>
              <p className={profile.is_published ? 'text-emerald-400' : 'text-slate-400'}>
                {profile.is_published ? 'Sí' : 'No'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5">
              <p className="text-slate-500 mb-0.5">Trial vence</p>
              <p className="text-white">{formatDate(profile.trial_ends_at)}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 mt-3 pt-3 border-t border-white/10">
            <div className="text-center flex-1">
              <p className="text-lg font-black text-white">{stats.links_count}</p>
              <p className="text-[11px] text-slate-500">Links</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-black text-white">{stats.leads_count}</p>
              <p className="text-[11px] text-slate-500">Leads</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-black text-white">{active_modules.length}</p>
              <p className="text-[11px] text-slate-500">Módulos</p>
            </div>
          </div>
        </div>

        {/* ── Límites efectivos del plan ── */}
        {(profile.max_links != null || profile.max_photos != null) && (
          <div className="glass-card p-5 mb-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-3">Límites efectivos (plan + overrides)</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['Links',    profile.max_links],
                ['Fotos',    profile.max_photos],
                ['FAQs',     profile.max_faqs],
                ['Productos',profile.max_products],
                ['Videos',   profile.max_videos],
                ['VCard',    profile.can_use_vcard != null ? (profile.can_use_vcard ? 'Sí' : 'No') : null],
              ] as [string, number | string | null][]).map(([label, val]) => (
                <div key={label} className="bg-white/5 rounded-xl p-2.5 text-center">
                  <p className="text-base font-black text-white">{val ?? '—'}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Módulos activos ── */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Módulos activos</p>
            <button
              onClick={() => toggleSection('assign_module')}
              className="text-xs text-purple-300 hover:text-purple-200 font-bold transition-colors"
            >
              {openSection === 'assign_module' ? '−' : '+'} Asignar
            </button>
          </div>

          {active_modules.length === 0 ? (
            <p className="text-xs text-slate-500">Sin módulos activos.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {active_modules.map(mod => (
                <div key={mod.module_code} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm font-bold">{mod.module_name || mod.module_code}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500">Activado: {formatDate(mod.activated_at)}</span>
                      {mod.expires_at && (
                        <span className="text-[11px] text-amber-400">Vence: {formatDate(mod.expires_at)}</span>
                      )}
                    </div>
                    {mod.assignment_reason && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{mod.assignment_reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => startRevoke(mod.module_code)}
                    disabled={revokingCode === mod.module_code}
                    className="ml-3 text-xs text-red-400 hover:text-red-300 font-bold shrink-0 transition-colors disabled:opacity-40"
                  >
                    {revokingCode === mod.module_code ? '…' : 'Revocar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {openSection === 'assign_module' && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <AssignModuleSection
                profileId={profile.id}
                activeModules={active_modules}
                onDone={handleMutationSuccess}
              />
            </div>
          )}
        </div>

        {/* ── Cambiar plan ── */}
        <div className="glass-card p-5 mb-4">
          <button
            onClick={() => toggleSection('change_plan')}
            className="w-full flex items-center justify-between"
          >
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Cambiar plan</p>
            <span className="text-slate-400">{openSection === 'change_plan' ? '−' : '+'}</span>
          </button>
          {openSection === 'change_plan' && (
            <div className="mt-4">
              <ChangePlanSection
                profileId={profile.id}
                currentPlan={profile.plan_id}
                onDone={handleMutationSuccess}
              />
            </div>
          )}
        </div>

        {/* ── Override de límites ── */}
        <div className="glass-card p-5 mb-4">
          <button
            onClick={() => toggleSection('override')}
            className="w-full flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Override de límites</p>
              {plan_overrides && (
                <p className="text-xs text-amber-400 mt-0.5">Override activo</p>
              )}
            </div>
            <span className="text-slate-400">{openSection === 'override' ? '−' : '+'}</span>
          </button>
          {openSection === 'override' && (
            <div className="mt-4">
              <OverrideSection
                profileId={profile.id}
                current={plan_overrides}
                onDone={handleMutationSuccess}
              />
            </div>
          )}
        </div>

        {/* ── Activar / desactivar ── */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Estado del perfil</p>
              <p className={`text-sm font-bold ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isActive ? '● Activo' : '● Inactivo'}
              </p>
            </div>
            <button
              onClick={toggleStatus}
              disabled={statusLoading}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors disabled:opacity-40 ${
                isActive
                  ? 'bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30'
                  : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              {statusLoading ? '…' : isActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>

        {/* ── Auditoría reciente ── */}
        {recent_audit.length > 0 && (
          <div className="glass-card p-5 mb-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-3">Auditoría reciente</p>
            <div className="flex flex-col gap-2">
              {recent_audit.map((entry, i) => (
                <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{entry.action}</span>
                    <span className="text-[11px] text-slate-500">{formatDate(entry.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {entry.target_type}{entry.target_id ? ` · ${entry.target_id.slice(0, 12)}…` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas admin */}
        {profile.admin_notes && (
          <div className="glass-card p-5 mb-4 border-amber-500/20">
            <p className="text-xs text-amber-300 font-bold uppercase tracking-wide mb-2">Notas de admin</p>
            <p className="text-sm text-slate-300">{profile.admin_notes}</p>
          </div>
        )}

      </main>
    </div>
  )
}
