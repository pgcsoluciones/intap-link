/**
 * AdminRetention — página completa de gestión de retención.
 *
 * Ruta: /admin/retention
 *
 * Muestra:
 *   1. Resumen de plan y trial
 *   2. Estado por recurso (activos / pausados / excedidos)
 *   3. Módulos pausados
 *   4. Preview de impacto al bajar a Free
 *   5. Selector por recurso (igual que el del dashboard pero en página completa)
 *
 * Fuentes:
 *   GET /api/v1/entitlements
 *   GET /api/v1/me/plan-impact-preview?target=free
 *   POST /api/v1/me/retention/selection
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, API_BASE } from '../../lib/api'
import { StatusBadge } from './RetentionPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResourceRetention {
  used: number
  allowed: number
  exceeded: number
  active_ids: string[]
  exceeded_ids: string[]
  requires_selection: boolean
}

interface EntData {
  limits: {
    max_links: number
    max_photos: number
    max_faqs: number
    max_products: number
    max_videos: number
    can_use_vcard: boolean
  }
  resources: {
    links: ResourceRetention
    photos: ResourceRetention
    faqs: ResourceRetention
    products: ResourceRetention
    videos: ResourceRetention
  } | null
  paused_modules: Array<{
    module_code: string
    module_name: string
    expired_at: string | null
    paused_reason: string
  }>
  requires_selection: boolean
  paused_features_count: number
  recoverable_items_count: number
  plan_code: string
  trial_status: 'active' | 'expired' | 'none'
  trial_expires_at: string | null
  downgrade_effective_at: string | null
}

interface ImpactResource {
  total: number
  active: Array<{ id: string; label: string }>
  paused: Array<{ id: string; label: string }>
  exceeds_plan: boolean
  requires_selection: boolean
}

interface ImpactData {
  current_plan: string
  target_plan: string
  is_downgrade: boolean
  target_limits: Record<string, number | boolean>
  resources: {
    links: ImpactResource
    photos: ImpactResource
    faqs: ImpactResource
    products: ImpactResource
    videos: ImpactResource
  }
  modules: { loses_vcard: boolean }
  summary: { items_to_pause: number; requires_selection: boolean }
}

interface SelectableItem {
  id: string
  label: string
  image_key?: string
}

type ResourceKey = 'links' | 'faqs' | 'products' | 'photos' | 'videos'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RESOURCE_META: Record<ResourceKey, { singular: string; plural: string; emoji: string }> = {
  links:    { singular: 'link',     plural: 'links',     emoji: '🔗' },
  photos:   { singular: 'foto',     plural: 'fotos',     emoji: '🖼️' },
  faqs:     { singular: 'pregunta', plural: 'preguntas', emoji: '❓' },
  products: { singular: 'producto', plural: 'productos', emoji: '🛍️' },
  videos:   { singular: 'video',    plural: 'videos',    emoji: '▶️' },
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

function photoUrl(key: string) {
  return `${API_BASE}/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Gratuito', starter: 'Starter', pro: 'Pro', agency: 'Agencia',
}

// ─── ResourceRow ─────────────────────────────────────────────────────────────

function ResourceRow({ label, resourceKey, retention, profileId, onSelectionDone }: {
  label: string
  resourceKey: ResourceKey
  retention: ResourceRetention
  profileId: string
  onSelectionDone: () => void
}) {
  const meta = RESOURCE_META[resourceKey]
  const [expanded, setExpanded] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [items, setItems] = useState<SelectableItem[] | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(retention.active_ids))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const { used, allowed, exceeded, active_ids } = retention

  const loadItems = async () => {
    if (items || loadingItems) return
    setLoadingItems(true)
    try {
      if (resourceKey === 'photos') {
        const json: any = await apiGet(`/profile/gallery/${profileId}`)
        if (json.ok) {
          setItems((json.photos || []).map((p: any) => ({
            id: p.id, label: `Foto`, image_key: p.image_key,
          })))
        }
      } else {
        const json: any = await apiGet(`/me/${resourceKey}`)
        if (json.ok) {
          setItems((json.data || []).map((item: any) => ({
            id: item.id,
            label: item.label || item.question || item.title || item.url || item.id,
          })))
        }
      }
    } finally {
      setLoadingItems(false)
    }
  }

  const openSelector = () => {
    setSelectorOpen(true)
    loadItems()
  }

  const toggleItem = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) { next.delete(id) }
    else if (next.size < allowed) { next.add(id) }
    setSelected(next)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res: any = await apiPost('/me/retention/selection', {
        resource: resourceKey,
        keep_ids: [...selected],
      })
      if (res.ok) {
        setSaved(true)
        setSelectorOpen(false)
        onSelectionDone()
      } else {
        setSaveError(res.error || 'Error al guardar')
      }
    } catch {
      setSaveError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const allIds = [...active_ids, ...retention.exceeded_ids]

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      {/* Row header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
      >
        <span className="text-lg">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{label}</span>
            {saved && <StatusBadge type="active" />}
            {!saved && exceeded > 0 && <StatusBadge type="requires_selection" />}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {used} guardados · {active_ids.length} activos · {exceeded > 0 ? `${exceeded} en pausa` : 'todos activos'}
          </p>
        </div>
        {exceeded > 0 && !saved && (
          <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
            +{exceeded} pausado{exceeded > 1 ? 's' : ''}
          </span>
        )}
        <svg className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/10 bg-white/2">
          {/* Progress bar */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex justify-between text-xs mb-1.5 text-slate-400">
              <span>Activos: {active_ids.length} de {allowed}</span>
              <span>{used} guardados en total</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${exceeded > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(100, (active_ids.length / allowed) * 100)}%` }}
              />
            </div>
          </div>

          {/* Active section */}
          <div className="px-4 pb-3">
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Activos ({active_ids.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {active_ids.length === 0
                ? <span className="text-xs text-slate-500">Ninguno activo</span>
                : active_ids.slice(0, 5).map(id => (
                  <span key={id} className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full">
                    {id.slice(-6)}
                  </span>
                ))}
              {active_ids.length > 5 && (
                <span className="text-xs text-slate-500">+{active_ids.length - 5} más</span>
              )}
            </div>
          </div>

          {/* Paused section */}
          {exceeded > 0 && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">En pausa — guardados ({exceeded})</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {retention.exceeded_ids.map(id => (
                  <span key={id} className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full">
                    {id.slice(-6)}
                  </span>
                ))}
              </div>
              <button
                onClick={openSelector}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-colors"
              >
                Elegir cuáles mantener activos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline selector */}
      {selectorOpen && (
        <div className="border-t border-white/10 bg-[#0a1020] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold">Selecciona hasta {allowed} {meta.plural} para mantener activos</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Los demás quedan guardados y recuperables</p>
            </div>
            <span className={`text-xs font-bold ${selected.size >= allowed ? 'text-amber-400' : 'text-intap-mint'}`}>
              {selected.size}/{allowed}
            </span>
          </div>

          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${selected.size >= allowed ? 'bg-amber-400' : 'bg-intap-mint'}`}
              style={{ width: `${Math.min(100, (selected.size / allowed) * 100)}%` }}
            />
          </div>

          {loadingItems ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto mb-3">
              {(items ?? [])
                .sort((a, b) => allIds.indexOf(a.id) - allIds.indexOf(b.id))
                .map(item => {
                  const isCurrentlyActive = active_ids.includes(item.id)
                  const isSelected = selected.has(item.id)
                  const isDisabled = !isSelected && selected.size >= allowed
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      disabled={isDisabled}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-intap-mint/40 bg-intap-mint/10'
                          : isDisabled
                          ? 'border-white/5 bg-white/2 opacity-40 cursor-not-allowed'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-intap-mint border-intap-mint' : 'border-white/20'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-intap-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {resourceKey === 'photos' && item.image_key && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0">
                          <img src={photoUrl(item.image_key)} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <span className="text-xs text-white flex-1 truncate">{item.label}</span>

                      <span className={`text-[9px] font-bold uppercase shrink-0 ${
                        isCurrentlyActive ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {isCurrentlyActive ? 'activo' : 'pausa'}
                      </span>
                    </button>
                  )
                })}
            </div>
          )}

          {saveError && <p className="text-xs text-red-400 mb-2">{saveError}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || selected.size === 0}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-intap-blue to-purple-600 text-white text-xs font-bold disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Confirmar'}
            </button>
            <button
              onClick={() => setSelectorOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PlanImpactPreview ────────────────────────────────────────────────────────

function PlanImpactPreview() {
  const [impact, setImpact] = useState<ImpactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    apiGet('/me/plan-impact-preview?target=free')
      .then((json: any) => { if (json.ok) setImpact(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="glass-card p-5 flex items-center justify-center">
      <div className="w-4 h-4 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  )

  if (!impact) return null

  const { summary, resources, modules } = impact

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
      >
        <div>
          <p className="text-xs font-bold uppercase text-slate-400 mb-1">Vista previa — Plan Gratuito</p>
          <p className="text-sm text-white">
            {summary.items_to_pause === 0
              ? 'Tu contenido entra completo en el plan gratuito'
              : `${summary.items_to_pause} ítems quedarían en pausa si bajas a Free`}
          </p>
        </div>
        <svg className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ml-4 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-5 pb-5 pt-4">
          {modules.loses_vcard && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-sm">🪪</span>
              <p className="text-xs text-purple-300">Perderías acceso a vCard digital (requiere plan de pago)</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {(Object.keys(resources) as ResourceKey[]).map(key => {
              const res = resources[key]
              const meta = RESOURCE_META[key]
              if (!res) return null
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      {meta.emoji} {meta.plural}
                    </span>
                    {res.exceeds_plan
                      ? <StatusBadge type="requires_selection" />
                      : <StatusBadge type="active" />}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                      <p className="text-[10px] text-emerald-300 font-bold uppercase mb-1">Quedarían activos</p>
                      {res.active.length === 0
                        ? <p className="text-slate-500 italic">Ninguno</p>
                        : res.active.slice(0, 3).map(item => (
                          <p key={item.id} className="text-slate-300 truncate">· {item.label}</p>
                        ))}
                      {res.active.length > 3 && <p className="text-slate-500">+{res.active.length - 3} más</p>}
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                      <p className="text-[10px] text-amber-300 font-bold uppercase mb-1">Quedarían en pausa</p>
                      {res.paused.length === 0
                        ? <p className="text-slate-500 italic">Ninguno</p>
                        : res.paused.slice(0, 3).map(item => (
                          <p key={item.id} className="text-slate-300 truncate">· {item.label}</p>
                        ))}
                      {res.paused.length > 3 && <p className="text-slate-500">+{res.paused.length - 3} más</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {summary.items_to_pause > 0 && (
            <p className="text-[11px] text-slate-500 mt-4 text-center">
              Todo el contenido en pausa se conserva. Puedes recuperarlo cuando actualices tu plan.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AdminRetention (página principal) ───────────────────────────────────────

export default function AdminRetention() {
  const navigate = useNavigate()
  const [ent, setEnt] = useState<EntData | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileId, setProfileId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [meJson, entJson]: any[] = await Promise.all([
        apiGet('/me'),
        apiGet('/entitlements'),
      ])
      if (meJson.ok) setProfileId(meJson.data?.profile_id ?? null)
      if (entJson.ok) setEnt(entJson.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin" />
    </div>
  )

  if (!ent || !profileId) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <p className="text-slate-400 text-sm">No se pudo cargar la información del plan.</p>
    </div>
  )

  const activeResources = (['links', 'photos', 'faqs', 'products', 'videos'] as ResourceKey[])
    .filter(k => ent.resources?.[k])

  const planName = PLAN_NAMES[ent.plan_code] ?? ent.plan_code

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <header className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-black">Tu configuración</h1>
            <p className="text-xs text-slate-400">Todo sigue guardado · gestiona qué está activo</p>
          </div>
        </header>

        {/* Plan summary card */}
        <div className="glass-card p-5 mb-4">
          <p className="text-xs font-bold uppercase text-slate-500 mb-3">Estado del plan</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Plan actual</p>
              <p className="text-sm font-black text-intap-mint capitalize">{planName}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Trial</p>
              <StatusBadge
                type={
                  ent.trial_status === 'active' ? 'trial_active'
                  : ent.trial_status === 'expired' ? 'trial_expired'
                  : 'active'
                }
              />
              {ent.trial_status === 'active' && ent.trial_expires_at && (
                <p className="text-[10px] text-slate-500 mt-1">Vence {formatDate(ent.trial_expires_at)}</p>
              )}
              {ent.trial_status === 'expired' && ent.trial_expires_at && (
                <p className="text-[10px] text-slate-500 mt-1">Venció {formatDate(ent.trial_expires_at)}</p>
              )}
            </div>
          </div>

          {/* Limits row */}
          <div className="grid grid-cols-5 gap-1.5">
            {([
              { key: 'links',    icon: '🔗', max: ent.limits.max_links },
              { key: 'photos',   icon: '🖼️', max: ent.limits.max_photos },
              { key: 'faqs',     icon: '❓', max: ent.limits.max_faqs },
              { key: 'products', icon: '🛍️', max: ent.limits.max_products },
              { key: 'videos',   icon: '▶️', max: ent.limits.max_videos },
            ] as const).map(({ key, icon, max }) => {
              const res = ent.resources?.[key as ResourceKey]
              const used = res?.used ?? 0
              const exceeded = res?.exceeded ?? 0
              return (
                <div key={key} className={`rounded-xl p-2 text-center ${exceeded > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/5 border border-white/10'}`}>
                  <p className="text-sm">{icon}</p>
                  <p className={`text-[10px] font-black ${exceeded > 0 ? 'text-amber-400' : 'text-white'}`}>{used}/{max}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recovery message (only when something is paused) */}
        {(ent.paused_features_count > 0 || ent.paused_modules.length > 0) && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 mb-4 flex gap-3">
            <span className="text-lg mt-0.5">📦</span>
            <div>
              <p className="text-sm font-bold text-amber-200">
                {ent.recoverable_items_count} {ent.recoverable_items_count === 1 ? 'ítem guardado' : 'ítems guardados'} fuera del plan
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Tu contenido no se borró. Puedes elegir cuáles mantener activos o reactivar tu plan para recuperar todo.
              </p>
            </div>
          </div>
        )}

        {/* Per-resource sections */}
        {ent.resources && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase text-slate-500 mb-3">Recursos</p>
            <div className="flex flex-col gap-2">
              {activeResources.map(key => {
                const ret = ent.resources![key]
                const labels: Record<ResourceKey, string> = {
                  links: 'Links', photos: 'Galería de fotos', faqs: 'Preguntas frecuentes',
                  products: 'Productos y servicios', videos: 'Videos',
                }
                return (
                  <ResourceRow
                    key={key}
                    label={labels[key]}
                    resourceKey={key}
                    retention={ret}
                    profileId={profileId}
                    onSelectionDone={load}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Paused modules */}
        {ent.paused_modules.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase text-slate-500 mb-3">Módulos pausados</p>
            <div className="flex flex-col gap-2">
              {ent.paused_modules.map(mod => (
                <div key={mod.module_code} className="glass-card p-4 flex items-center gap-3">
                  <span className="text-lg">🔌</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{mod.module_name}</p>
                      <StatusBadge type="module_paused" />
                    </div>
                    {mod.expired_at && (
                      <p className="text-xs text-slate-400 mt-0.5">Venció {formatDate(mod.expired_at)}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">La configuración sigue guardada</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan impact preview */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase text-slate-500 mb-3">Simulador de plan</p>
          <PlanImpactPreview />
        </div>

        {/* Upgrade CTA */}
        <div className="glass-card p-5 text-center mb-6">
          <p className="text-sm font-bold mb-1">Recupera todo tu contenido</p>
          <p className="text-xs text-slate-400 mb-4">
            Al actualizar tu plan, todos los ítems en pausa vuelven a estar activos automáticamente.
          </p>
          <button
            className="w-full py-3 rounded-xl bg-gradient-to-r from-intap-blue to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-opacity"
            onClick={() => {
              // TODO: conectar a página de planes cuando esté disponible
              alert('Próximamente: gestión de planes desde el dashboard')
            }}
          >
            Actualizar plan →
          </button>
          <p className="text-[11px] text-slate-500 mt-3">
            Tu contenido nunca se borra · todo sigue guardado
          </p>
        </div>

      </div>
    </div>
  )
}
