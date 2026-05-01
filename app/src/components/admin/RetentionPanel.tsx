/**
 * RetentionPanel — bloque embebido en el dashboard del admin.
 *
 * Fuentes de verdad:
 *   Props iniciales (de /me): usados para render inmediato — sin esperar fetch
 *   GET /api/v1/entitlements: enriquece datos para el selector modal
 *   POST /api/v1/me/retention/selection → guarda la selección del usuario
 *
 * Principio rector: nunca presentar como pérdida.
 *   "Tu configuración sigue guardada"
 *   "Algunas funciones quedaron en pausa"
 *   "Puedes elegir qué mantener activo"
 *
 * Bug fix: el panel se renderiza con los datos de /me (ya disponibles en el padre)
 * sin esperar a /entitlements. El fetch de /entitlements es background-only
 * y enriquece el selector cuando se abre — no es el gatekeep del render.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, API_BASE } from '../../lib/api'

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

type ResourceKey = 'links' | 'faqs' | 'products' | 'photos' | 'videos'

interface SelectableItem {
  id: string
  label: string
  image_key?: string   // solo para photos
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso + 'Z').getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const RESOURCE_LABELS: Record<ResourceKey, { singular: string; plural: string; emoji: string }> = {
  links:    { singular: 'link',     plural: 'links',     emoji: '🔗' },
  photos:   { singular: 'foto',     plural: 'fotos',     emoji: '🖼️' },
  faqs:     { singular: 'pregunta', plural: 'preguntas', emoji: '❓' },
  products: { singular: 'producto', plural: 'productos', emoji: '🛍️' },
  videos:   { singular: 'video',    plural: 'videos',    emoji: '▶️' },
}

function photoUrl(key: string): string {
  return `${API_BASE}/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ type }: {
  type: 'active' | 'paused' | 'requires_selection' | 'trial_active' | 'trial_expired' | 'module_paused'
}) {
  const map = {
    active:            { label: 'Activo',           cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    paused:            { label: 'En pausa',          cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    requires_selection:{ label: 'Requiere elección', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    trial_active:      { label: 'Trial activo',      cls: 'bg-intap-blue/20 text-intap-blue border-intap-blue/30' },
    trial_expired:     { label: 'Trial vencido',     cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    module_paused:     { label: 'Módulo pausado',    cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  }
  const { label, cls } = map[type]
  return (
    <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

// ─── TrialBanner ─────────────────────────────────────────────────────────────

function TrialBanner({ trialStatus, trialExpiresAt, onViewDetails }: {
  trialStatus: 'active' | 'expired'
  trialExpiresAt: string | null
  onViewDetails: () => void
}) {
  const days = daysUntil(trialExpiresAt)
  const soon = trialStatus === 'active' && days !== null && days <= 7

  if (trialStatus === 'active' && !soon) return null   // solo mostrar si vence pronto

  const isExpired = trialStatus === 'expired'

  return (
    <div className={`rounded-2xl border p-4 mb-4 flex items-start gap-3 ${
      isExpired
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-amber-500/10 border-amber-500/20'
    }`}>
      <span className="text-xl mt-0.5">{isExpired ? '⏰' : '⚠️'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${isExpired ? 'text-red-300' : 'text-amber-300'}`}>
          {isExpired
            ? 'Tu período de prueba ha terminado'
            : `Tu período de prueba termina en ${days === 1 ? '1 día' : `${days} días`}`}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {isExpired
            ? 'Tu configuración sigue intacta. Ahora estás en el plan gratuito.'
            : `Vence el ${formatDate(trialExpiresAt)}. Tu configuración se conservará.`}
        </p>
      </div>
      <button
        onClick={onViewDetails}
        className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
          isExpired
            ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
        }`}
      >
        Ver estado
      </button>
    </div>
  )
}

// ─── RetentionSummaryCard ─────────────────────────────────────────────────────

function RetentionSummaryCard({
  pausedFeaturesCount,
  recoverableItemsCount,
  requiresSelection,
  resources,
  pausedModules,
  onSelectItems,
  onViewDetails,
}: {
  pausedFeaturesCount: number
  recoverableItemsCount: number
  requiresSelection: boolean
  resources: EntData['resources'] | null
  pausedModules: EntData['paused_modules']
  onSelectItems: () => void
  onViewDetails: () => void
}) {
  if (pausedFeaturesCount === 0 && pausedModules.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📦</span>
        <div>
          <p className="text-sm font-bold text-amber-200">Tu configuración sigue guardada</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Algunas funciones quedaron en pausa según tu plan actual
          </p>
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xl font-black text-white">{pausedFeaturesCount}</p>
          <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">
            {pausedFeaturesCount === 1 ? 'función pausada' : 'funciones pausadas'}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xl font-black text-amber-300">{recoverableItemsCount}</p>
          <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">
            {recoverableItemsCount === 1 ? 'ítem recuperable' : 'ítems recuperables'}
          </p>
        </div>
      </div>

      {/* Per-resource badges — only when entitlements loaded */}
      {resources && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(['links', 'photos', 'faqs', 'products', 'videos'] as ResourceKey[]).map(key => {
            const res = resources[key]
            if (!res || res.exceeded === 0) return null
            const meta = RESOURCE_LABELS[key]
            return (
              <span key={key} className="inline-flex items-center gap-1 text-[11px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-slate-300">
                <span>{meta.emoji}</span>
                <span>{res.exceeded} {res.exceeded === 1 ? meta.singular : meta.plural} pausado{key !== 'faqs' ? 's' : 's'}</span>
              </span>
            )
          })}
          {pausedModules.map(m => (
            <span key={m.module_code} className="inline-flex items-center gap-1 text-[11px] bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full text-purple-300">
              <span>🔌</span>
              <span>{m.module_name} pausado</span>
            </span>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-2">
        {requiresSelection && (
          <button
            onClick={onSelectItems}
            className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-colors"
          >
            Elegir qué mantener activo
          </button>
        )}
        <button
          onClick={onViewDetails}
          className={`${requiresSelection ? '' : 'flex-1'} py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors`}
        >
          {requiresSelection ? 'Ver detalles' : 'Ver detalles y recuperar'}
        </button>
      </div>
    </div>
  )
}

// ─── RetentionSelectorModal ───────────────────────────────────────────────────

function RetentionSelectorModal({ ent, profileId, onClose, onSuccess }: {
  ent: EntData
  profileId: string
  onClose: () => void
  onSuccess: () => void
}) {
  // Solo mostrar recursos con excedentes
  const resourcesWithExcess = (['links', 'faqs', 'products', 'photos'] as ResourceKey[]).filter(key => {
    const r = ent.resources?.[key]
    return r && r.exceeded > 0
  })

  const [activeTab, setActiveTab] = useState<ResourceKey>(resourcesWithExcess[0] || 'links')
  const [items, setItems] = useState<Record<string, SelectableItem[]>>({})
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const currentResource = ent.resources?.[activeTab]
  const allowed = currentResource?.allowed ?? 0
  const allIds = currentResource ? [...currentResource.active_ids, ...currentResource.exceeded_ids] : []
  const selectedSet = selected[activeTab] ?? new Set(currentResource?.active_ids ?? [])

  // Cargar items del recurso activo cuando cambia la tab
  const loadItems = useCallback(async (key: ResourceKey) => {
    if (items[key] || loadingItems[key]) return
    setLoadingItems(prev => ({ ...prev, [key]: true }))
    try {
      if (key === 'photos') {
        const json: any = await apiGet('/me/gallery')
        if (json.ok) {
          setItems(prev => ({
            ...prev,
            [key]: (json.photos || []).map((p: any) => ({
              id: p.id,
              label: `Foto ${p.id.slice(-4)}`,
              image_key: p.image_key,
            }))
          }))
        }
      } else {
        const json: any = await apiGet(`/me/${key}`)
        if (json.ok) {
          setItems(prev => ({
            ...prev,
            [key]: (json.data || []).map((item: any) => ({
              id: item.id,
              label: item.label || item.question || item.title || item.url || item.id,
            }))
          }))
        }
      }
    } finally {
      setLoadingItems(prev => ({ ...prev, [key]: false }))
    }
  }, [items, loadingItems, profileId])

  useEffect(() => {
    loadItems(activeTab)
  }, [activeTab, loadItems])

  const toggleItem = (id: string) => {
    const current = selected[activeTab] ?? new Set(currentResource?.active_ids ?? [])
    const next = new Set(current)
    if (next.has(id)) {
      next.delete(id)
    } else {
      if (next.size >= allowed) return   // no pasar del límite
      next.add(id)
    }
    setSelected(prev => ({ ...prev, [activeTab]: next }))
  }

  const handleConfirm = async () => {
    const currentSel = selected[activeTab] ?? new Set(currentResource?.active_ids ?? [])
    if (currentSel.size === 0) {
      setError('Debes seleccionar al menos 1 ítem')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res: any = await apiPost('/me/retention/selection', {
        resource: activeTab,
        keep_ids: [...currentSel],
      })
      if (res.ok) {
        setSaved(prev => ({ ...prev, [activeTab]: true }))
        // Avanzar a la siguiente tab con excedentes, si hay
        const next = resourcesWithExcess.find(k => k !== activeTab && !saved[k])
        if (next) {
          setActiveTab(next)
        } else {
          onSuccess()
        }
      } else {
        setError(res.error || 'Error al guardar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-[#0f1520] border border-white/10 rounded-3xl overflow-hidden max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-start justify-between shrink-0">
          <div>
            <p className="text-sm font-black">Elige qué mantener activo</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Tu configuración completa sigue guardada. Solo elige cuáles priorizar.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none mt-0.5">×</button>
        </div>

        {/* Tabs */}
        {resourcesWithExcess.length > 1 && (
          <div className="flex gap-1 px-5 pt-4 shrink-0">
            {resourcesWithExcess.map(key => {
              const meta = RESOURCE_LABELS[key]
              const isSaved = saved[key]
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    activeTab === key
                      ? 'bg-intap-mint/20 text-intap-mint border border-intap-mint/30'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                  }`}
                >
                  {isSaved && <span className="text-emerald-400">✓</span>}
                  {meta.emoji} {meta.plural}
                </button>
              )
            })}
          </div>
        )}

        {/* Limit indicator */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400">
              Selecciona hasta <strong className="text-white">{allowed}</strong> {RESOURCE_LABELS[activeTab]?.plural}
            </span>
            <span className={`font-bold ${selectedSet.size >= allowed ? 'text-amber-400' : 'text-intap-mint'}`}>
              {selectedSet.size} / {allowed}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${selectedSet.size >= allowed ? 'bg-amber-400' : 'bg-intap-mint'}`}
              style={{ width: `${Math.min(100, (selectedSet.size / allowed) * 100)}%` }}
            />
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {loadingItems[activeTab] ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin" />
            </div>
          ) : (items[activeTab] ?? []).length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No hay ítems para mostrar</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(items[activeTab] ?? [])
                .sort((a, b) => {
                  const ai = allIds.indexOf(a.id)
                  const bi = allIds.indexOf(b.id)
                  if (ai === -1 && bi === -1) return 0
                  if (ai === -1) return 1
                  if (bi === -1) return -1
                  return ai - bi
                })
                .map((item) => {
                  const isActive = currentResource?.active_ids.includes(item.id)
                  const isSelected = selectedSet.has(item.id)
                  const isDisabled = !isSelected && selectedSet.size >= allowed
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-intap-mint/40 bg-intap-mint/10'
                          : isDisabled
                          ? 'border-white/5 bg-white/2 opacity-40 cursor-not-allowed'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-intap-mint border-intap-mint'
                          : 'border-white/20 bg-white/5'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-intap-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Photo thumbnail OR text label */}
                      {activeTab === 'photos' && item.image_key ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 shrink-0">
                          <img src={photoUrl(item.image_key)} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : null}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.label}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isActive
                            ? <StatusBadge type="active" />
                            : <StatusBadge type="paused" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 shrink-0">
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={saving || selectedSet.size === 0}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-intap-blue to-purple-600 text-white text-sm font-bold disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Guardando…' : `Confirmar selección`}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
          <p className="text-[11px] text-slate-500 text-center mt-2">
            Los ítems no seleccionados quedan guardados y recuperables
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── RetentionPanel (componente principal) ─────────────────────────────────────
//
// IMPORTANTE: recibe datos iniciales de /me desde el padre (AdminDashboard).
// Esto garantiza que el panel se renderice SIEMPRE que haya datos relevantes,
// sin depender del fetch a /entitlements. El fetch a /entitlements es background-only
// y solo se usa para enriquecer el selector modal cuando se abre.

export default function RetentionPanel({
  profileId,
  initialPausedFeaturesCount = 0,
  initialRecoverableItemsCount = 0,
  initialTrialStatus = 'none',
  initialTrialExpiresAt = null,
}: {
  profileId: string
  initialPausedFeaturesCount?: number
  initialRecoverableItemsCount?: number
  initialTrialStatus?: 'active' | 'expired' | 'none'
  initialTrialExpiresAt?: string | null
}) {
  const navigate = useNavigate()
  const [ent, setEnt] = useState<EntData | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)

  // Fetch /entitlements en background para enriquecer el selector
  // Si falla, el panel sigue visible usando los datos iniciales de /me
  const loadEntitlements = useCallback(async () => {
    try {
      const json: any = await apiGet('/entitlements')
      if (json.ok) setEnt(json.data)
    } catch (e) {
      console.error('[RetentionPanel] /entitlements fetch failed:', e)
    }
  }, [])

  useEffect(() => {
    loadEntitlements()
  }, [loadEntitlements])

  const handleSelectionSuccess = () => {
    setSelectorOpen(false)
    loadEntitlements()
  }

  // Datos derivados: ent (si cargó) toma precedencia sobre props iniciales
  const pausedFeaturesCount     = ent?.paused_features_count     ?? initialPausedFeaturesCount
  const recoverableItemsCount   = ent?.recoverable_items_count   ?? initialRecoverableItemsCount
  const trialStatus             = ent?.trial_status              ?? initialTrialStatus
  const trialExpiresAt          = ent?.trial_expires_at          ?? initialTrialExpiresAt
  const requiresSelection       = ent?.requires_selection        ?? (initialPausedFeaturesCount > 0)
  const pausedModules           = ent?.paused_modules            ?? []
  const resources               = ent?.resources                 ?? null

  const showTrialBanner   = trialStatus === 'expired' || trialStatus === 'active'
  const showRetentionCard = pausedFeaturesCount > 0 || pausedModules.length > 0

  // No renderizar si no hay nada que mostrar
  if (!showTrialBanner && !showRetentionCard) return null

  return (
    <>
      {/* Selector modal — solo se monta cuando ent está disponible y usuario lo abre */}
      {selectorOpen && ent && (
        <RetentionSelectorModal
          ent={ent}
          profileId={profileId}
          onClose={() => setSelectorOpen(false)}
          onSuccess={handleSelectionSuccess}
        />
      )}

      {/* Trial banner */}
      {showTrialBanner && (
        <TrialBanner
          trialStatus={trialStatus as 'active' | 'expired'}
          trialExpiresAt={trialExpiresAt}
          onViewDetails={() => navigate('/admin/retention')}
        />
      )}

      {/* Retention summary card */}
      {showRetentionCard && (
        <RetentionSummaryCard
          pausedFeaturesCount={pausedFeaturesCount}
          recoverableItemsCount={recoverableItemsCount}
          requiresSelection={requiresSelection}
          resources={resources}
          pausedModules={pausedModules}
          onSelectItems={() => setSelectorOpen(true)}
          onViewDetails={() => navigate('/admin/retention')}
        />
      )}
    </>
  )
}
