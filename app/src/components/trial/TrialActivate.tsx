import { useEffect, useState } from 'react'
import { apiPost } from '../../lib/api'
const WEB_ORIGIN=(import.meta.env.VITE_WEB_URL??'https://intaprd.com').replace(/\/$/,'')
export default function TrialActivate(){
  const [error,setError]=useState('')
  useEffect(()=>{
    apiPost('/me/trials/online/start',{}).then((json:any)=>{
      if(json?.ok&&json?.data?.id){window.location.replace(`${WEB_ORIGIN}/trial/mi/${encodeURIComponent(json.data.id)}`);return}
      if(json?.code==='trial_already_used'){setError('Esta cuenta ya utilizó su prueba gratuita. Inicia sesión para recuperar tu presentación o solicitar su activación.');return}
      setError(json?.error||'No pudimos activar tu prueba.')
    }).catch(()=>setError('No pudimos conectar con KawLink. Inténtalo nuevamente.'))
  },[])
  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center"><div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWLINK TRIAL</p>{error?<><h1 className="mt-3 text-xl font-black">No pudimos activar la prueba</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error}</p><a href="/trial/login" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white">Volver al acceso Trial</a></>:<><h1 className="mt-3 text-xl font-black">Activando tus 4 días Full…</h1><p className="mt-2 text-sm text-slate-500">Estamos preparando tu presentación para que puedas comenzar a personalizarla.</p></>}</div></section></main>
}
