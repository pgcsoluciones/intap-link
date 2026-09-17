import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet } from '../../../lib/api'

const PROFILE_KEY='kawvo_sponsored_public_code'
const MASTER_KEY='kawvo_sponsor_master_code'
const PANEL_KEY='kawvo_sponsored_panel_resume'
function valid(value:string){return /^[A-Z2-9]{8,24}$/.test(value)}

export default function SponsoredAccessEntry(){
  const location=useLocation();const navigate=useNavigate();const[params]=useSearchParams();const[error,setError]=useState('')
  const isMaster=location.pathname.startsWith('/admin/sponsor/entry')
  const code=String(params.get('public_code')||'').trim().toUpperCase()
  useEffect(()=>{
    if(isMaster){if(!valid(code)){setError('No encontramos el código del llavero Master.');return}sessionStorage.setItem(MASTER_KEY,code);localStorage.setItem(MASTER_KEY,code)}
    else if(valid(code)){sessionStorage.setItem(PROFILE_KEY,code);localStorage.setItem(PROFILE_KEY,code)}
    else{sessionStorage.setItem(PANEL_KEY,'1');localStorage.setItem(PANEL_KEY,'1')}
    apiGet('/me').then((json:any)=>{if(json?.ok){navigate(isMaster?`/admin/sponsor?master=${encodeURIComponent(code)}`:valid(code)?`/admin/sponsored/activate?public_code=${encodeURIComponent(code)}`:'/admin/sponsored',{replace:true});return}navigate('/admin/login',{replace:true})}).catch(()=>navigate('/admin/login',{replace:true}))
  },[code,isMaster,navigate])
  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[430px] items-center justify-center"><div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_18px_55px_rgba(15,23,42,.08)]"><p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-600">KAWVO LINK</p><h1 className="mt-3 text-xl font-black">{error?'No pudimos continuar':'Validando tu acceso…'}</h1><p className={`mt-2 text-sm ${error?'text-rose-600':'text-slate-500'}`}>{error||'Un momento, estamos preparando tu acceso.'}</p></div></section></main>
}
