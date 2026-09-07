import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'
import { FreeBackButton, FreeUpgradeCard } from '../FreePanelUi'

const RD_AREA_CODES = /^(809|829|849)/

function normalizePhone(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  const hadPlus = value.startsWith('+')
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10 && RD_AREA_CODES.test(digits)) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1') && RD_AREA_CODES.test(digits.slice(1))) return `+${digits}`
  if (hadPlus && digits.length >= 7 && digits.length <= 15) return `+${digits}`
  return digits.length >= 7 && digits.length <= 15 ? digits : null
}

export default function FreeOnboardingContact() {
  const navigate = useNavigate()
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [teamMember, setTeamMember] = useState(false)
  const [teamPermissions, setTeamPermissions] = useState<string[]>([])
  const [masterName, setMasterName] = useState('')

  useEffect(() => {
    Promise.all([
      apiGet('/me/contact'),
      apiGet('/me/team/context').catch(() => ({ ok: false })),
    ]).then(([json, teamJson]: any[]) => {
      if (json?.ok && json.data) {
        setWhatsapp(json.data.whatsapp || '')
        setEmail(json.data.email || '')
        setPhone(json.data.phone || '')
      }
      if (teamJson?.ok && teamJson.data?.role === 'member') {
        setTeamMember(true)
        setTeamPermissions(teamJson.data?.member?.permissions || [])
        setMasterName(String(teamJson.data?.member?.master_name || 'perfil master'))
      }
    }).finally(() => setLoading(false))
  }, [])

  const canEdit = (field: 'whatsapp' | 'email' | 'phone') => !teamMember || teamPermissions.includes(field)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    const editableWhatsapp = canEdit('whatsapp')
    const editablePhone = canEdit('phone')
    const editableEmail = canEdit('email')
    if (!teamMember && !whatsapp.trim() && !phone.trim()) {
      setError('Agrega al menos WhatsApp o un teléfono.')
      return
    }

    const normalizedWhatsApp = editableWhatsapp && whatsapp.trim() ? normalizePhone(whatsapp) : null
    const normalizedPhone = editablePhone && phone.trim() ? normalizePhone(phone) : null
    if (editableWhatsapp && whatsapp.trim() && !normalizedWhatsApp) { setError('Revisa el número de WhatsApp.'); return }
    if (editablePhone && phone.trim() && !normalizedPhone) { setError('Revisa el número de teléfono.'); return }

    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (editableWhatsapp && normalizedWhatsApp) body.whatsapp_number = normalizedWhatsApp
      if (editableEmail) body.email = email.trim()
      if (editablePhone && normalizedPhone) body.phone = normalizedPhone
      if (Object.keys(body).length === 0) {
        navigate('/admin/free', { replace: true })
        return
      }
      const result: any = await apiPut('/me/contact', body)
      if (result.ok) navigate('/admin/free', { replace: true })
      else setError(result.error || 'No pudimos guardar tus datos.')
    } catch {
      setError('No pudimos conectar. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  const fields = [
    { key: 'whatsapp' as const, label: 'WhatsApp', value: whatsapp, setValue: setWhatsapp, placeholder: '809 123 4567', type: 'tel' },
    { key: 'phone' as const, label: 'Teléfono', value: phone, setValue: setPhone, placeholder: '809 000 0000', type: 'tel' },
    { key: 'email' as const, label: 'Correo', value: email, setValue: setEmail, placeholder: 'tu@email.com', type: 'email' },
  ]

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-5 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[430px] py-1">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">Cómo pueden contactarte</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">{teamMember ? `Solo puedes modificar los datos autorizados por ${masterName}.` : 'Actualiza tus datos principales. Los números dominicanos se guardan automáticamente con +1.'}</p>
        {teamMember && <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">Amarillo: editable · Gris: administrado por Team.</div>}

        <form onSubmit={handleSubmit} className="mt-7 space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          {fields.map(({ key, label, value, setValue, placeholder, type }) => {
            const editable = canEdit(key)
            return <label key={key} className={`block rounded-2xl p-3 ${editable ? 'bg-amber-50/50' : 'bg-slate-100'}`}>
              <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-slate-600"><span>{label}</span>{teamMember && <span className={editable ? 'text-amber-700' : 'text-slate-400'}>{editable ? 'Editable' : 'Bloqueado'}</span>}</span>
              <input type={type} value={value} onChange={(e) => setValue(e.target.value)} disabled={!editable} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-cyan-400 disabled:bg-slate-100 disabled:text-slate-400" />
            </label>
          })}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
          <button type="submit" disabled={saving} className="mt-2 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </form>
        {!teamMember && <div className="mt-5"><FreeUpgradeCard compact /></div>}
        <div className="mt-4"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>
      </section>
    </main>
  )
}
