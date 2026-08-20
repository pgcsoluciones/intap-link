import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'
import { FreeBackButton, FreeLimitUpgradeCard, FreeUpgradeCard } from './FreePanelUi'

type QuickActionType = 'call' | 'instagram' | 'location' | 'email' | 'tiktok'

type QuickAction = {
  type: QuickActionType
  url: string
}

type QuickActionsPayload = {
  selected?: QuickAction[]
  values?: Partial<Record<QuickActionType, string>>
}

const OPTIONS: Array<{
  type: QuickActionType
  label: string
  helper: string
  recommended?: boolean
  placeholder: string
}> = [
  { type: 'call', label: 'Llamar', helper: 'Acceso directo a tu teléfono.', recommended: true, placeholder: '809 000 0000' },
  { type: 'instagram', label: 'Instagram', helper: 'Lleva visitantes a tu cuenta de Instagram.', recommended: true, placeholder: 'https://instagram.com/tuusuario' },
  { type: 'location', label: 'Ubicación', helper: 'Abre la ubicación que configures en la sección Mapa.', recommended: true, placeholder: '' },
  { type: 'email', label: 'Email', helper: 'Permite escribirte por correo con un toque.', placeholder: 'correo@empresa.com' },
  { type: 'tiktok', label: 'TikTok', helper: 'Acceso directo a tu cuenta de TikTok.', placeholder: 'https://tiktok.com/@tuusuario' },
]

const MAX_SELECTED = 3

function normalizeActionUrl(type: QuickActionType, raw: string) {
  const value = raw.trim()
  if (!value) return ''
  if (type === 'call') {
    const digits = value.replace(/\D/g, '')
    return digits ? `tel:+${digits}` : ''
  }
  if (type === 'email') {
    const email = value.replace(/^mailto:/i, '')
    return email ? `mailto:${email}` : ''
  }
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function displayValue(type: QuickActionType, value: string) {
  if (type === 'call') return value.replace(/^tel:\+?/i, '')
  if (type === 'email') return value.replace(/^mailto:/i, '')
  return value
}

export default function FreeQuickActions() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<QuickActionType[]>([])
  const [values, setValues] = useState<Partial<Record<QuickActionType, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [limitReached, setLimitReached] = useState(false)

  useEffect(() => {
    apiGet('/me/free/quick-actions')
      .then((json: any) => {
        if (!json?.ok) {
          setError(json?.error || 'No pudimos cargar tus accesos rápidos.')
          return
        }
        const data = (json.data || {}) as QuickActionsPayload
        setSelected((data.selected || []).map((item) => item.type).slice(0, MAX_SELECTED))
        const nextValues: Partial<Record<QuickActionType, string>> = {}
        OPTIONS.forEach((option) => {
          const stored = data.values?.[option.type] || data.selected?.find((item) => item.type === option.type)?.url || ''
          nextValues[option.type] = displayValue(option.type, stored)
        })
        setValues(nextValues)
      })
      .catch(() => setError('No pudimos cargar tus accesos rápidos.'))
      .finally(() => setLoading(false))
  }, [])

  function toggle(type: QuickActionType) {
    setMessage('')
    setError('')
    setSelected((current) => {
      if (current.includes(type)) {
        setLimitReached(false)
        return current.filter((item) => item !== type)
      }
      if (current.length >= MAX_SELECTED) {
        setLimitReached(true)
        setError('Ya elegiste 3 accesos rápidos. Quita uno para cambiarlo o pasa al Plan Básico para ampliar tus opciones.')
        return current
      }
      const next = [...current, type]
      setLimitReached(next.length >= MAX_SELECTED)
      return next
    })
  }

  async function save() {
    if (saving) return
    setMessage('')
    setError('')

    if (selected.length === 0) {
      setError('Elige al menos un acceso rápido antes de guardar.')
      return
    }

    const invalid = selected.find((type) => !normalizeActionUrl(type, values[type] || ''))
    if (invalid) {
      if (invalid === 'location') {
        setError('Configura tu mapa antes de guardar Ubicación como acceso rápido.')
        return
      }
      const label = OPTIONS.find((option) => option.type === invalid)?.label || 'seleccionado'
      setError(`Completa el dato de ${label} antes de guardar.`)
      return
    }

    const items = selected.map((type) => ({
      type,
      url: normalizeActionUrl(type, values[type] || ''),
    }))

    setSaving(true)
    try {
      const json: any = await apiPut('/me/free/quick-actions', { items })
      if (!json?.ok) {
        setError(json?.error || 'No se pudieron guardar tus accesos rápidos.')
        return
      }
      setMessage('Accesos rápidos actualizados.')
    } catch {
      setError('No se pudieron guardar tus accesos rápidos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[470px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Accesos rápidos</h1>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm">{selected.length}/{MAX_SELECTED}</span>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-500">Elige hasta 3 acciones para la fila central de tu perfil. WhatsApp y Guardar contacto permanecen destacados y no se cambian.</p>

        <div className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs font-black text-emerald-800">Recomendación por efectividad</p>
          <p className="mt-1 text-xs leading-5 text-emerald-700">Llamar + Instagram + Ubicación suele ofrecer el recorrido más directo para convertir una visita en contacto.</p>
        </div>

        {loading ? (
          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-400">Cargando…</div>
        ) : (
          <section className="mt-5 space-y-3">
            {OPTIONS.map((option) => {
              const active = selected.includes(option.type)
              const isLocation = option.type === 'location'
              const locationConfigured = Boolean(values.location?.trim())

              return (
                <article key={option.type} className={`rounded-[22px] border bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.04)] ${active ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => toggle(option.type)} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black ${active ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 bg-white text-slate-300'}`} aria-pressed={active} aria-label={`${active ? 'Quitar' : 'Elegir'} ${option.label}`}>
                      {active ? '✓' : ''}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-black">{option.label}</h2>
                        {option.recommended && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">Recomendado</span>}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{option.helper}</p>

                      {isLocation ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`text-xs font-black ${locationConfigured ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {locationConfigured ? 'Mapa configurado' : 'Mapa pendiente de configurar'}
                              </p>
                              {locationConfigured && (
                                <p className="mt-1 truncate text-[10px] text-slate-400">{values.location}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/admin/free/location')}
                              className="shrink-0 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-cyan-700 shadow-sm ring-1 ring-slate-200"
                            >
                              Configurar mapa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <input
                          value={values[option.type] || ''}
                          onChange={(event) => setValues((current) => ({ ...current, [option.type]: event.target.value }))}
                          placeholder={option.placeholder}
                          inputMode={option.type === 'email' ? 'email' : option.type === 'call' ? 'tel' : 'url'}
                          className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                        />
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">{error}</p>}
        {message && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{message}</p>}
        {(limitReached || selected.length >= MAX_SELECTED) && (
          <FreeLimitUpgradeCard text="Ya usas los 3 accesos rápidos incluidos. Puedes sustituir cualquiera de ellos o ampliar tu perfil con un Plan Básico." />
        )}

        <button type="button" onClick={() => void save()} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3.5 text-sm font-black text-white">
          {saving ? 'Guardando…' : 'Guardar accesos rápidos'}
        </button>

        <div className="mt-5"><FreeUpgradeCard compact /></div>
      </div>
    </main>
  )
}
