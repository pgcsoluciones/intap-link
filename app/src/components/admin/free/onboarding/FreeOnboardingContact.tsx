import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'

function normalizeWhatsApp(input: string): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`
  return null
}

export default function FreeOnboardingContact() {
  const navigate = useNavigate()
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/me/contact').then((json: any) => {
      if (!json.ok || !json.data) return
      setWhatsapp(json.data.whatsapp || '')
      setEmail(json.data.email || '')
      setPhone(json.data.phone || '')
    }).finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!whatsapp.trim() && !phone.trim()) {
      setError('Agrega al menos WhatsApp o un teléfono.')
      return
    }
    if (whatsapp && !normalizeWhatsApp(whatsapp)) {
      setError('Revisa el número de WhatsApp.')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (whatsapp) body.whatsapp_number = whatsapp.trim()
      if (email) body.email = email.trim()
      if (phone) body.phone = phone.trim()
      const result: any = await apiPut('/me/contact', body)
      if (result.ok) navigate('/admin/free/onboarding/done')
      else setError(result.error || 'No pudimos guardar tus datos.')
    } catch {
      setError('No pudimos conectar. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[430px] py-4">
        <div className="mb-8 flex gap-2" aria-label="Paso 4 de 4">
          {[1, 2, 3, 4].map((step) => <span key={step} className="h-1.5 flex-1 rounded-full bg-cyan-500" />)}
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-600">Paso 4 de 4</p>
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">Cómo pueden contactarte</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Agrega tus datos principales. Podrás completar otros detalles más adelante.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          {[
            { label: 'WhatsApp', value: whatsapp, setValue: setWhatsapp, placeholder: '809 123 4567', type: 'tel' },
            { label: 'Teléfono', value: phone, setValue: setPhone, placeholder: '+1 809 000 0000', type: 'tel' },
            { label: 'Correo', value: email, setValue: setEmail, placeholder: 'tu@email.com', type: 'email' },
          ].map(({ label, value, setValue, placeholder, type }) => (
            <label key={label} className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
              <input type={type} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
            </label>
          ))}

          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
          <button type="submit" disabled={saving} className="mt-2 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35">{saving ? 'Guardando…' : 'Finalizar'}</button>
        </form>
      </section>
    </main>
  )
}
