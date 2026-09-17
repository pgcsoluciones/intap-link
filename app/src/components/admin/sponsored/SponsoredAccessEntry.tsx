import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'

const PROFILE_KEY='kawvo_sponsored_public_code'
const MASTER_KEY='kawvo_sponsor_master_code'
const PANEL_KEY='kawvo_sponsored_panel_resume'
function valid(value:string){return /^[A-Z2-9]{8,24}$/.test(value)}

export default function SponsoredAccessEntry(){
  const location=useLocation();const navigate=useNavigate();const[params]=useSearchParams()
  const[error,setError]=useState('')
  const[busy,setBusy]=useState(true)
  const[wrongAccount,setWrongAccount]=useState(false)
  const[currentEmail,setCurrentEmail]=useState('')
  const isMaster=location.pathname.startsWith('/admin/sponsor/entry')
  const code=String(params.get('public_code')||'').trim().toUpperCase()

  useEffect(()=>{
    let alive=true
    async function run(){
      if(isMaster){
        if(!valid(code)){if(alive){setError('No encontramos el código del llavero Master.');setBusy(false)};return}
        sessionStorage.setItem(MASTER_KEY,code);localStorage.setItem(MASTER_KEY,code)
      }else if(valid(code)){
        sessionStorage.setItem(PROFILE_KEY,code);localStorage.setItem(PROFILE_KEY,code)
      }else{
        sessionStorage.setItem(PANEL_KEY,'1');localStorage.setItem(PANEL_KEY,'1')
      }

      try{
        const me:any=await apiGet('/me')
        if(!alive)return
        if(!me?.ok){navigate('/admin/login',{replace:true});return}

        if(!isMaster){
          navigate(valid(code)?`/admin/sponsored/activate?public_code=${encodeURIComponent(code)}`:'/admin/sponsored',{replace:true})
          return
        }

        setCurrentEmail(String(me?.data?.email||me?.email||''))
        const status:any=await apiPost('/public/artifacts/scan/status',{public_code:code})
        if(!alive)return
        if(!status?.ok){setError(status?.error||'No pudimos validar el llavero Master.');setBusy(false);return}

        if(status.state==='sponsored_master_login'){
          setWrongAccount(true)
          setBusy(false)
          return
        }

        if(status.state==='sponsored_master'){
          // The scan endpoint has now validated the registered sponsor email,
          // created/updated the owner membership and ensured the sponsor-owner profile.
          // The resume marker is no longer needed; clearing it prevents a redirect loop.
          sessionStorage.removeItem(MASTER_KEY)
          localStorage.removeItem(MASTER_KEY)
          const target=status.manage_url?new URL(status.manage_url):null
          navigate(target?target.pathname+target.search:'/admin/sponsored?sponsor_master=1',{replace:true})
          return
        }

        setError(status.message||'Esta cuenta no puede activar este llavero Master.')
        setBusy(false)
      }catch{
        if(alive){setError('No pudimos validar tu acceso. Intenta nuevamente.');setBusy(false)}
      }
    }
    void run()
    return()=>{alive=false}
  },[code,isMaster,navigate])

  async function switchAccount(){
    setBusy(true);setError('')
    try{await apiPost('/auth/logout',{})}catch{/* La navegación a login también permite recuperar el flujo. */}
    sessionStorage.setItem(MASTER_KEY,code);localStorage.setItem(MASTER_KEY,code)
    navigate('/admin/login?resume=sponsor_master',{replace:true})
  }

  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[460px] items-center justify-center"><div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_18px_55px_rgba(15,23,42,.08)]"><p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-600">KAWVO LINK</p>{wrongAccount?<><h1 className="mt-3 text-2xl font-black">Usa la cuenta del patrocinador</h1><p className="mt-3 text-sm leading-6 text-slate-500">Ya hay una sesión iniciada{currentEmail?<> con <strong className="text-slate-700">{currentEmail}</strong></>:null}, pero no corresponde al correo registrado para este patrocinador.</p><p className="mt-2 text-sm leading-6 text-slate-500">Cierra esta sesión y entra con la cuenta del patrocinador para activar el Master. No perderás el código.</p><button type="button" onClick={()=>void switchAccount()} disabled={busy} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{busy?'Cerrando sesión…':'Cerrar sesión y usar cuenta patrocinador'}</button><p className="mt-4 text-xs text-slate-400">Código Master {code}</p></>:<><h1 className="mt-3 text-xl font-black">{error?'No pudimos continuar':'Validando tu acceso…'}</h1><p className={`mt-2 text-sm ${error?'text-rose-600':'text-slate-500'}`}>{error||(busy?'Un momento, estamos comprobando que la cuenta coincida con el patrocinador.':'Un momento, estamos preparando tu acceso.')}</p></>}</div></section></main>
}
