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

type AccessRole = 'master' | 'editor' | 'subadmin'
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
  product_code?: string | null
  product_type?: string | null
  reserved?: boolean
}
type MemberRow = {
  id: string
  status: string
  admin_role?: 'member' | 'editor' | 'subadmin'
  permissions?: string[]
  joined_at?: string
  email?: string
  account_email?: string
  name?: string | null
  role?: string | null
  product_code?: string | null
}
type TeamPayload = {
  team: { id: string; master_profile_id: string; name: string }
  access: { role: AccessRole; can_generate_codes: boolean; can_manage_roles: boolean; can_toggle_members: boolean; can_edit_members: boolean }
  codes: CodeRow[]
  members: MemberRow[]
  pagination: { page: number; page_size: number; total: number; pages: number }
  member_count: number
}
type MemberEdit = {
  id: string
  name: string
  role: string
  phone: string
  email: string
  whatsapp: string
  permissions: string[]
  account_email: string
  product_code: string
}

function statusLabel(status: string) {
  if (status === 'used') return 'Usado'
  if (status === 'expired') return 'Caducado'
  if (status === 'disabled') return 'Desactivado'
  return 'Activo'
}
function roleLabel(role?: string) {
  if (role === 'editor') return 'Editor'
  if (role === 'subadmin') return 'Subadministrador'
  return 'Miembro'
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
  const [reserveInputs, setReserveInputs] = useState<Record<string, string>>({})
  const [memberEdit, setMemberEdit] = useState<MemberEdit | null>(null)

  const load = async (nextPage = page, q = query) => {
    setLoading(true)
    setError('')
    let context: any = await apiGet('/me/team/admin-context').catch(() => ({ ok: false }))
    if (context?.ok && context.data?.role === 'member') {
      navigate('/admin/free/team/member', { replace: true })
      return
    }
    if (context?.ok && context.data?.role === 'none') {
      const created: any = await apiGet('/me/team').catch(() => ({ ok: false }))
      if (!created?.ok) {
        setError(created?.error || 'No pudimos crear tu Team.')
        setLoading(false)
        return
      }
      context = await apiGet('/me/team/admin-context').catch(() => ({ ok: false }))
    }
    if (!context?.ok || !['master', 'editor', 'subadmin'].includes(String(context.data?.role || ''))) {
      setError('Este módulo solo está disponible para el administrador o un rol autorizado.')
      setLoading(false)
      return
    }

    const json: any = await apiGet(`/me/team/manage?page=${nextPage}&q=${encodeURIComponent(q)}`).catch(() => ({ ok: false }))
    if (!json?.ok) setError(json?.error || 'No pudimos abrir Team.')
    else {
      setData(json.data)
      setPage(json.data?.pagination?.page || nextPage)
      const currentName = String(json.data?.team?.name || '').trim()
      setTeamName(currentName)
      setSavedTeamName(currentName)
    }
    setLoading(false)
  }

  useEffect(() => { void load(1, '') }, [])

  const isMaster = data?.access?.role === 'master'
  const canToggleMembers = Boolean(data?.access?.can_toggle_members)
  const canEditMembers = Boolean(data?.access?.can_edit_members)

  const saveTeamName = async () => {
    if (!isMaster) return
    const name = teamName.trim().replace(/\s+/g, ' ')
    if (name.length < 2) { setError('Escribe un nombre para identificar tu Team.'); return }
    if (nameSaving) return
    setNameSaving(true); setError(''); setMessage('')
    const json: any = await apiPut('/me/team/name', { name }).catch(() => ({ ok: false }))
    setNameSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos guardar el nombre del Team.')
    setTeamName(json.data?.name || name)
    setSavedTeamName(json.data?.name || name)
    setMessage('Nombre del Team guardado.')
  }

  const togglePermission = (key: string) => {
    if (key === 'name' || key === 'role' || !isMaster) return
    setPermissions((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  const createCodes = async () => {
    if (!isMaster || saving) return
    if (savedTeamName.trim().length < 2) { setError('Primero asigna un nombre a tu Team.'); return }
    if (teamName.trim() !== savedTeamName.trim()) { setError('Guarda el nombre del Team antes de generar códigos.'); return }
    setSaving(true); setError(''); setMessage(''); setGenerated([])
    const json: any = await apiPost('/me/team/codes', { count, permissions }).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos generar los códigos.')
    setGenerated(json.data || [])
    setMessage(`${(json.data || []).length} código(s) generado(s). Son válidos por 24 horas y de un solo uso.`)
    await load(1, query)
  }

  const codeAction = async (row: CodeRow, type: 'deactivate' | 'reactivate') => {
    if (!isMaster || saving) return
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiPost(`/me/team/codes/${row.id}/${type}`, {}).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos actualizar el código.')
    setMessage(type === 'reactivate' ? 'Código reactivado por 24 horas.' : 'Código desactivado.')
    await load(page, query)
  }

  const reserveProduct = async (row: CodeRow) => {
    if (!isMaster || saving) return
    const publicCode = String(reserveInputs[row.id] || '').trim().toUpperCase()
    if (!publicCode) return setError('Ingresa el código del producto que deseas reservar.')
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiPost(`/me/team/codes/${row.id}/reserve`, { public_code: publicCode }).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos reservar el producto.')
    setReserveInputs((current) => ({ ...current, [row.id]: '' }))
    setMessage(`Producto ${publicCode} reservado para este código Team.`)
    await load(page, query)
  }

  const unreserveProduct = async (row: CodeRow) => {
    if (!isMaster || saving) return
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiPost(`/me/team/codes/${row.id}/unreserve`, {}).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos liberar la reserva.')
    setMessage('Reserva del producto liberada.')
    await load(page, query)
  }

  const updateMemberRole = async (member: MemberRow, role: 'member' | 'editor' | 'subadmin') => {
    if (!isMaster || saving) return
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiPost(`/me/team/members/${member.id}/role`, { role }).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos asignar el rol.')
    setMessage(`Rol actualizado a ${roleLabel(role)}.`)
    await load(page, query)
  }

  const toggleMember = async (member: MemberRow) => {
    if (!canToggleMembers || saving) return
    const active = member.status !== 'active'
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiPost(`/me/team/members/${member.id}/status`, { active }).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos actualizar el miembro.')
    setMessage(active ? 'Miembro reactivado.' : 'Miembro desactivado. Su dispositivo mostrará el perfil general del Team.')
    await load(page, query)
  }

  const openMemberEdit = async (member: MemberRow) => {
    if (!canEditMembers) return
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiGet(`/me/team/members/${member.id}/basic`).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos abrir los datos del miembro.')
    setMemberEdit({
      id: member.id,
      name: String(json.data?.name || ''), role: String(json.data?.role || ''), phone: String(json.data?.phone || ''),
      email: String(json.data?.email || ''), whatsapp: String(json.data?.whatsapp || ''), permissions: json.data?.permissions || [],
      account_email: String(json.data?.account_email || ''), product_code: String(json.data?.product_code || ''),
    })
  }

  const saveMemberEdit = async () => {
    if (!memberEdit || saving) return
    const allowed = new Set(memberEdit.permissions || [])
    const body: Record<string, string> = {}
    for (const key of ['name', 'role', 'phone', 'email', 'whatsapp'] as const) {
      if (isMaster || allowed.has(key)) body[key] = memberEdit[key]
    }
    setSaving(true); setError(''); setMessage('')
    const json: any = await apiPut(`/me/team/members/${memberEdit.id}/basic`, body).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos guardar los datos del miembro.')
    setMemberEdit(null)
    setMessage('Datos del miembro actualizados.')
    await load(page, query)
  }

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(`Código ${value} copiado.`) } catch { setMessage('No pudimos copiar el código.') }
  }

  const selectedLabels = useMemo(() => PERMISSIONS.filter(([key]) => permissions.includes(key)).map(([, label]) => label), [permissions])
  const nameChanged = teamName.trim() !== savedTeamName.trim()
  const canGenerate = isMaster && savedTeamName.trim().length >= 2 && !nameChanged

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[980px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">KAWVO LINK · TEAM</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">Equipo de trabajo</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Administra miembros, permisos y dispositivos vinculados al perfil master.</p>
          </div>
          {data && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tu acceso</p><p className="text-lg font-black">{data.access.role === 'master' ? 'Administrador' : roleLabel(data.access.role)}</p></div>}
        </div>

        {data && data.access.role !== 'master' && <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900"><strong>Acceso delegado.</strong> Puedes gestionar únicamente lo permitido por tu rol. La generación de códigos y los roles administrativos siguen reservados al administrador Master.</div>}

        <section className="mt-6 rounded-[28px] border border-cyan-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700">Identidad del Team</p>
          <h2 className="mt-1 text-xl font-black">{savedTeamName || 'Nombre del Team'}</h2>
          {isMaster ? <><p className="mt-2 text-sm leading-6 text-slate-500">Este nombre se muestra al validar un código para confirmar que la persona está entrando al Team correcto.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={teamName} onChange={(event) => setTeamName(event.target.value.slice(0, 80))} maxLength={80} placeholder="Ej. Equipo Comercial Kawvo" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /><button type="button" onClick={() => void saveTeamName()} disabled={nameSaving || !teamName.trim() || !nameChanged} className="rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">{nameSaving ? 'Guardando…' : nameChanged ? 'Guardar nombre' : 'Guardado'}</button></div></> : <p className="mt-2 text-sm text-slate-500">El nombre y la configuración general solo pueden ser modificados por el administrador Master.</p>}
        </section>

        {isMaster && <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Generar códigos</h2><p className="mt-1 text-xs leading-5 text-slate-500">Nombre y Cargo son esenciales. Puedes reservar después cada código para un producto nuevo específico.</p></div><label className="text-xs font-black text-slate-600">Cantidad <input type="number" min={1} max={50} value={count} onChange={(event) => setCount(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} className="ml-2 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PERMISSIONS.map(([key, label]) => { const selected = permissions.includes(key); const essential = key === 'name' || key === 'role'; return <button key={key} type="button" onClick={() => togglePermission(key)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black ${selected ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-100 text-slate-400'} ${essential ? 'cursor-default' : ''}`}><span>{label}</span><span>{selected ? '✓' : '—'}</span></button> })}</div>
          <p className="mt-3 text-xs text-slate-400">Editable: {selectedLabels.join(' · ')}</p>
          <button type="button" onClick={() => void createCodes()} disabled={saving || !canGenerate} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{saving ? 'Generando…' : `Generar ${count} código${count === 1 ? '' : 's'}`}</button>
          {generated.length > 0 && <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-cyan-700">Códigos recién generados</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{generated.map((item) => <button key={item.code} type="button" onClick={() => void copy(item.code)} className="rounded-xl bg-white px-3 py-3 font-mono text-sm font-black text-slate-900 shadow-sm">{item.code} · Copiar</button>)}</div></div>}
        </section>}

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
        {message && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Miembros</h2><p className="mt-1 text-xs text-slate-500">Free permite un Administrador Master, un Editor y un Subadministrador.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{data?.member_count || 0}</span></div>
          <div className="mt-5 grid gap-3">{(data?.members || []).map((member) => <article key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{member.name || member.email || 'Miembro Team'}</p><p className="mt-1 text-xs text-slate-500">{member.email || 'Sin correo'} · Producto {member.product_code || '—'}</p><p className="mt-1 text-xs text-slate-400">Vinculado: {formatDate(member.joined_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${member.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{member.status === 'active' ? 'Activo' : 'Desactivado'}</span></div><div className="mt-3 flex flex-wrap items-center gap-2">{isMaster ? <select value={member.admin_role || 'member'} disabled={saving} onChange={(event) => void updateMemberRole(member, event.target.value as 'member' | 'editor' | 'subadmin')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"><option value="member">Miembro</option><option value="editor">Editor</option><option value="subadmin">Subadministrador</option></select> : <span className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600">{roleLabel(member.admin_role)}</span>}{canEditMembers && <button type="button" disabled={saving} onClick={() => void openMemberEdit(member)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Editar datos</button>}{canToggleMembers && <button type="button" disabled={saving} onClick={() => void toggleMember(member)} className={`rounded-xl px-3 py-2 text-xs font-black ${member.status === 'active' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'bg-slate-950 text-white'}`}>{member.status === 'active' ? 'Desactivar' : 'Reactivar'}</button>}</div></article>)}{!loading && (data?.members || []).length === 0 && <p className="py-6 text-center text-sm text-slate-400">Todavía no hay miembros vinculados.</p>}</div>
        </section>

        {memberEdit && <section className="mt-6 rounded-[28px] border border-amber-300 bg-amber-50 p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wide text-amber-800">Editar miembro</p><h2 className="mt-1 text-xl font-black">{memberEdit.account_email || memberEdit.product_code}</h2></div><button type="button" onClick={() => setMemberEdit(null)} className="rounded-full bg-white px-3 py-1 text-xs font-black">Cerrar</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{(['name','role','phone','email','whatsapp'] as const).map((field) => { const label: Record<string,string> = { name:'Nombre',role:'Cargo',phone:'Teléfono',email:'Correo',whatsapp:'WhatsApp' }; const editable = isMaster || memberEdit.permissions.includes(field); return <label key={field} className="text-xs font-black text-slate-600">{label[field]}<input disabled={!editable} value={memberEdit[field]} onChange={(event) => setMemberEdit((current) => current ? { ...current, [field]: event.target.value } : current)} className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm ${editable ? 'border-amber-200 bg-white' : 'border-slate-200 bg-slate-100 text-slate-400'}`} />{!editable && <span className="mt-1 block text-[10px] text-slate-400">No habilitado para este miembro</span>}</label> })}</div><button type="button" disabled={saving} onClick={() => void saveMemberEdit()} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar cambios'}</button></section>}

        {isMaster && <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">Códigos y trazabilidad</h2><p className="mt-1 text-xs text-slate-500">8 códigos por página. La trazabilidad Free muestra usuario, correo, producto y fecha.</p></div><form onSubmit={(event) => { event.preventDefault(); void load(1, query) }} className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">Buscar</button></form></div>
          {loading ? <p className="py-10 text-center text-sm text-slate-400">Cargando…</p> : <div className="mt-5 grid gap-3">{(data?.codes || []).map((row) => <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><button type="button" onClick={() => void copy(row.code)} className="font-mono text-base font-black">{row.code}</button><p className="mt-1 text-xs font-semibold text-cyan-700">Team: {savedTeamName}</p><p className="mt-1 text-xs text-slate-500">Generado: {formatDate(row.created_at)} · Vence: {formatDate(row.expires_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : row.status === 'used' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-800'}`}>{statusLabel(row.status)}</span></div>{row.status === 'used' ? <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600"><strong>{row.member_name || row.used_by_email || 'Usuario vinculado'}</strong>{row.used_by_email ? ` · ${row.used_by_email}` : ''}<br />Producto: {row.product_code || '—'} · Activado: {formatDate(row.used_at)}</div> : row.product_code ? <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900"><strong>Producto reservado:</strong> {row.product_code}<button type="button" disabled={saving} onClick={() => void unreserveProduct(row)} className="ml-2 rounded-lg bg-white px-2 py-1 font-black">Liberar</button></div> : <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={reserveInputs[row.id] || ''} onChange={(event) => setReserveInputs((current) => ({ ...current, [row.id]: event.target.value.toUpperCase() }))} placeholder="Código del producto nuevo" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold uppercase" /><button type="button" disabled={saving} onClick={() => void reserveProduct(row)} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white">Reservar producto</button></div>}<p className="mt-3 text-[11px] leading-5 text-slate-500">Puede editar: {(row.permissions || []).map((key) => PERMISSIONS.find(([id]) => id === key)?.[1] || key).join(' · ')}</p>{row.status !== 'used' && <div className="mt-3 flex flex-wrap gap-2">{row.status === 'active' ? <button type="button" disabled={saving} onClick={() => void codeAction(row, 'deactivate')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">Desactivar código</button> : <button type="button" disabled={saving} onClick={() => void codeAction(row, 'reactivate')} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Reactivar 24 h</button>}<button type="button" onClick={() => void copy(row.code)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">Copiar</button></div>}</article>)}{data?.codes?.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No encontramos códigos con ese criterio.</p>}</div>}
          {data && data.pagination.pages > 1 && <div className="mt-5 flex items-center justify-between"><button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1, query)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Anterior</button><span className="text-xs font-bold text-slate-500">Página {page} de {data.pagination.pages}</span><button type="button" disabled={page >= data.pagination.pages || loading} onClick={() => void load(page + 1, query)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Siguiente</button></div>}
        </section>}
      </div>
    </main>
  )
}
