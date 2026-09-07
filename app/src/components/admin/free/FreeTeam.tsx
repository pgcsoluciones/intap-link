import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

const PERMISSIONS = [
  ['name', 'Nombre'],
  ['role', 'Cargo'],
  ['photo', 'Foto'],
  ['phone', 'Teléfonos'],
  ['email', 'Correo'],
  ['whatsapp', 'WhatsApp'],
  ['portfolio', 'Portafolio'],
  ['services', 'Servicios'],
  ['links', 'Enlaces'],
  ['quick_actions', 'Botones directos'],
  ['location', 'Ubicación'],
  ['design', 'Diseño, plantilla y colores'],
] as const

type CodeRow = {
  id: string
  code: string
  status: string
  permissions?: string[]
  expires_at?: string
  used_at?: string | null
  created_at?: string
  used_by_email?: string | null
  member_name?: string | null
  member_slug?: string | null
  product_code?: string | null
  product_type?: string | null
}

type TeamPayload = {
  team: { id: string; master_profile_id: string; name: string; status: string }
  codes: CodeRow[]
  pagination: { page: number; page_size: number; total: number; pages: number }
  member_count: number
}

function statusLabel(status: string) {
  if (status === 'used') return 'Usado'
  if (status === 'expired') return 'Caducado'
  if (status === 'disabled') return 'Desactivado'
  return 'Activo'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function FreeTeam() {
  const navigate = useNavigate()
  const [data, setData] = useState<TeamPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [count, setCount] = useState(1)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [teamName, setTeamName] = useState('')
  const [savedTeamName, setSavedTeamName] = useState('')
  const [permissions, setPermissions] = useState<string[]>(['name', 'role', 'photo', 'phone', 'email', 'whatsapp'])
  const [generated, setGenerated] = useState<Array<{ code: string }>>([])

  const load = async (nextPage = page, q = query) => {
    setLoading(true)
    const context: any = await apiGet('/me/team/context').catch(() => ({ ok: false }))
    if (context?.ok && context.data?.role === 'member') {
      navigate('/admin/free/team/member', { replace: true })
      return
    }
    const json: any = await apiGet(`/me/team?page=${nextPage}&q=${encodeURIComponent(q)}`).catch(() => ({ ok: false }))
    if (!json?.ok) setError(json?.error || 'No pudimos abrir Team.')
    else {
      setData(json.data)
      setPage(json.data?.pagination?.page || nextPage)
      const currentName = String(json.data?.team?.name || '').trim()
      setTeamName(currentName)
      setSavedTeamName(currentName)
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => { void load(1, '') }, [])

  const saveTeamName = async () => {
    const name = teamName.trim().replace(/\s+/g, ' ')
    if (name.length < 2) { setError('Escribe un nombre para identificar tu Team.'); return }
    if (nameSaving) return
    setNameSaving(true); setError(''); setMessage('')
    const json: any = await apiPut('/me/team/name', { name }).catch(() => ({ ok: false }))
    setNameSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos guardar el nombre del Team.')
    setTeamName(json.data?.name || name)
    setSavedTeamName(json.data?.name || name)
    setMessage('Nombre del Team guardado. Este será el nombre que verán al validar tus códigos.')
  }

  const togglePermission = (key: string) => {
    if (key === 'name' || key === 'role') return
    setPermissions((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  const createCodes = async () => {
    if (saving) return
    const currentName = savedTeamName.trim()
    if (currentName.length < 2) { setError('Primero asigna un nombre a tu Team.'); return }
    if (teamName.trim() !== savedTeamName.trim()) { setError('Guarda el nombre del Team antes de generar códigos.'); return }
    setSaving(true); setError(''); setMessage(''); setGenerated([])
    const json: any = await apiPost('/me/team/codes', { count, permissions }).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos generar los códigos.')
    setGenerated(json.data || [])
    setMessage(`${(json.data || []).length} código(s) generado(s) para ${savedTeamName}. Cada código es válido durante 24 horas y solo puede utilizarse una vez.`)
    await load(1, query)
  }

  const action = async (row: CodeRow, type: 'deactivate' | 'reactivate') => {
    if (saving) return
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiPost(`/me/team/codes/${row.id}/${type}`, {}).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos actualizar el código.')
    setMessage(type === 'reactivate' ? 'Código reactivado por 24 horas.' : 'Código desactivado.')
    await load(page, query)
  }

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(`Código ${value} copiado.`) } catch { setMessage('No pudimos copiar el código.') }
  }

  const selectedLabels = useMemo(() => PERMISSIONS.filter(([key]) => permissions.includes(key)).map(([, label]) => label), [permissions])
  const nameChanged = teamName.trim() !== savedTeamName.trim()
  const canGenerate = savedTeamName.trim().length >= 2 && !nameChanged

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[920px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">KAWVO LINK · TEAM</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">Equipo de trabajo</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Genera códigos de vinculación para conectar dispositivos a tu perfil master y define qué puede editar cada miembro.</p>
          </div>
          {data && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Miembros vinculados</p><p className="text-2xl font-black">{data.member_count}</p></div>}
        </div>

        <section className="mt-6 rounded-[28px] border border-cyan-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700">Identidad del Team</p>
          <h2 className="mt-1 text-xl font-black">Nombre del Team</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Este nombre se mostrará cuando una persona valide un código, para que pueda confirmar que está entrando al Team correcto.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={teamName} onChange={(event) => setTeamName(event.target.value.slice(0, 80))} maxLength={80} placeholder="Ej. Equipo Comercial Kawvo" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
            <button type="button" onClick={() => void saveTeamName()} disabled={nameSaving || !teamName.trim() || !nameChanged} className="rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">{nameSaving ? 'Guardando…' : nameChanged ? 'Guardar nombre' : 'Guardado'}</button>
          </div>
          {savedTeamName && !nameChanged && <p className="mt-3 text-xs font-bold text-emerald-700">✓ Los usuarios verán: {savedTeamName}</p>}
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-black">Generar códigos</h2><p className="mt-1 text-xs leading-5 text-slate-500">Nombre y Cargo siempre quedan habilitados porque son esenciales para publicar un perfil Team.</p></div>
            <label className="text-xs font-black text-slate-600">Cantidad
              <input type="number" min={1} max={50} value={count} onChange={(event) => setCount(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} className="ml-2 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" />
            </label>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PERMISSIONS.map(([key, label]) => {
              const selected = permissions.includes(key)
              const essential = key === 'name' || key === 'role'
              return <button key={key} type="button" onClick={() => togglePermission(key)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black ${selected ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-100 text-slate-400'} ${essential ? 'cursor-default' : ''}`}><span>{label}</span><span>{selected ? '✓' : '—'}</span></button>
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">Editable: {selectedLabels.join(' · ')}</p>
          {!canGenerate && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Guarda primero el nombre del Team para generar códigos.</p>}
          <button type="button" onClick={() => void createCodes()} disabled={saving || !canGenerate} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{saving ? 'Generando…' : `Generar ${count} código${count === 1 ? '' : 's'}`}</button>

          {generated.length > 0 && <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-cyan-700">{savedTeamName} · Códigos recién generados</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{generated.map((item) => <button key={item.code} type="button" onClick={() => void copy(item.code)} className="rounded-xl bg-white px-3 py-3 font-mono text-sm font-black text-slate-900 shadow-sm">{item.code} · Copiar</button>)}</div></div>}
        </section>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
        {message && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-xl font-black">Códigos y trazabilidad</h2><p className="mt-1 text-xs text-slate-500">8 códigos por página. Busca por código, producto, correo o nombre del miembro.</p></div>
            <form onSubmit={(event) => { event.preventDefault(); void load(1, query) }} className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">Buscar</button></form>
          </div>

          {loading ? <p className="py-10 text-center text-sm text-slate-400">Cargando…</p> : <div className="mt-5 grid gap-3">{(data?.codes || []).map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><button type="button" onClick={() => void copy(row.code)} className="font-mono text-base font-black text-slate-950">{row.code}</button><p className="mt-1 text-xs font-semibold text-cyan-700">Team: {savedTeamName || data?.team?.name}</p><p className="mt-1 text-xs text-slate-500">Generado: {formatDate(row.created_at)} · Vence: {formatDate(row.expires_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : row.status === 'used' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-800'}`}>{statusLabel(row.status)}</span></div>
              {row.status === 'used' && <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600"><strong>{row.member_name || row.used_by_email || 'Usuario vinculado'}</strong>{row.used_by_email ? ` · ${row.used_by_email}` : ''}<br />Producto: {row.product_code || '—'} · Usado: {formatDate(row.used_at)}</div>}
              <p className="mt-3 text-[11px] leading-5 text-slate-500">Puede editar: {(row.permissions || []).map((key) => PERMISSIONS.find(([id]) => id === key)?.[1] || key).join(' · ')}</p>
              {row.status !== 'used' && <div className="mt-3 flex flex-wrap gap-2">{row.status === 'active' ? <button type="button" disabled={saving} onClick={() => void action(row, 'deactivate')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">Desactivar</button> : <button type="button" disabled={saving} onClick={() => void action(row, 'reactivate')} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Reactivar 24 h</button>}<button type="button" onClick={() => void copy(row.code)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">Copiar</button></div>}
            </article>
          ))}{data?.codes?.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No encontramos códigos con ese criterio.</p>}</div>}

          {data && data.pagination.pages > 1 && <div className="mt-5 flex items-center justify-between"><button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1, query)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Anterior</button><span className="text-xs font-bold text-slate-500">Página {page} de {data.pagination.pages}</span><button type="button" disabled={page >= data.pagination.pages || loading} onClick={() => void load(page + 1, query)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Siguiente</button></div>}
        </section>
      </div>
    </main>
  )
}
