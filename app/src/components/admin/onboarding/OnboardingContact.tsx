import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'

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
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [hours, setHours]       = useState('')
  const [address, setAddress]   = useState('')
  const [mapUrl, setMapUrl]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [step, setStep] =
    useState<'form' | 'success'>('form')

  const isOnboarding = window.location.pathname.includes('onboarding')

  // Load existing contact data
  useEffect(() => {
    apiGet('/me/contact').then((json: any) => {
      if (json.ok && json.data) {
        const d = json.data
        setWhatsapp(d.whatsapp || '')
        setEmail(d.email       || '')
        setPhone(d.phone       || '')
        setHours(d.hours       || '')
        setAddress(d.address   || '')
        setMapUrl(d.map_url    || '')
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (whatsapp) {
      const normalized = normalizeWhatsApp(whatsapp)

      if (!normalized) {
        setError(
          'WhatsApp inválido. Ej: 8091234567 o +1 809 123 4567',
        )
        return
      }
    }

    if (!whatsapp.trim() && !phone.trim()) {
      setError(
        'Agrega al menos un teléfono, celular o WhatsApp.',
      )
      return
    }

    setSaving(true)
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
        if (isOnboarding) {
          setStep('success')
        } else {
          navigate('/admin')
        }
      } else {
        setError(json.error || 'Error al guardar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] flex flex-col items-center justify-center py-10 px-4">
        <div className="w-full max-w-sm flex flex-col gap-5">
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>

            <h1 className="text-2xl font-black mb-2">
              Datos base guardados
            </h1>

            <p className="text-sm text-slate-500">
              Tu perfil permanece como borrador hasta que
              completes los requisitos mínimos para publicarlo.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
              Continúa completando
            </p>

            {[
              '2 acciones o enlaces rápidos',
              '3 imágenes de portafolio',
              '2 servicios completos',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm text-slate-700"
              >
                <span className="w-6 h-6 rounded-full bg-intap-mint/10 text-intap-mint flex items-center justify-center text-xs font-black">
                  ○
                </span>

                <span>{item}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/links')}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm"
          >
            Continuar con mis enlaces →
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="w-full bg-white border border-slate-200 text-slate-600 font-bold py-3 rounded-xl text-sm"
          >
            Completar después
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-sm">
        {isOnboarding && (
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="h-1 flex-1 rounded-full bg-intap-mint" />
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-intap-mint/50 transition-colors"
              />
            </div>
          ))}

          <p className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
            Para publicar necesitas al menos un teléfono,
            celular o WhatsApp.
          </p>

          {error && (
            <p className="text-xs text-red-400 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
          >
            {saving
              ? 'Guardando…'
              : isOnboarding
                ? 'Guardar y continuar →'
                : 'Guardar cambios'}
          </button>

          {isOnboarding && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="text-xs text-slate-500 hover:text-slate-900 text-center transition-colors"
            >
              Completar después — el perfil quedará como borrador
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
