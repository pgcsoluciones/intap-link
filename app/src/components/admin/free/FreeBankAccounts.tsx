import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost, apiPut } from '../../../lib/api'
import { FreeBackButton, basicPlanWhatsAppUrl } from './FreePanelUi'

type HolderIdType = 'cedula' | 'rnc'

type BankAccount = {
  id: string
  bank_code: string | null
  bank_name: string
  account_number: string
  display_number: string
  account_type: 'savings' | 'checking'
  currency: 'DOP' | 'USD'
  holder_name: string
  holder_id_type: HolderIdType | null
  holder_id_number: string
  display_mode: 'masked' | 'visible'
  is_active: boolean
}

type Access = {
  allowed: boolean
  source: 'plan' | 'fair' | null
  locked_reason?: string
}

type FormState = {
  bank_code: string
  bank_name: string
  account_number: string
  account_type: 'savings' | 'checking'
  currency: 'DOP' | 'USD'
  holder_name: string
  holder_id_type: HolderIdType
  holder_id_number: string
  display_mode: 'masked' | 'visible'
}

const BANKS = [
  { code: 'vimenca', name: 'Banco Vimenca' },
  { code: 'promerica', name: 'Banco Promerica' },
  { code: 'popular', name: 'Banco Popular Dominicano' },
  { code: 'bdi', name: 'Banco BDI' },
  { code: 'santa-cruz', name: 'Banco Santa Cruz' },
  { code: 'bhd-leon', name: 'Banco BHD León' },
  { code: 'ademi', name: 'Banco Ademi' },
  { code: 'banesco', name: 'Banesco' },
  { code: 'scotiabank', name: 'Scotiabank República Dominicana' },
  { code: 'la-nacional', name: 'La Nacional Ahorros y Préstamos' },
  { code: 'banreservas', name: 'Banco de Reservas' },
  { code: 'citi', name: 'Citi' },
  { code: 'caribe', name: 'Banco Caribe' },
  { code: 'lopez-de-haro', name: 'Banco López de Haro' },
  { code: 'bellbank', name: 'Bellbank' },
  { code: 'activo-dominicana', name: 'Banco Múltiple Activo Dominicana' },
  { code: 'lafise', name: 'Banco LAFISE' },
  { code: 'asociacion-cibao', name: 'Asociación Cibao de Ahorros y Préstamos' },
  { code: 'otro', name: 'Otro banco' },
]

const EMPTY_FORM: FormState = {
  bank_code: 'popular',
  bank_name: 'Banco Popular Dominicano',
  account_number: '',
  account_type: 'savings',
  currency: 'DOP',
  holder_name: '',
  holder_id_type: 'cedula',
  holder_id_number: '',
  display_mode: 'masked',
}

function bankInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'B'
}

