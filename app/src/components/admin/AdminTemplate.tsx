import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../lib/api'

const BASE_TEMPLATE_ID = 'intap_profile_v2'

export interface TemplateDef {
  id: string
  label: string
  icon: string
  description: string
  categories: string[]
  fields: []
}

export function getCategoryTemplate(_category: string): TemplateDef {
  return {
    id: BASE_TEMPLATE_ID,
    label: 'Perfil digital INTAP V2',
    icon: '📱',
    description: 'Plantilla base oficial para perfiles digitales INTAP.',
    categories: [],
    fields: [],
  }
}

type TemplateData = Record<string, string>

interface MeData {
  template_id: string | null
  templateData: TemplateData
  name?: string | null
  bio?: string | null
  category?: string | null
}

const FIELD_GROUPS = [
  {
    title: 'Identidad principal',
    description: 'Datos que ayudan a presentar mejor el perfil público.',
    fields: [
      { key: 'title', label: 'Título o cargo', placeholder: 'Ej. Gerente Comercial · Asesor Inmobiliario' },
      { key: 'bioTitle', label: 'Título de la biografía', placeholder: 'Ej. Conoce más sobre mí' },
      { key: 'bio', label: 'Biografía personalizada', placeholder: 'Escribe una presentación breve y profesional.', type: 'textarea' },
    ],
  },
  {
    title: 'Empresa',
    description: 'Información que se mostrará en la sección “Sobre la empresa”.',
    fields: [
      { key: 'companyName', label: 'Nombre de la empresa', placeholder: 'Ej. Constructora JPREZ' },
      { key: 'companyTitle', label: 'Título de la sección empresa', placeholder: 'Ej. Sobre Constructora JPREZ' },
      { key: 'companyLogo', label: 'URL del logo de empresa', placeholder: 'https://...' },
      { key: 'companyAbout', label: 'Texto sobre la empresa', placeholder: 'Describe la empresa, experiencia, misión o propuesta de valor.', type: 'textarea' },
    ],
  },
  {
    title: 'Contacto y ubicación',
    description: 'Datos de contacto usados por los botones y enlaces rápidos.',
    fields: [
      { key: 'phone', label: 'Teléfono principal', placeholder: 'Ej. 8091234567' },
      { key: 'whatsapp', label: 'WhatsApp', placeholder: 'Ej. 18091234567' },
      { key: 'email', label: 'Correo electrónico', placeholder: 'correo@empresa.com' },
      { key: 'website', label: 'Página web', placeholder: 'www.empresa.com' },
      { key: 'address', label: 'Dirección', placeholder: 'Av. Principal 123, Santo Domingo' },
      { key: 'mapUrl', label: 'URL de Google Maps', placeholder: 'https://maps.google.com/...' },
    ],
  },
  {
    title: 'Secciones del perfil',
    description: 'Textos visibles en bloques como galería, servicios y preguntas frecuentes.',
    fields: [
      { key: 'galleryTitle', label: 'Título de galería o proyectos', placeholder: 'Ej. Proyectos destacados' },
      { key: 'servicesTitle', label: 'Título de servicios', placeholder: 'Ej. Soluciones y servicios' },
      { key: 'faqTitle', label: 'Título de preguntas frecuentes', placeholder: 'Ej. Preguntas frecuentes' },
    ],
  },
  {
    title: 'Chat WhatsApp',
    description: 'Texto del asistente flotante del perfil.',
    fields: [
      { key: 'chatTitle', label: 'Nombre del asistente', placeholder: 'Ej. Asistente de ventas' },
      { key: 'chatText', label: 'Mensaje inicial', placeholder: 'Hola 👋 ¿En qué puedo ayudarte hoy?', type: 'textarea' },
      { key: 'chatMessage', label: 'Mensaje precargado para WhatsApp', placeholder: 'Hola, vi tu perfil digital y necesito más información.', type: 'textarea' },
    ],
  },
]

export default function AdminTemplate() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [fields, setFields] = useState<TemplateData>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (json.ok) {
        const d = json.data as MeData
        setMe(d)
        setFields(d.templateData ?? {})
      }
      setLoading(false)
    })
  }, [])

  const setField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const res: any = await apiPut('/me/profile', {
        template_id: BASE_TEMPLATE_ID,
        template_data: fields,
      })

      if (res.ok) {
        setMe((prev) => prev ? { ...prev, template_id: BASE_TEMPLATE_ID, templateData: fields } : prev)
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

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <header className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/admin')} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black">Plantilla base del perfil</h1>
            <p className="text-xs text-slate-400 mt-1">
              Esta es la plantilla oficial activa para tu perfil público.
            </p>
          </div>
        </header>

        <div className="glass-card p-5 mb-5 border-intap-mint/20 bg-intap-mint/5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <p className="text-sm font-black text-white">Perfil digital INTAP V2</p>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                La plantilla de tu perfil público ya no se elige por categoría. Ahora todos los perfiles usan una base clara,
                editable y preparada para foto o logo, datos de contacto, biografía, empresa, servicios, galería, FAQ y WhatsApp.
              </p>
              <p className="text-[11px] text-intap-mint font-bold mt-3">
                Estado: {me?.template_id === BASE_TEMPLATE_ID ? 'Activa en este perfil' : 'Se activará al guardar'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {FIELD_GROUPS.map((group) => (
            <section key={group.title} className="glass-card p-5">
              <div className="mb-5">
                <h2 className="text-sm font-black text-white">{group.title}</h2>
                <p className="text-xs text-slate-400 mt-1">{group.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.fields.map((field) => {
                  const isTextarea = field.type === 'textarea'

                  return (
                    <label key={field.key} className={isTextarea ? 'md:col-span-2' : ''}>
                      <span className="block text-xs font-bold text-slate-400 mb-1.5">{field.label}</span>
                      {isTextarea ? (
                        <textarea
                          value={fields[field.key] ?? ''}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors resize-none"
                        />
                      ) : (
                        <input
                          value={fields[field.key] ?? ''}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
                        />
                      )}
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="sticky bottom-4 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold text-sm disabled:opacity-50 transition-opacity shadow-2xl"
          >
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar plantilla base'}
          </button>
        </div>
      </div>
    </div>
  )
}
