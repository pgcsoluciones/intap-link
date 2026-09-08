import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

export default function FreeTeamAssign() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const publicCode = String(params.get('public_code') || '').trim().toUpperCase()
  const teamCode = String(params.get('team_code') || '').trim().toUpperCase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [context, setContext] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [accessRole, setAccessRole] = useState<'member' | 'editor' | 'subadmin'>('member')
  const [publishNow, setPublishNow] = useState(true)

  useEffect(() => {
    if (!publicCode || !teamCode) {
      setError('No encontramos el dispositivo o el código Team que estabas preparando.')
      setLoading(false)
      return
    }
    apiGet(`/me/team/corporate/prepare?public_code=${encodeURIComponent(publicCode)}&team_code=${encodeURIComponent(teamCode)}`)
      .then((json: any) => {
        if (!json?.ok) setError(json?.error || 'No pudimos preparar este dispositivo.')
        else setContext(json.data)
      })
      .catch(() => setError('No pudimos validar tu acceso al Team.'))
      .finally(() => setLoading(false))
  }, [publicCode, teamCode])

  const submit = async () => {
    if (saving) return
    if (!name.trim() || !roleTitle.trim()) { setError('Completa nombre y cargo del colaborador.'); return }
    setSaving(true); setError('')
    const json: any = await apiPost('/me/team/corporate/assign', {
      public_code: publicCode,
      team_code: teamCode,
      name: name.trim(),
      role_title: roleTitle.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      access_role: accessRole,
      publish_now: publishNow,
    }).catch(() => ({ ok: false }))
    setSaving(false)
    if (!json?.ok) { setError(json?.error || 'No pudimos asignar el dispositivo.'); return }
    setResult(json.data)
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  if (result) return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[520px] rounded-[28px] border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">DISPOSITIVO TEAM PREPARADO</p>
        <h1 className="mt-2 text-2xl font-black">{name}</h1>
        <p className="mt-1 text-sm text-slate-500">{roleTitle}</p>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p><strong>Team:</strong> {result.team_name}</p>
          <p><strong>Producto:</strong> {result.public_code}</p>
          <p><strong>Estado:</strong> {result.status === 'published' ? 'Publicado' : 'Perfil pendiente'}</p>
          <p><strong>Rol:</strong> {result.access_role === 'member' ? 'Miembro' : result.access_role === 'editor' ? 'Editor' : 'Subadministrador'}</p>
        </div>
        {result.temporary_password && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Contraseña temporal</p><p className="mt-2 font-mono text-lg font-black text-slate-950">{result.temporary_password}</p><p className="mt-2 text-xs leading-5 text-amber-800">Entrégala únicamente al colaborador con rol. Deberá cambiarla en su primer acceso.</p></div>}
        <button type="button" onClick={() => navigate('/admin/free/team')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Volver al Team</button>
      </section>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[620px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free/account')} />
        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">KAWVO LINK · TEAM</p>
        <h1 className="mt-1 text-3xl font-black">Preparar dispositivo</h1>
        {context && <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black uppercase text-cyan-700">Team confirmado</p><p className="mt-1 text-lg font-black">{context.team_name}</p><p className="mt-1 text-xs text-slate-500">Producto {publicCode}</p></div>}
        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}

        <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Datos del colaborador</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">RR. HH. prepara el perfil. El miembro normal no necesita crear cuenta ni pasar por onboarding.</p>
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-black text-slate-600">Nombre *<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>
            <label className="text-xs font-black text-slate-600">Cargo *<input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>
            <label className="text-xs font-black text-slate-600">Teléfono<input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>
            <label className="text-xs font-black text-slate-600">WhatsApp<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>
            <label className="text-xs font-black text-slate-600">Correo de contacto<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /><span className="mt-1 block font-normal text-slate-400">Es un dato público del perfil; no se usa como credencial de acceso.</span></label>
          </div>
        </section>

        <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Rol de acceso</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Solo Editor y Subadministrador reciben acceso al panel Team.</p>
          <div className="mt-4 grid gap-2">
            {([['member','Miembro','Sin acceso al panel.'],['editor','Editor','Puede editar campos habilitados de miembros.'],['subadmin','Subadministrador','Puede editar y activar/desactivar miembros.']] as const).map(([value,label,detail]) => <button key={value} type="button" onClick={() => setAccessRole(value)} className={`rounded-2xl border p-4 text-left ${accessRole === value ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white'}`}><span className="block text-sm font-black">{label}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></button>)}
          </div>
          <label className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold"><span>Publicar al terminar</span><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /></label>
        </section>

        <button type="button" onClick={() => void submit()} disabled={saving || !context} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{saving ? 'Preparando…' : 'Asignar colaborador y preparar dispositivo'}</button>
      </div>
    </main>
  )
}
