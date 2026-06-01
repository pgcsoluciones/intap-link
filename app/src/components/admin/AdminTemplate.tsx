import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../lib/api'

// ── Exports requeridos por el onboarding ──────────────────────────────────────

export interface TemplateDef {
  id: string
  label: string
  icon: string
  description: string
  categories: string[]
  fields: []
}

export function getCategoryTemplate(category: string): TemplateDef {
  const restauranteCategories = [
    'Restaurante y Gastronomía', 'Café y Bebidas', 'Comida Rápida', 'Delivery',
    'Panadería', 'Catering', 'Gastronomía y Restaurantes',
  ]
  const serviciosCategories = [
    'Salud y Bienestar', 'Belleza y Estética', 'Hogar y Reparaciones',
    'Jurídico y Contabilidad', 'Automotriz', 'Inmobiliaria', 'Finanzas', 'Seguridad',
    'Construcción y Hogar', 'Moda y Accesorios', 'Agropecuario', 'Retail',
  ]
  const eventosCategories = [
    'Entretenimiento y Eventos', 'Fotografía y Video', 'Música', 'Arte y Cultura',
    'Deportes', 'Turismo y Viajes', 'Entretenimiento', 'Deportes y Fitness',
  ]
  const personalCategories = [
    'Tecnología', 'Arte y Diseño', 'Consultoría y Servicios Profesionales',
    'Educación y Formación', 'Marketing y Comunicación', 'Otro', 'Otros',
  ]

  if (restauranteCategories.includes(category)) {
    return {
      id: 'restaurante',
      label: 'Restaurante',
      icon: '🍽️',
      description: 'Ideal para restaurantes, cafés y negocios gastronómicos.',
      categories: restauranteCategories,
      fields: [],
    }
  }
  if (eventosCategories.includes(category)) {
    return {
      id: 'eventos',
      label: 'Eventos',
      icon: '🎭',
      description: 'Ideal para eventos, entretenimiento y actividades culturales.',
      categories: eventosCategories,
      fields: [],
    }
  }
  if (personalCategories.includes(category)) {
    return {
      id: 'personal',
      label: 'Personal',
      icon: '👤',
      description: 'Ideal para freelancers, consultores y profesionales independientes.',
      categories: personalCategories,
      fields: [],
    }
  }
  if (serviciosCategories.includes(category)) {
    return {
      id: 'servicios',
      label: 'Servicios',
      icon: '💼',
      description: 'Ideal para negocios de servicios y profesionales.',
      categories: serviciosCategories,
      fields: [],
    }
  }
  // Default seguro: servicios
  return {
    id: 'servicios',
    label: 'Servicios',
    icon: '💼',
    description: 'Plantilla base para negocios de servicios.',
    categories: [],
    fields: [],
  }
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type TemplateId = 'restaurante' | 'servicios' | 'eventos' | 'personal'
type TemplateData = Record<string, string>

interface MeData {
  template_id: TemplateId | null
  template_data?: TemplateData
  templateData?: TemplateData
}

// ── Definición de plantillas ──────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  placeholder: string
  type?: 'text' | 'textarea' | 'url' | 'date' | 'tel'
}

interface TemplateCfg {
  id: TemplateId
  icon: string
  label: string
  fields: FieldDef[]
}

