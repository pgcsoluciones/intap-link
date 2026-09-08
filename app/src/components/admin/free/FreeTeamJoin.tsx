import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../../lib/api'

const TEAM_CODE_KEY = 'kawvo_team_join_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

export default function FreeTeamJoin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [team, setTeam] = useState<any>(null)

  const code = (sessionStorage.getItem(TEAM_CODE_KEY) || localStorage.getItem(TEAM_CODE_KEY) || '').trim().toUpperCase()
  const publicCode = (sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || '').trim().toUpperCase()

  useEffect(() => {
    if (!code || !publicCode) {
      setError('No encontramos el producto o el código Team que estabas vinculando.')
      setLoading(false)
      return
    }
    apiPost('/public/team/code/inspect-v2', { code, public_code: publicCode })
      .then((json: any) => {
        if (!json?.ok) { setError(json?.error || 'El código Team ya no está disponible.'); return }
        setTeam(json.data || null)
      })
      .catch(() => setError('No pudimos validar el código Team.'))
      .finally(() => setLoading(false))
  }, [code, publicCode])

  const join = async () => {
    if (joining || !team) return
    setJoining(true); setError('')
    const json: any = await apiPost('/me/team/join', { code, public_code: publicCode }).catch(() => ({ ok: false }))
    setJoining(false)
    if (!json?.ok) return setError(json?.error || 'No pudimos completar la vinculación Team.')
    sessionStorage.removeItem(TEAM_CODE_KEY); localStorage.removeItem(TEAM_CODE_KEY)
    sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY); localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
    navigate(json.data?.next_url || '/admin/free/team/member', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK · TEAM</p>
          {loading ? <div className="py-8 text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" /><p className="mt-4 text-sm font-bold text-slate-500">Validando vinculación…</p></div> : error ? <><h1 className="mt-3 text-2xl font-black">No pudimos continuar</h1><p className="mt-3 text-sm leading-6 text-rose-600">{error}</p><button type="button" onClick={() => navigate('/admin/free')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Ir a mi panel</button></> : <>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Team confirmado</p>
            <h1 className="mt-1 text-[30px] font-black leading-tight">{team?.team_name}</h1>
            {team?.master_name && team.master_name !== team.team_name && <p className="mt-1 text-sm font-semibold text-slate-500">Perfil principal: {team.master_name}</p>}
            <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-sm font-black text-slate-900">Confirma que este es el Team correcto.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Al continuar, tu producto quedará conectado a <strong>{team?.team_name}</strong> y este código no podrá volver a utilizarse.</p>
              {team?.reserved_for_this_product && <p className="mt-2 text-xs font-bold text-cyan-800">Este código fue reservado específicamente para este producto.</p>}
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-amber-800">Producto</p><p className="mt-1 font-mono text-base font-black">{publicCode}</p><p className="mt-3 text-xs font-black uppercase tracking-wide text-amber-800">Código Team</p><p className="mt-1 font-mono text-base font-black">{code}</p></div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Después de vincularlo, este dispositivo dejará de funcionar como perfil independiente. Las opciones editables dependerán de lo autorizado por el administrador Team.</p>
            <button type="button" onClick={() => void join()} disabled={joining} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{joining ? 'Vinculando…' : `Sí, vincular a ${team?.team_name}`}</button>
            <button type="button" onClick={() => navigate('/admin/free')} disabled={joining} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-black text-slate-600">No es mi Team</button>
            <button type="button" onClick={() => navigate('/admin/free')} disabled={joining} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-black text-slate-500">Vincular luego</button>
          </>}
        </div>
      </section>
    </main>
  )
}
