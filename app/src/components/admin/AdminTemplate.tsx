import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../lib/api'

// ─── Template Definitions ─────────────────────────────────────────────────────

export interface TemplateField {
  key: string
  label: string
  type: 'text' | 'url' | 'textarea' | 'date'
  placeholder?: string
  required?: boolean
}

export interface TemplateDef {
  id: string
  label: string
  icon: string
  description: string
  categories: string[]
  fields: TemplateField[]
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'restaurante',
    label: 'Restaurante',
    icon: '🍽️',
    description: 'Ideal para restaurantes, cafeterías, food trucks y negocios gastronómicos.',
    categories: ['Gastronomía y Restaurantes'],
    fields: [
      { key: 'menu_highlight', label: 'Especialidad del día / Plato destacado', type: 'text',     placeholder: 'Ej. Tacos al pastor · Paella valenciana' },
      { key: 'reservas_url',   label: 'URL de reservas',                        type: 'url',      placeholder: 'https://opentable.com/...' },
      { key: 'delivery_url',   label: 'URL de delivery / pedidos online',       type: 'url',      placeholder: 'https://rappi.com/...' },
      { key: 'delivery_note',  label: 'Horario de entrega (texto libre)',        type: 'text',     placeholder: 'Ej. Lun-Vie 12:00–22:00, Sáb-Dom 10:00–23:00' },
    ],
  },
  {
    id: 'servicios',
    label: 'Servicios Profesionales',
    icon: '💼',
    description: 'Para consultores, coaches, abogados, médicos y profesionales independientes.',
    categories: [
      'Consultoría y Servicios Profesionales', 'Salud y Bienestar', 'Educación y Formación',
      'Arte y Diseño', 'Belleza y Estética', 'Tecnología', 'Deportes y Fitness',
    ],
    fields: [
      { key: 'services_intro',   label: 'Descripción corta de tus servicios',  type: 'textarea', placeholder: 'Ej. Ofrezco asesoría legal especializada en contratos corporativos...' },
      { key: 'calendly_url',     label: 'URL de agenda / Calendly',            type: 'url',      placeholder: 'https://calendly.com/...' },
      { key: 'years_experience', label: 'Años de experiencia',                 type: 'text',     placeholder: 'Ej. 10 años' },
      { key: 'credential_1',     label: 'Certificación o título #1',           type: 'text',     placeholder: 'Ej. MBA · Licenciado en Derecho · Certificado Google Ads' },
      { key: 'credential_2',     label: 'Certificación o título #2',           type: 'text',     placeholder: 'Opcional' },
      { key: 'credential_3',     label: 'Certificación o título #3',           type: 'text',     placeholder: 'Opcional' },
    ],
  },
  {
    id: 'eventos',
    label: 'Eventos',
    icon: '🎭',
    description: 'Para artistas, DJ, organizadores de eventos, bandas y promotores.',
    categories: ['Entretenimiento', 'Turismo y Viajes', 'Arte y Diseño', 'Deportes y Fitness'],
    fields: [
      { key: 'event_name',  label: 'Nombre del próximo evento',   type: 'text',     placeholder: 'Ej. Festival de Jazz 2026' },
      { key: 'event_date',  label: 'Fecha del evento',            type: 'date',     placeholder: '' },
      { key: 'event_venue', label: 'Lugar / Venue',               type: 'text',     placeholder: 'Ej. Auditorio Nacional, CDMX' },
      { key: 'ticket_url',  label: 'URL de compra de boletos',    type: 'url',      placeholder: 'https://ticketmaster.com/...' },
      { key: 'lineup',      label: 'Programa / Lineup',           type: 'textarea', placeholder: 'Ej. 20:00 Apertura · 21:00 Banda Invitada · 22:30 Artista Principal' },
    ],
  },
]

export function getCategoryTemplate(category: string): TemplateDef | null {
  return TEMPLATES.find(t => t.categories.includes(category)) ?? null
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MeData {
  template_id: string | null
  templateData: Record<string, string>
  category: string | null
}

export default function AdminTemplate() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (json.ok) {
        const d = json.data as MeData
        setMe(d)
        setSelected(d.template_id ?? null)
        setFields(d.templateData ?? {})
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res: any = await apiPut('/me/profile', {
        template_id: selected,
        template_data: fields,
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSelectTemplate = (id: string) => {
    if (id === selected) return
    setSelected(id)
    // Keep existing field values, just switch template
    setSaved(false)
  }

  const setField = (key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const currentDef = TEMPLATES.find(t => t.id === selected) ?? null
  const suggestedDef = me?.category ? getCategoryTemplate(me.category) : null

  if (loading) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <header className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/admin')} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-black">Plantilla vertical</h1>
        </header>

        {/* Suggested banner */}
        {suggestedDef && selected !== suggestedDef.id && (
          <div className="glass-card p-4 mb-4 flex items-center justify-between gap-3 border-intap-mint/20 bg-intap-mint/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">{suggestedDef.icon}</span>
              <p className="text-xs text-intap-mint font-bold truncate">
                Tu sector sugiere la plantilla <span className="text-white">{suggestedDef.label}</span>
              </p>
            </div>
            <button
              onClick={() => handleSelectTemplate(suggestedDef.id)}
              className="shrink-0 text-xs bg-intap-mint/20 border border-intap-mint/30 text-intap-mint px-3 py-1.5 rounded-full hover:bg-intap-mint/30 transition-colors font-bold"
            >
              Aplicar
            </button>
          </div>
        )}

        {/* Template selector */}
        <div className="glass-card p-5 mb-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">
            Elige el tipo de perfil
          </p>
          <div className="flex flex-col gap-3">
            {/* None option */}
            <button
              onClick={() => { setSelected(null); setSaved(false) }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                selected === null
                  ? 'border-intap-mint bg-intap-mint/10'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🔗</span>
                <div>
                  <p className="text-sm font-bold">Genérico</p>
                  <p className="text-xs text-slate-400 mt-0.5">Sin campos adicionales — para cualquier tipo de negocio</p>
                </div>
              </div>
            </button>

            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  selected === t.id
                    ? 'border-intap-mint bg-intap-mint/10'
                    : 'border-white/10 bg-white/5 hover:border-white/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <p className="text-sm font-bold">{t.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                  </div>
                  {selected === t.id && (
                    <span className="ml-auto text-intap-mint text-sm font-bold">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Template fields */}
        {currentDef && (
          <div className="glass-card p-5 mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">
              {currentDef.icon} Campos de {currentDef.label}
            </p>
            <div className="flex flex-col gap-4">
              {currentDef.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={fields[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors resize-none"
                    />
                  ) : (
                    <input
                      type={f.type}
                      value={fields[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold text-sm disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar plantilla'}
        </button>

        {/* Migration notice */}
        {selected && currentDef && me?.template_id && me.template_id !== selected && (
          <p className="text-xs text-yellow-400/80 text-center mt-3">
            Cambiar de plantilla conserva tus campos anteriores. Puedes borrarlos manualmente.
          </p>
        )}
      </div>
    </div>
  )
}