const TEMPLATES: TemplateCfg[] = [
  {
    id: 'restaurante',
    icon: '🍽️',
    label: 'Restaurante',
    fields: [
      { key: 'menu_highlight', label: 'Especialidad / plato estrella', placeholder: 'Ej. Paella valenciana o corte wagyu' },
      { key: 'delivery_note', label: 'Horario de entrega / atención', placeholder: 'Ej. Lun–Vie 12–22h · Sáb–Dom 13–23h' },
      { key: 'address_short', label: 'Dirección corta', placeholder: 'Ej. Av. Abraham Lincoln 456, Santo Domingo' },
      { key: 'phone_order', label: 'Teléfono para pedidos', placeholder: 'Ej. 8091234567', type: 'tel' },
      { key: 'reservas_url', label: 'URL para reservar mesa', placeholder: 'https://...', type: 'url' },
      { key: 'delivery_url', label: 'URL para pedir a domicilio', placeholder: 'https://...', type: 'url' },
    ],
  },
  {
    id: 'servicios',
    icon: '💼',
    label: 'Servicios',
    fields: [
      { key: 'services_intro', label: 'Descripción de servicios', placeholder: 'Ej. Ofrezco consultoría estratégica para pymes en crecimiento.', type: 'textarea' },
      { key: 'years_experience', label: 'Años de experiencia', placeholder: 'Ej. 10 años' },
      { key: 'credential_1', label: 'Credencial / certificación 1', placeholder: 'Ej. MBA · INCAE Business School' },
      { key: 'credential_2', label: 'Credencial / certificación 2', placeholder: 'Ej. PMP Certified' },
      { key: 'credential_3', label: 'Credencial / certificación 3', placeholder: 'Ej. Google Analytics Expert' },
      { key: 'whatsapp_cta', label: 'Texto del botón WhatsApp', placeholder: 'Ej. Solicitar cotización' },
      { key: 'calendly_url', label: 'URL para agendar cita', placeholder: 'https://calendly.com/...', type: 'url' },
      { key: 'portfolio_url', label: 'URL de portafolio', placeholder: 'https://...', type: 'url' },
    ],
  },
  {
    id: 'eventos',
    icon: '🎭',
    label: 'Eventos',
    fields: [
      { key: 'event_name', label: 'Nombre del evento', placeholder: 'Ej. Noche de Jazz · Edición Verano' },
      { key: 'event_date', label: 'Fecha del evento', placeholder: '', type: 'date' },
      { key: 'event_venue', label: 'Lugar del evento', placeholder: 'Ej. Teatro Nacional, Santo Domingo' },
      { key: 'ticket_url', label: 'URL para comprar boletos', placeholder: 'https://...', type: 'url' },
      { key: 'lineup', label: 'Programa / lineup', placeholder: 'Ej. 20:00 Apertura · 21:00 Concierto principal · 23:00 DJ set', type: 'textarea' },
    ],
  },
  {
    id: 'personal',
    icon: '👤',
    label: 'Personal',
    fields: [
      { key: 'role', label: 'Cargo o rol', placeholder: 'Ej. Diseñadora UX · Freelance' },
      { key: 'specialty', label: 'Área de especialidad', placeholder: 'Ej. Diseño de producto y branding' },
      { key: 'availability', label: 'Disponibilidad', placeholder: 'Ej. Disponible para proyectos' },
      { key: 'cta_label', label: 'Texto del botón principal', placeholder: 'Ej. Contratarme' },
      { key: 'cta_url', label: 'URL del botón principal', placeholder: 'https://...', type: 'url' },
      { key: 'portfolio_url', label: 'URL de portafolio', placeholder: 'https://...', type: 'url' },
      { key: 'linkedin_url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...', type: 'url' },
    ],
  },
]

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminTemplate() {
  const navigate = useNavigate()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null)
  const [fields, setFields] = useState<TemplateData>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (json.ok) {
        const d = json.data as MeData
        const tid = d.template_id as TemplateId | null
        setSelectedTemplate(tid)
        setFields(d.template_data ?? d.templateData ?? {})
      }
      setLoading(false)
    })
  }, [])

  const handleSelectTemplate = (id: TemplateId) => {
    setSelectedTemplate(id)
    setFields({})
    setSaved(false)
  }

  const setField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!selectedTemplate) return
    setSaving(true)
    setSaved(false)
    try {
      const res: any = await apiPut('/me/profile', {
        template_id: selectedTemplate,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  const activeTemplate = TEMPLATES.find((t) => t.id === selectedTemplate) ?? null

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center pb-28 px-4 pt-8">
      <div className="w-full max-w-xl">

        {/* Header */}
        <header className="flex items-center gap-3 mb-7">
          <button
            onClick={() => navigate('/admin')}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Volver"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-black">Plantilla activa</h1>
        </header>

        {/* Selector de plantilla */}
        <section className="mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Elige tu plantilla</p>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => {
              const isActive = selectedTemplate === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t.id)}
                  className={[
                    'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all',
                    isActive
                      ? 'border-intap-mint bg-intap-mint/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25',
                  ].join(' ')}
                >
                  <span className="text-xl leading-none">{t.icon}</span>
                  <span className="text-sm font-bold">{t.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Campos de la plantilla */}
        {!activeTemplate ? (
          <div className="glass-card p-5 text-center text-slate-400 text-sm">
            Elige una plantilla para personalizar este bloque
          </div>
        ) : (
          <section className="glass-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{activeTemplate.icon}</span>
              <h2 className="text-sm font-black text-white">Datos de la plantilla</h2>
            </div>

            {activeTemplate.fields.map((field) => {
              const isTextarea = field.type === 'textarea'
              return (
                <label key={field.key} className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-400">{field.label}</span>
                  {isTextarea ? (
                    <textarea
                      value={fields[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors resize-none"
                    />
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      value={fields[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
                    />
                  )}
                </label>
              )
            })}
          </section>
        )}
      </div>

      {/* Botón guardar sticky */}
      <div className="fixed bottom-0 left-0 right-0 bg-intap-dark/90 backdrop-blur border-t border-white/10 px-4 py-3 flex justify-center">
        <div className="w-full max-w-xl">
          <button
            onClick={handleSave}
            disabled={saving || !selectedTemplate}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold text-sm disabled:opacity-40 transition-opacity shadow-2xl"
          >
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
