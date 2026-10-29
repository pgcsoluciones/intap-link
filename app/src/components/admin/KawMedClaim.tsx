import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'

const STORAGE_KEY='kawvo_kawmed_claim_code'
const RESUME_KEY='kawvo_kawmed_claim_resume'
const valid=(code:string)=>/^MED-[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(code)
const loginFor=(code:string)=>'/admin/login?resume=kawmed&med_code='+encodeURIComponent(code)

export default function KawMedClaim(){
 const[params]=useSearchParams()
 const initial=String(params.get('code')||sessionStorage.getItem(STORAGE_KEY)||localStorage.getItem(STORAGE_KEY)||'').trim().toUpperCase()
 const[code]=useState(initial)
 const[context,setContext]=useState<any>(null)
 const[account,setAccount]=useState<any>(null)
 const[loading,setLoading]=useState(true)
 const[busy,setBusy]=useState(false)
 const[error,setError]=useState('')
 const[step,setStep]=useState<'scan'|'identity'|'confirm'>('scan')

 useEffect(()=>{
  let active=true
  async function check(){
   if(!valid(code)){if(active){setError('El enlace de activación no contiene un código MED válido. Solicita un enlace actualizado.');setLoading(false)}return}
   sessionStorage.setItem(STORAGE_KEY,code)
   try{
    const publicResult:any=await apiGet('/public/kawmed/claim/'+encodeURIComponent(code))
    if(!publicResult?.ok)throw Error(publicResult?.error||'Enlace de activación no disponible.')
    if(!active)return
    setContext(publicResult.data||null)
    try{
     const privateResult:any=await apiGet('/me/kawmed/claim-check/'+encodeURIComponent(code))
     if(active&&privateResult?.ok)setAccount(privateResult.data||null)
    }catch{/* La sesión puede no existir; se solicitará login. */}
   }catch(e){if(active)setError(e instanceof Error?e.message:'No se pudo verificar el enlace.')}
   finally{if(active)setLoading(false)}
  }
  void check()
  return()=>{active=false}
 },[code])

 const preserve=()=>{
  sessionStorage.setItem(STORAGE_KEY,code)
  localStorage.setItem(STORAGE_KEY,code)
  sessionStorage.setItem(RESUME_KEY,'1')
 }
 const signIn=()=>{preserve();window.location.assign(loginFor(code))}
 const switchAccount=async()=>{
  preserve();setBusy(true)
  try{await apiPost('/auth/logout',{})}catch{/* El nuevo login verifica la sesión en servidor. */}
  window.location.assign(loginFor(code))
 }
 const continueExisting=()=>{
  window.location.assign(String(account?.next_url||'/admin/medical'))
 }
 const activate=async()=>{
  if(!valid(code)||!account?.can_activate||!context||context.status!=='available')return
  setBusy(true);setError('')
  try{
   const result:any=await apiPost('/me/kawmed/claim',{code,confirm_account:true,confirm_email:account.email})
   if(result?.ok){
    sessionStorage.removeItem(STORAGE_KEY);localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(RESUME_KEY);localStorage.removeItem(RESUME_KEY)
    window.location.assign(String(result.data?.next_url||'/admin/medical'))
    return
   }
   if(result?.error==='Unauthorized'){signIn();return}
   // If another tab just activated the code, refresh its owner status rather than creating a second profile.
   const check:any=await apiGet('/me/kawmed/claim-check/'+encodeURIComponent(code)).catch(()=>null)
   if(check?.ok&&check.data?.reason==='already_owned'){setAccount(check.data);setContext((prev:any)=>({...prev,status:'claimed'}));setStep('scan');return}
   throw Error(result?.error||'No fue posible activar KawMed.')
  }catch(e){setError(e instanceof Error?e.message:'No fue posible activar KawMed.')}
  finally{setBusy(false)}
 }
 const owned=account?.reason==='already_owned'
 const canActivate=context?.status==='available'&&account?.can_activate===true
 return <main className="min-h-screen bg-slate-50 px-5 py-8 font-['Inter'] text-slate-950">
  <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] flex-col justify-center">
   <header className="text-center"><p className="text-xs font-black uppercase tracking-widest text-cyan-700">KAWMED</p><h1 className="mt-3 text-3xl font-black">Activa tu perfil médico</h1><p className="mt-2 text-sm text-slate-500">Tu enlace se comprueba automáticamente y conserva tu progreso.</p></header>
   <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
    {loading?<div role="status" className="py-8 text-center text-sm font-semibold text-slate-600">Verificando tu enlace…</div>:error&&!context?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>:<>
     {step==='scan'?<div className="space-y-4">
      <p className="text-xs font-black uppercase tracking-wide text-cyan-800">Identificación de estación · KawMed</p>
      <h2 className="text-xl font-black">Estación {context?.display_code||'sin ID físico'}</h2>
      <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Código NFC</p><p className="mt-1 font-mono text-base font-black tracking-wide">{context?.code||code}</p></div>
      <p className="text-sm text-slate-600">{context?.status==='available'?'Lista para activar':context?.status==='claimed'?'Estación ya activada':'Estación no disponible para activar'}</p>
      {context?.sponsored&&<p className="text-sm text-slate-600">Programa KawMed patrocinado: <strong>{context?.sponsor_name}</strong></p>}
      <button type="button" onClick={()=>setStep('identity')} className="w-full rounded-xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Continuar</button>
     </div>:<>
     <p className="text-xs font-black uppercase tracking-wide text-cyan-800">{owned?'Recuperar mi KawMed':step==='identity'?'Cuenta':'Confirmación'}</p>
     {owned?<div className="mt-4 space-y-3">
      <h2 className="text-xl font-black">Este KawMed ya es tuyo</h2>
      <p className="text-sm text-slate-600">Tu información guardada y el perfil en borrador siguen disponibles. Continúa configurándolo o administra tu perfil publicado.</p>
      <button type="button" onClick={continueExisting} className="w-full rounded-xl bg-slate-950 px-4 py-4 text-sm font-black text-white">{account?.special_multiaccount?'Elegir mi perfil KawMed':'Continuar mi KawMed'}</button>
      <button type="button" disabled={busy} onClick={()=>void switchAccount()} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Usar otro correo</button>
     </div>:context?.status!=='available'?<div className="mt-4 space-y-3">
      <h2 className="text-xl font-black">Este enlace ya fue utilizado o está inactivo</h2>
      <p className="text-sm text-slate-600">Si ya activaste KawMed, inicia sesión con el correo propietario para recuperar tu configuración.</p>
      <button type="button" onClick={signIn} className="w-full rounded-xl bg-slate-950 px-4 py-4 text-sm font-bold text-white">Iniciar sesión y recuperar mi perfil</button>
     </div>:step==='identity'?<div className="mt-4 space-y-3">
      <h2 className="text-xl font-black">Confirma tu cuenta</h2>
      <p className="text-sm text-slate-600">El enlace es válido. ¿Con qué correo deseas continuar?</p>
      {account?<div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Sesión detectada</p><strong className="break-all text-sm">{account.email}</strong></div>:<p className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-900">Inicia sesión para vincular el perfil a tu correo.</p>}
      {account?.reason==='existing_link'&&<p className="text-sm font-semibold text-rose-700">Esta cuenta ya tiene un perfil Link. Utiliza otro correo para este KawMed.</p>}
      {account?.reason==='already_med'&&<p className="text-sm font-semibold text-rose-700">Ya tienes otro acceso KawMed. Abre tu perfil existente o cambia de cuenta.</p>}
      {canActivate?<button type="button" onClick={()=>setStep('confirm')} className="w-full rounded-xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Continuar con este correo</button>:!account?<button type="button" onClick={signIn} className="w-full rounded-xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Iniciar sesión</button>:null}
      {account&&<button type="button" disabled={busy} onClick={()=>void switchAccount()} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Usar otro correo</button>}
     </div>:<div className="mt-4 space-y-3">
      <h2 className="text-xl font-black">Confirma la activación</h2>
      <div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="text-xs font-bold text-slate-500">Cuenta</p><strong className="break-all">{account?.email}</strong>{context?.sponsored&&<><p className="mt-3 text-xs font-bold text-slate-500">Programa patrocinado</p><strong>{context.sponsor_name}</strong><p className="text-xs text-slate-500">{context.program_name}</p></>}</div>
      <p className="text-xs text-slate-500">El patrocinio, si existe, será privado dentro del panel KawMed. Solo confirmando se consume el código y se vincula el perfil a esta cuenta.</p>
      <button type="button" disabled={busy||!canActivate} onClick={()=>void activate()} className="w-full rounded-xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{busy?'Activando…':'Confirmar y activar KawMed'}</button>
      <button type="button" onClick={()=>setStep('identity')} className="w-full text-sm font-bold text-cyan-800">Volver a la cuenta</button>
     </div>}
     </>}
     {error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    </>}
   </div>
  </section>
 </main>
}
