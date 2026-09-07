import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type Promotion = {
  id: string
  feature_code: string
  name: string
  target_plan: string
  access_mode: 'all' | 'code' | 'profile'
  promo_code?: string | null
  profile_id?: string | null
  profile_slug?: string | null
  starts_at: string
  ends_at?: string | null
  is_enabled: number | boolean
  is_active_now?: number | boolean
}

const EMPTY = {
  feature_code: 'bank_accounts',
  name: '',
  target_plan: 'free',
  access_mode: 'all' as 'all' | 'code' | 'profile',
  promo_code: '',
  profile_id: '',
  starts_at: '',
  ends_at: '',
}

function localInput(value?: string | null) {
  if (!value) return ''
  return value.replace(' ', 'T').slice(0, 16)
}

function serverDate(value: string) {
  return value ? `${value.replace('T', ' ')}:00` : ''
}

export default function SuperAdminPromotions() {
  const [items, setItems] = useState<Promotion[]>([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const activeCount = useMemo(() => items.filter((item) => Boolean(item.is_active_now)).length, [items])

  const load = async () => {
    setLoading(true)
    const result: any = await apiGet('/superadmin/feature-promotions').catch(() => ({ ok: false }))
    if (result.ok) setItems(result.data || [])
    else setError(result.error || 'No pudimos cargar las promociones.')
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const create = async () => {
    if (saving) return
    if (!form.name.trim()) { setError('Escribe un nombre para la promoción.'); return }
    if (form.access_mode === 'code' && !form.promo_code.trim()) { setError('Indica el código promocional.'); return }
    if (form.access_mode === 'profile' && !form.profile_id.trim()) { setError('Indica el ID del perfil.'); return }

    setSaving(true)
    setError('')
    setMessage('')
    const result: any = await apiPost('/superadmin/feature-promotions', {
      feature_code: form.feature_code,
      name: form.name,
      target_plan: form.target_plan,
      access_mode: form.access_mode,
      promo_code: form.access_mode === 'code' ? form.promo_code : null,
      profile_id: form.access_mode === 'profile' ? form.profile_id : null,
      starts_at: form.starts_at ? serverDate(form.starts_at) : undefined,
      ends_at: form.ends_at ? serverDate(form.ends_at) : null,
    }).catch(() => ({ ok: false, error: 'No pudimos crear la promoción.' }))
    setSaving(false)
    if (!result.ok) { setError(result.error || 'No pudimos crear la promoción.'); return }
    setForm(EMPTY)
    setMessage('Promoción creada correctamente.')
    await load()
  }

  const update = async (item: Promotion, patch: Record<string, unknown>) => {
    setError('')
    setMessage('')
    const result: any = await apiPut(`/superadmin/feature-promotions/${item.id}`, patch)
      .catch(() => ({ ok: false, error: 'No pudimos actualizar la promoción.' }))
    if (!result.ok) { setError(result.error || 'No pudimos actualizar la promoción.'); return }
    setMessage('Promoción actualizada.')
    await load()
  }

  return (
    <SuperAdminLayout currentSection="promotions" onLogout={() => { window.location.href = '/admin/login' }}>
      <div className="mx-auto max-w-6xl space-y-6 text-slate-900">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Funciones temporales</p>
              <h1 className="mt-1 text-3xl font-black">Promociones de funciones Plus</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Habilita una función para usuarios Free por tiempo definido, indefinidamente, por código o para un perfil específico sin cambiar los límites permanentes del plan.</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{activeCount} activas ahora</div>
          </div>
        </section>

        {message && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</p>}
        {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Crear promoción</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold">Función
              <select value={form.feature_code} onChange={(e) => setForm({ ...form, feature_code: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3">
                <option value="bank_accounts">Cuentas bancarias</option>
              </select>
            </label>
            <label className="text-sm font-bold">Nombre de la promoción
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Cuentas bancarias gratis septiembre" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3" />
            </label>
            <label className="text-sm font-bold">Disponible para
              <select value={form.target_plan} onChange={(e) => setForm({ ...form, target_plan: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3"><option value="free">Plan Free</option></select>
            </label>
            <label className="text-sm font-bold">Modo de acceso
              <select value={form.access_mode} onChange={(e) => setForm({ ...form, access_mode: e.target.value as any })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3">
                <option value="all">Todos los Free</option>
                <option value="code">Por código promocional</option>
                <option value="profile">Perfil específico</option>
              </select>
            </label>
            {form.access_mode === 'code' && <label className="text-sm font-bold">Código
              <input value={form.promo_code} onChange={(e) => setForm({ ...form, promo_code: e.target.value.toUpperCase() })} placeholder="KAWVOFREE" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-mono uppercase" />
            </label>}
            {form.access_mode === 'profile' && <label className="text-sm font-bold">ID del perfil
              <input value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })} placeholder="profile_id" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-mono" />
            </label>}
            <label className="text-sm font-bold">Disponible desde
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3" />
              <span className="mt-1 block text-xs font-medium text-slate-500">Vacío = desde ahora.</span>
            </label>
            <label className="text-sm font-bold">Disponible hasta
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3" />
              <span className="mt-1 block text-xs font-medium text-slate-500">Vacío = indefinida.</span>
            </label>
          </div>
          <button type="button" disabled={saving} onClick={() => void create()} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? 'Creando…' : 'Crear promoción'}</button>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Promociones configuradas</h2>
          {loading ? <p className="mt-4 text-sm text-slate-500">Cargando…</p> : (
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black">{item.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.is_active_now ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.is_active_now ? 'Activa' : item.is_enabled ? 'Programada / vencida' : 'Desactivada'}</span>
                      </div>
                      <p className="mt-1 text-xs font-mono text-slate-500">{item.feature_code} · {item.target_plan} · {item.access_mode}</p>
                      {item.promo_code && <p className="mt-1 text-xs font-bold text-cyan-700">Código: {item.promo_code}</p>}
                      {item.profile_slug && <p className="mt-1 text-xs font-bold text-cyan-700">Perfil: /{item.profile_slug}</p>}
                      <p className="mt-2 text-xs text-slate-500">Desde {item.starts_at} · Hasta {item.ends_at || 'indefinida'}</p>
                    </div>
                    <button type="button" onClick={() => void update(item, { is_enabled: !Boolean(item.is_enabled) })} className={`rounded-xl px-4 py-2 text-xs font-black ${item.is_enabled ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'bg-slate-950 text-white'}`}>{item.is_enabled ? 'Desactivar' : 'Activar'}</button>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">Cambiar fecha final
                      <input type="datetime-local" defaultValue={localInput(item.ends_at)} onBlur={(e) => void update(item, { ends_at: e.target.value ? serverDate(e.target.value) : null })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                      <span className="mt-1 block font-medium text-slate-400">Déjalo vacío para indefinida.</span>
                    </label>
                  </div>
                </article>
              ))}
              {items.length === 0 && <p className="text-sm text-slate-500">Todavía no hay promociones.</p>}
            </div>
          )}
        </section>
      </div>
    </SuperAdminLayout>
  )
}
