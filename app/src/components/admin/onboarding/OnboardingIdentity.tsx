import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPut } from '../../../lib/api'

export default function OnboardingIdentity() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isOnboarding = window.location.pathname.includes('onboarding')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const body: Record<string, string> = {}
      if (name.trim())      body.name       = name.trim()
      if (bio.trim())       body.bio        = bio.trim()
      if (avatarUrl.trim()) body.avatar_url = avatarUrl.trim()

      const json: any = await apiPut('/me/profile', body)
      if (json.ok) {
        navigate(isOnboarding ? '/admin/onboarding/contact' : '/admin')
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
        {isOnboarding && (
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={`h-1 flex-1 rounded-full ${step <= 3 ? 'bg-intap-mint' : 'bg-white/10'}`} />
            ))}
          </div>
        )}

        <div className="mb-6">
          {isOnboarding && <p className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-2">Paso 3 de 4</p>}
          <h1 className="text-2xl font-black mb-1">Tu identidad</h1>
          <p className="text-sm text-slate-400">Cómo apareces en tu perfil público</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre o marca"
              maxLength={80}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Descripción corta de lo que haces…"
              maxLength={300}
              rows={3}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors resize-none"
            />
            <p className="text-[10px] text-slate-600 text-right">{bio.length}/300</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">URL de foto (opcional)</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Guardando…' : isOnboarding ? 'Continuar →' : 'Guardar cambios'}
          </button>

          {isOnboarding && (
            <button
              type="button"
              onClick={() => navigate('/admin/onboarding/contact')}
              className="text-xs text-slate-500 hover:text-white text-center transition-colors"
            >
              Omitir por ahora
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
