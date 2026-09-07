import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

const LABELS: Record<string, string> = {
  name: 'Nombre', role: 'Cargo', photo: 'Foto', phone: 'Teléfonos', email: 'Correo', whatsapp: 'WhatsApp',
  portfolio: 'Portafolio', services: 'Servicios', links: 'Enlaces', quick_actions: 'Botones directos', location: 'Ubicación', design: 'Diseño, plantilla y colores',
}

export default function FreeTeamMember() {
  const navigate = useNavigate()
  const [context, setContext] = useState<any>(null)
  const [teamIdentity, setTeamIdentity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const [json, nameJson]: any[] = await Promise.all([
      apiGet('/me/team/context').catch(() => ({ ok: false })),
      apiGet('/me/team/name').catch(() => ({ ok: false })),
    ])
    if (!json?.ok || json.data?.role !== 'member') {
      navigate('/admin/free/team', { replace: true })
      return
    }
    setContext(json.data.member)
    if (nameJson?.ok) setTeamIdentity(nameJson.data)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const toggleDevice = async () => {
    if (!context || busy) return
    const suspended = context.artifact_status === 'suspended' || context.status === 'inactive'
    setBusy(true); setMessage('')
    const json: any = await apiPost(`/me/team/member/device/${suspended ? 'reactivate' : 'deactivate'}`, {}).catch(() => ({ ok: false }))
    setBusy(false)
    if (!json?.ok) return setMessage(json?.error || 'No pudimos actualizar el dispositivo.')
    setMessage(suspended ? 'Dispositivo reactivado.' : 'Dispositivo desactivado. Al escanearlo se mostrará el perfil general del Team.')
    await load()
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>
  const permissions: string[] = context?.permissions || []
  const suspended = context?.artifact_status === 'suspended' || context?.status === 'inactive'
  const teamName = teamIdentity?.team_name || context?.master_name || 'Perfil Team'

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[620px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <section className="mt-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">KAWVO LINK · TEAM</p>
          <h1 className="mt-1 text-2xl font-black">{teamName}</h1>
          {teamIdentity?.master_name && teamIdentity.master_name !== teamName && <p className="mt-1 text-xs font-semibold text-slate-400">Perfil principal: {teamIdentity.master_name}</p>}
          <p className="mt-2 text-sm leading-6 text-slate-500">Tu producto está vinculado a este Team. Solo puedes modificar las opciones autorizadas por el administrador.</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Producto</p><p className="mt-1 font-mono text-base font-black">{context?.public_code}</p><p className="mt-1 text-xs text-slate-500">Estado: {suspended ? 'Desactivado' : 'Activo'}</p></div>
          <button type="button" onClick={() => void toggleDevice()} disabled={busy} className={`mt-4 w-full rounded-2xl px-4 py-3.5 text-sm font-black disabled:opacity-40 ${suspended ? 'bg-slate-950 text-white' : 'border border-amber-200 bg-amber-50 text-amber-800'}`}>{busy ? 'Guardando…' : suspended ? 'Reactivar dispositivo' : 'Desactivar dispositivo'}</button>
          {message && <p className="mt-3 rounded-xl bg-cyan-50 px-3 py-2.5 text-xs font-bold text-cyan-700">{message}</p>}
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Qué puedes editar</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Amarillo significa editable. Gris significa administrado por el perfil master.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(LABELS).map(([key, label]) => {
              const allowed = permissions.includes(key)
              return <div key={key} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black ${allowed ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-100 text-slate-400'}`}><span>{label}</span><span>{allowed ? 'Editable' : 'Bloqueado'}</span></div>
            })}
          </div>
        </section>

        <button type="button" onClick={() => navigate('/admin/free')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Ir a mi perfil Team</button>
      </div>
    </main>
  )
}
