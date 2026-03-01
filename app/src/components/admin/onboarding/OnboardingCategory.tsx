import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPut } from '../../../lib/api'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) return
    setLoading(true)
    setError('')
    try {
      const json: any = await apiPut('/me/profile', { category, subcategory: subcategory.trim() || undefined })
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
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-sm">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className={`h-1 flex-1 rounded-full ${step <= 2 ? 'bg-intap-mint' : 'bg-white/10'}`} />
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
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {category && (
            <div className="glass-card p-4 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Especialidad (opcional)
              </label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder={`Ej. ${category === 'Tecnología' ? 'Desarrollo web' : 'Especialidad'}`}
                maxLength={60}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
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
            className="text-xs text-slate-500 hover:text-white text-center transition-colors"
          >
            Omitir por ahora
          </button>
        </form>
      </div>
    </div>
  )
}
