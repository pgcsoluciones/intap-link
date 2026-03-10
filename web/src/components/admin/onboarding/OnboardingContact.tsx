import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPut } from '../../../lib/api'

function normalizeWhatsApp(input: string): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1') && /^(809|829|849)/.test(digits.slice(1))) return `+${digits}`
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`
  return null
}

export default function OnboardingContact() {
  const navigate = useNavigate()
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [hours, setHours] = useState('')
  const [address, setAddress] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isOnboarding = window.location.pathname.includes('onboarding')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (whatsapp) {
      const normalized = normalizeWhatsApp(whatsapp)
      if (!normalized) { setError('WhatsApp inválido. Ej: 8091234567 o +1 809 123 4567'); return }
    }

    setLoading(true)
    try {
      const body: Record<string, string> = {}
      if (whatsapp)  body.whatsapp_number = whatsapp
      if (email)     body.email    = email.trim()
      if (phone)     body.phone    = phone.trim()
      if (hours)     body.hours    = hours.trim()
      if (address)   body.address  = address.trim()
      if (mapUrl)    body.map_url  = mapUrl.trim()

      const json: any = await apiPut('/me/contact', body)
      if (json.ok) {
        navigate(isOnboarding ? '/admin' : '/admin')
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
              <div key={step} className="h-1 flex-1 rounded-full bg-intap-mint" />
            ))}
          </div>
        )}

        <div className="mb-6">
          {isOnboarding && <p className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-2">Paso 4 de 4</p>}
          <h1 className="text-2xl font-black mb-1">Datos de contacto</h1>
          <p className="text-sm text-slate-400">Aparecen en el modal de contacto de tu perfil</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">
          {(
            [
              { label: 'WhatsApp', value: whatsapp, set: setWhatsapp, placeholder: '809 123 4567', type: 'tel' },
              { label: 'Email', value: email, set: setEmail, placeholder: 'tu@email.com', type: 'email' },
              { label: 'Teléfono', value: phone, set: setPhone, placeholder: '+1 809 000 0000', type: 'tel' },
              { label: 'Horario', value: hours, set: setHours, placeholder: 'Lun–Vie 9am–6pm', type: 'text' },
              { label: 'Dirección', value: address, set: setAddress, placeholder: 'Calle, Ciudad', type: 'text' },
              { label: 'URL del mapa', value: mapUrl, set: setMapUrl, placeholder: 'https://maps.app.goo.gl/...', type: 'url' },
            ] as const
          ).map(({ label, value, set, placeholder, type }) => (
            <div key={label} className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
              />
            </div>
          ))}

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Guardando…' : isOnboarding ? 'Finalizar onboarding →' : 'Guardar cambios'}
          </button>

          {isOnboarding && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
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