export default function FreeBankAccounts() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [access, setAccess] = useState<Access>({ allowed: false, source: null })
  const [enabled, setEnabled] = useState(true)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const remaining = useMemo(() => Math.max(0, 3 - accounts.length), [accounts.length])
  const missingFields = useMemo(() => {
    const missing: string[] = []
    if (!form.bank_name.trim()) missing.push('banco')
    if (form.account_number.replace(/\s+/g, '').length < 4) missing.push('número de cuenta')
    if (!form.holder_name.trim()) missing.push('titular')
    if (!form.holder_id_type) missing.push('tipo de identificación')
    if (form.holder_id_number.replace(/\D/g, '').length < 9) missing.push(form.holder_id_type === 'rnc' ? 'RNC' : 'cédula')
    return missing
  }, [form])

  async function load() {
    setLoading(true)
    try {
      const json: any = await apiGet('/me/bank-accounts')
      if (json?.ok) {
        setAccess(json.data?.access || { allowed: false, source: null })
        setEnabled(json.data?.enabled !== false)
        setAccounts(Array.isArray(json.data?.items) ? json.data.items : [])
      } else {
        setMessage(json?.error || 'No se pudo cargar esta sección.')
      }
    } catch {
      setMessage('No se pudo cargar esta sección.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function selectBank(code: string) {
    const bank = BANKS.find((item) => item.code === code) || BANKS[0]
    setForm((current) => ({ ...current, bank_code: bank.code, bank_name: bank.name }))
  }

  function startEdit(account: BankAccount) {
    setEditingId(account.id)
    setForm({
      bank_code: account.bank_code || 'otro',
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_type: account.account_type,
      currency: account.currency,
      holder_name: account.holder_name,
      holder_id_type: account.holder_id_type || 'cedula',
      holder_id_number: account.holder_id_number || '',
      display_mode: account.display_mode,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function saveAccount() {
    if (saving) return
    if (missingFields.length > 0) {
      setMessage(`⚠ Completa antes de guardar: ${missingFields.join(', ')}.`)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        ...form,
        account_number: form.account_number.replace(/\s+/g, ''),
        holder_id_number: form.holder_id_number.replace(/\D/g, ''),
      }
      const json: any = editingId
        ? await apiPut(`/me/bank-accounts/${editingId}`, payload)
        : await apiPost('/me/bank-accounts', payload)
      if (!json?.ok) {
        setMessage(`⚠ ${json?.error || 'No se pudo guardar la cuenta.'}`)
        return
      }
      setMessage(editingId ? '✓ Cuenta actualizada' : '✓ Cuenta agregada')
      resetForm()
      await load()
    } catch {
      setMessage('⚠ No se pudo guardar la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleSection() {
    if (!access.allowed || saving) return
    setSaving(true)
    setMessage('')
    const next = !enabled
    try {
      const json: any = await apiPut('/me/bank-accounts/settings', { enabled: next })
      if (!json?.ok) {
        setMessage(`⚠ ${json?.error || 'No se pudo cambiar la visibilidad.'}`)
        return
      }
      setEnabled(next)
      setMessage(next ? '✓ Sección visible en tu perfil' : '✓ Sección oculta en tu perfil')
    } catch {
      setMessage('⚠ No se pudo cambiar la visibilidad.')
    } finally {
      setSaving(false)
    }
  }

  async function removeAccount(id: string) {
    if (saving || !window.confirm('¿Eliminar esta cuenta bancaria?')) return
    setSaving(true)
    setMessage('')
    try {
      const json: any = await apiDelete(`/me/bank-accounts/${id}`)
      if (!json?.ok) {
        setMessage(`⚠ ${json?.error || 'No se pudo eliminar la cuenta.'}`)
        return
      }
      if (editingId === id) resetForm()
      setMessage('✓ Cuenta eliminada')
      await load()
    } catch {
      setMessage('⚠ No se pudo eliminar la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7f9fc] grid place-items-center"><div className="loading-spinner" /></main>
  }

  if (!access.allowed) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-4 py-5 font-['Inter'] text-slate-950">
        <section className="mx-auto w-full max-w-[620px]">
          <FreeBackButton onClick={() => navigate('/admin/free')} />
          <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-2xl text-white">$</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-violet-700">Función premium</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Cuentas bancarias</h1>
            <p className="mt-3 text-base font-medium leading-7 text-slate-600">Agrega hasta 3 cuentas a tu perfil y permite que tus clientes copien los datos necesarios para hacer una transferencia.</p>
            <div className="mt-5 rounded-2xl bg-violet-50 p-4 text-sm font-semibold leading-6 text-violet-900">Disponible en Plan Plus. Los perfiles Free activados durante la promoción de feria conservan esta función permanentemente.</div>
            <a href={basicPlanWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="mt-5 flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-4 text-base font-black text-white">Conocer Plan Plus</a>
            <button type="button" disabled className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-400">Tengo un código promocional · Próximamente</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />

        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">KAWVO LINK</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-[-0.04em]">Cuentas bancarias</h1>
              <p className="mt-2 max-w-xl text-base font-medium leading-7 text-slate-600">Facilita las transferencias: agrega hasta 3 cuentas para que tus clientes copien los datos con un toque.</p>
            </div>
            {access.source === 'fair' && <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Beneficio de feria · Permanente al publicar dentro de la promoción</span>}
          </div>
        </div>

        <section className="mt-5 flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div><p className="text-base font-black">Mostrar en mi perfil</p><p className="mt-1 text-sm font-medium text-slate-500">Puedes ocultar toda la sección sin borrar tus cuentas.</p></div>
          <button type="button" onClick={() => void toggleSection()} disabled={saving} aria-pressed={enabled} className={`relative h-8 w-14 shrink-0 rounded-full transition ${enabled ? 'bg-cyan-600' : 'bg-slate-200'}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${enabled ? 'left-7' : 'left-1'}`} /></button>
        </section>

        {message && <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-black shadow-sm ${message.startsWith('✓') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{message}</p>}

        {(accounts.length < 3 || editingId) && (
          <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">{editingId ? 'Editar cuenta' : 'Agregar cuenta'}</p><h2 className="mt-1 text-xl font-black">{editingId ? 'Actualiza los datos' : `${remaining} ${remaining === 1 ? 'espacio disponible' : 'espacios disponibles'}`}</h2></div>{editingId && <button type="button" onClick={resetForm} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Cancelar</button>}</div>

            {missingFields.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <p className="text-sm font-black">⚠ Faltan datos para guardar esta cuenta</p>
                <p className="mt-1 text-sm font-semibold leading-6">Completa: {missingFields.join(', ')}.</p>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="text-sm font-black text-slate-700">Banco</span><select value={form.bank_code} onChange={(e) => selectBank(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold outline-none focus:border-cyan-400">{BANKS.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label>
              {form.bank_code === 'otro' && <label className="block sm:col-span-2"><span className="text-sm font-black text-slate-700">Nombre del banco</span><input value={form.bank_name} onChange={(e) => setForm((current) => ({ ...current, bank_name: e.target.value }))} maxLength={80} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-cyan-400" /></label>}
              <label className="block sm:col-span-2"><span className="text-sm font-black text-slate-700">Número de cuenta</span><input value={form.account_number} onChange={(e) => setForm((current) => ({ ...current, account_number: e.target.value.replace(/[^0-9A-Za-z ]/g, '') }))} inputMode="numeric" autoComplete="off" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold tracking-wide outline-none focus:border-cyan-400" /></label>
              <label className="block"><span className="text-sm font-black text-slate-700">Tipo de cuenta</span><select value={form.account_type} onChange={(e) => setForm((current) => ({ ...current, account_type: e.target.value as FormState['account_type'] }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"><option value="savings">Ahorros</option><option value="checking">Corriente</option></select></label>
              <label className="block"><span className="text-sm font-black text-slate-700">Moneda</span><select value={form.currency} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value as FormState['currency'] }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"><option value="DOP">Peso dominicano (DOP)</option><option value="USD">Dólar (USD)</option></select></label>
              <label className="block sm:col-span-2"><span className="text-sm font-black text-slate-700">Titular</span><input value={form.holder_name} onChange={(e) => setForm((current) => ({ ...current, holder_name: e.target.value }))} maxLength={120} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-cyan-400" /></label>
              <label className="block"><span className="text-sm font-black text-slate-700">Identificación del titular</span><select value={form.holder_id_type} onChange={(e) => setForm((current) => ({ ...current, holder_id_type: e.target.value as HolderIdType, holder_id_number: '' }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"><option value="cedula">Cédula</option><option value="rnc">RNC</option></select></label>
              <label className="block"><span className="text-sm font-black text-slate-700">Número de {form.holder_id_type === 'rnc' ? 'RNC' : 'cédula'}</span><input value={form.holder_id_number} onChange={(e) => setForm((current) => ({ ...current, holder_id_number: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" autoComplete="off" placeholder={form.holder_id_type === 'rnc' ? 'Solo números' : 'Solo números'} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold tracking-wide outline-none focus:border-cyan-400" /></label>
              <p className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">La Cédula/RNC no se mostrará en pantalla pública. El visitante solo verá un botón para copiarla cuando necesite hacer la transferencia.</p>
              <div className="sm:col-span-2"><p className="text-sm font-black text-slate-700">Cómo mostrar el número de cuenta</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm((current) => ({ ...current, display_mode: 'masked' }))} className={`rounded-2xl border p-3 text-left ${form.display_mode === 'masked' ? 'border-cyan-500 bg-cyan-50 ring-4 ring-cyan-100' : 'border-slate-200'}`}><span className="block text-sm font-black">Oculto</span><span className="mt-1 block text-xs text-slate-500">XXXX XXXX 0236</span></button><button type="button" onClick={() => setForm((current) => ({ ...current, display_mode: 'visible' }))} className={`rounded-2xl border p-3 text-left ${form.display_mode === 'visible' ? 'border-cyan-500 bg-cyan-50 ring-4 ring-cyan-100' : 'border-slate-200'}`}><span className="block text-sm font-black">Visible</span><span className="mt-1 block text-xs text-slate-500">Número completo</span></button></div></div>
            </div>

            <button type="button" onClick={() => void saveAccount()} disabled={saving} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar cuenta'}</button>
          </section>
        )}

        <section className="mt-5 space-y-3">
          {accounts.map((account) => (
            <article key={account.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">{bankInitials(account.bank_name)}</div>
                <div className="min-w-0 flex-1"><h3 className="truncate text-base font-black">{account.bank_name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wide text-cyan-700">{account.account_type === 'savings' ? 'Ahorros' : 'Corriente'} · {account.currency}</p><p className="mt-3 text-sm font-bold text-slate-900">{account.holder_name}</p><p className="mt-1 font-mono text-sm font-bold tracking-wide text-slate-500">{account.display_number}</p><p className="mt-2 text-xs font-semibold text-slate-400">{account.holder_id_type === 'rnc' ? 'RNC' : 'Cédula'} guardada · no visible públicamente</p></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => startEdit(account)} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-black text-slate-700">Editar</button><button type="button" onClick={() => void removeAccount(account.id)} className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-black text-rose-700">Eliminar</button></div>
            </article>
          ))}
          {accounts.length === 0 && <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-base font-black text-slate-700">Todavía no has agregado cuentas</p><p className="mt-2 text-sm text-slate-500">Cuando agregues una, aparecerá aquí y en tu perfil si la sección está activa.</p></div>}
        </section>
        <div className="mt-6"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>
      </section>
    </main>
  )
}
