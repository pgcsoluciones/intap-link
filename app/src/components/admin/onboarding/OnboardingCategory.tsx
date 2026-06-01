import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPut } from '../../../lib/api'
import { getCategoryTemplate } from '../AdminTemplate'

const SECTORS = [
  'Moda y Accesorios', 'Salud y Bienestar', 'Belleza y Estética',
  'Gastronomía y Restaurantes', 'Tecnología', 'Educación y Formación',
  'Arte y Diseño', 'Deportes y Fitness', 'Turismo y Viajes',
  'Entretenimiento', 'Consultoría y Servicios Profesionales',
  'Construcción y Hogar', 'Automotriz', 'Agropecuario', 'Retail', 'Otros',
]

export default function OnboardingCategory() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const suggested = category ? getCategoryTemplate(category) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) return
    setLoading(true)
    setError('')
    try {
      const patch: any = { category, subcategory: subcategory.trim() || undefined }
      if (suggested) patch.template_id = suggested.id
      const json: any = await apiPut('/me/profile', patch)
      if (json.ok) {
        navigate('/admin/onboarding/identity')
      } else {
        setError(json.error || 'Error al guardar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-sm">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className={`h-1 flex-1 rounded-full ${step <= 2 ? 'bg-intap-mint' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="mb-6">
          <p className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-2">Paso 2 de 4</p>
          <h1 className="text-2xl font-black mb-1">¿A qué te dedicas?</h1>
          <p className="text-sm text-slate-400">Elige el sector que mejor describe tu actividad</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCategory(s)}
                className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                  category === s
                    ? 'bg-intap-mint/20 border-intap-mint text-intap-mint'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {suggested && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-base">{suggested.icon}</span>
              <p className="text-xs text-intap-mint">
                Se aplicará la plantilla <span className="font-bold">{suggested.label}</span> automáticamente
              </p>
            </div>
          )}

          {category && (
            <div className="glass-card p-4 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Especialidad (opcional)
              </label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder={`Ej. ${category === 'Tecnología' ? 'Desarrollo web' : 'Especialidad'}`}
                maxLength={60}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-intap-mint/50 transition-colors"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={!category || loading}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Guardando…' : 'Continuar →'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/onboarding/identity')}
            className="text-xs text-slate-500 hover:text-slate-900 text-center transition-colors"
          >
            Omitir por ahora
          </button>
        </form>
      </div>
    </div>
  )
}
