import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiPost } from '../../lib/api'

const TEAM_CODE_KEY = 'kawvo_team_join_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

type AuthorityState = 'loading' | 'master_verified' | 'signed_out' | 'different_account' | 'error'

function saveContext(publicCode: string, teamCode: string) {
  sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, publicCode)
  localStorage.setItem(SCAN_PUBLIC_CODE_KEY, publicCode)
  sessionStorage.setItem(TEAM_CODE_KEY, teamCode)
  localStorage.setItem(TEAM_CODE_KEY, teamCode)
}

export default function TeamActivationAuthorityGate({ publicCode, teamCode }: { publicCode: string; teamCode: string }) {
  const [state, setState] = useState<AuthorityState>('loading')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    let active = true
    saveContext(publicCode, teamCode)
    apiPost('/public/team/browser-authority', { public_code: publicCode, team_code: teamCode })
      .then((json: any) => {
        if (!active) return
        if (!json?.ok) {
          setError(json?.error || 'No pudimos validar el acceso a este Team.')
          setState('error')
          return
        }
        setData(json.data || null)
        const next = String(json.data?.session_state || '') as AuthorityState
        setState(['master_verified', 'signed_out', 'different_account'].includes(next) ? next : 'error')
        if (!['master_verified', 'signed_out', 'different_account'].includes(next)) setError('No pudimos confirmar la sesión del Administrador Master.')
      })
      .catch(() => {
        if (!active) return
        setError('No pudimos comprobar la sesión de este navegador.')
        setState('error')
      })
    return () => { active = false }
  }, [publicCode, teamCode])

  const loginUrl = `/admin/login?activation=team&public_code=${encodeURIComponent(publicCode)}&team_code=${encodeURIComponent(teamCode)}`

  const switchAccount = async () => {
    if (switching) return
    setSwitching(true)
    saveContext(publicCode, teamCode)
    await apiPost('/auth/logout', {}).catch(() => undefined)
    window.location.assign(loginUrl)
  }

  if (state === 'master_verified') {
    return <Navigate to={`/admin/free/team/assign?public_code=${encodeURIComponent(publicCode)}&team_code=${encodeURIComponent(teamCode)}`} replace />
  }

  if (state === 'loading') {
    return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] flex-col justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">KAWVO LINK · TEAM</p>
          <h1 className="mt-2 text-2xl font-black">Verificar Administrador Master</h1>

          {data && <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-xs font-black uppercase text-cyan-700">Team identificado</p>
            <p className="mt-1 text-lg font-black">{data.team_name}</p>
            {data.master_name && <p className="mt-1 text-sm text-slate-600">Administrador Master: {data.master_name}</p>}
            <p className="mt-1 text-xs text-slate-500">Producto {publicCode}</p>
          </div>}

          {state === 'signed_out' && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="font-black">Este navegador no tiene una sesión Master iniciada.</p>
            <p className="mt-1">Para preparar este dispositivo debes iniciar sesión con la cuenta del Administrador Master que generó el código Team.</p>
            <button type="button" onClick={() => window.location.assign(loginUrl)} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Iniciar sesión como Administrador Master</button>
          </div>}

          {state === 'different_account' && <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-900">
            <p className="font-black">Hay otra cuenta iniciada en este navegador.</p>
            <p className="mt-1">Este código pertenece a {data?.team_name || 'otro Team'}. Cambia a la cuenta de su Administrador Master para continuar.</p>
            <button type="button" onClick={() => void switchAccount()} disabled={switching} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{switching ? 'Cambiando cuenta…' : 'Cambiar a la cuenta Master correcta'}</button>
          </div>}

          {state === 'error' && <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-700">{error || 'No pudimos validar este acceso Team.'}</div>}
        </div>
      </section>
    </main>
  )
}
