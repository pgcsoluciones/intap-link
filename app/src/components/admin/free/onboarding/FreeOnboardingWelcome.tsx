import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'

const NFC_INTEREST_URL = 'https://nfc.kawvoia.com'

export default function FreeOnboardingWelcome() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const [rejectError,setRejectError] = useState('')
  const [rejecting,setRejecting] = useState(false)
  const [invitedDemos, setInvitedDemos] = useState<Array<{id:string;profile_name:string;url:string;expires_at:string}>>([])
  const [resolvingAccount, setResolvingAccount] = useState(true)
  const [resolvingInvitations, setResolvingInvitations] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('profile_deleted') === '1') {
      navigate('/admin/artifacts', { replace: true })
      return
    }

    let alive = true
    apiGet('/me/kawmed/demo-invitations').then((response:any)=>{if(alive && response?.ok && Array.isArray(response.data))setInvitedDemos(response.data.slice(0,1))}).catch(()=>undefined).finally(()=>{if(alive)setResolvingInvitations(false)})
    apiGet('/me/home-route')
      .then((json:any) => {
        if (!alive) return
        const route = String(json?.data?.route || '')
        if (json?.ok && route && route !== '/admin/free/onboarding/welcome') {
          navigate(route, { replace:true })
          return
        }
        setResolvingAccount(false)
      })
      .catch(() => { if (alive) setResolvingAccount(false) })
    return () => { alive = false }
  }, [navigate])

  const logout = async () => {
    if (leaving) return
    setLeaving(true)
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    window.location.replace('/admin/login')
  }

  const rejectInvite=async()=>{
    if(!invitedDemos[0]||rejecting)return
    setRejecting(true);setRejectError('')
    try{
      const answer:any=await apiPost('/me/kawmed/demo-invitations/'+encodeURIComponent(invitedDemos[0].id)+'/reject',{})
      if(!answer?.ok)throw new Error(answer?.error||'No se pudo rechazar la invitación.')
      setInvitedDemos([])
      navigate('/admin/artifacts', {replace:true})
    }catch(e){setRejectError(e instanceof Error?e.message:'No se pudo rechazar la invitación.');setRejecting(false)}
  }

  if (resolvingAccount || resolvingInvitations) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          {invitedDemos.length>0 ? <>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWMED</p>
            <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Invitación KawMed</h1>
            <p className="mt-5 text-[15px] leading-6 text-slate-600">Te han invitado a administrar el siguiente perfil:</p>
            <p className="mt-3 text-xl font-bold text-slate-950">{invitedDemos[0].profile_name}</p>
            <div className="mt-7 grid gap-3">
              <button type="button" onClick={()=>window.location.assign(invitedDemos[0].url)} disabled={rejecting} className="w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-extrabold text-white disabled:opacity-50">Aceptar</button>
              <button type="button" onClick={()=>void rejectInvite()} disabled={rejecting} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-700 disabled:opacity-50">{rejecting?'Rechazando…':'Rechazar'}</button>
              {rejectError&&<p role="alert" className="text-sm text-rose-700">{rejectError}</p>}
            </div>
          </> : <>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
            <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Bienvenido a Kawlink</h1>
            <p className="mt-3 text-[15px] leading-6 text-slate-500">Tu cuenta está activa, pero todavía no tiene una presentación vinculada. Elige cómo quieres continuar.</p>
          </>}
          {invitedDemos.length===0 && <>
          <div className="mt-6 grid gap-3">
            <button type="button" onClick={() => navigate('/admin/artifacts/activate?start=1')} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-left text-white transition hover:bg-slate-800">
              <span className="block text-sm font-extrabold">Ya tengo un dispositivo Kawvo</span>
              <span className="mt-1 block text-xs font-medium leading-5 text-slate-300">Quiero activarlo y vincularlo a esta cuenta.</span>
            </button>

            <a href={NFC_INTEREST_URL} target="_blank" rel="noopener noreferrer" className="block w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-left transition hover:bg-cyan-100/70">
              <span className="block text-sm font-extrabold text-slate-900">No tengo dispositivo, pero me interesa</span>
              <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">Conoce los dispositivos Kawvo y cómo adquirir uno.</span>
            </a>
          </div>

          </>}
          {invitedDemos.length===0 && <div className="mt-6 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => void logout()} disabled={leaving} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
              {leaving ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
          </div>}
        </div>
      </section>
    </main>
  )
}
