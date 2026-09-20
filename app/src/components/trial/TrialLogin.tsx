import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'

type Mode='login'|'register'
const WEB_ORIGIN=(import.meta.env.VITE_WEB_URL??'https://intaprd.com').replace(/\/$/,'')
const LEAD_TOKEN_KEY='kawlink_trial_lead_token'
function validLeadToken(value:string){return /^[a-f0-9]{64}$/i.test(value)}

export default function TrialLogin(){
  const [mode,setMode]=useState<Mode>('register')
  const [loginMethod,setLoginMethod]=useState<'email'|'password'>('email')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const queryToken=params.get('lead_token')||''
    const queryError=params.get('error')||''
    if(validLeadToken(queryToken))sessionStorage.setItem(LEAD_TOKEN_KEY,queryToken)
    if(queryError==='trial_email_mismatch')setError('Debes usar el mismo correo que colocaste en el formulario para activar esta presentación.')
    else if(queryError==='trial_lead_invalid')setError('El enlace de activación ya no es válido. Vuelve a iniciar desde la solicitud de prueba.')
    const leadToken=validLeadToken(queryToken)?queryToken:(sessionStorage.getItem(LEAD_TOKEN_KEY)||'')
    apiGet('/me/trials/online').then((json:any)=>{
      if(json?.ok&&json?.data?.id){
        if(validLeadToken(leadToken)){window.location.replace('/trial/activate?lead_token='+encodeURIComponent(leadToken));return}
        window.location.replace(`${WEB_ORIGIN}/trial/mi/${encodeURIComponent(json.data.id)}`)
      }
    }).catch(()=>undefined)
  },[])

  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setLoading(true)
    try{
      if(mode==='login'&&loginMethod==='password'){
        const leadToken=sessionStorage.getItem(LEAD_TOKEN_KEY)||''
        const json:any=await apiPost('/auth/password/login',{email,password,lead_token:validLeadToken(leadToken)?leadToken:undefined})
        if(!json?.ok){setError(json?.error||'Correo o contraseña incorrectos.');return}
        window.location.assign('/trial/activate'+(validLeadToken(leadToken)?'?lead_token='+encodeURIComponent(leadToken):''))
        return
      }
      const leadToken=sessionStorage.getItem(LEAD_TOKEN_KEY)||''
      const json:any=await apiPost('/auth/magic-link/start',{email,mode,flow:'trial',lead_token:validLeadToken(leadToken)?leadToken:undefined})
      if(!json?.ok){setError(json?.error||'No pudimos enviar el acceso.');return}
      sessionStorage.setItem('trial_magic_link_email',email)
      window.location.assign('/trial/check-email')
    }catch{setError('Error de conexión. Inténtalo de nuevo.')}
    finally{setLoading(false)}
  }

  function google(){
    const leadToken=sessionStorage.getItem(LEAD_TOKEN_KEY)||''
    window.location.assign('/api/v1/auth/google/start?flow=trial'+(validLeadToken(leadToken)?'&lead_token='+encodeURIComponent(leadToken):''))
  }

  const register=mode==='register'
  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
      <div className="mb-7 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWLINK · PRUEBA FULL · 4 DÍAS GRATIS</p>
        <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Activa tu prueba gratuita</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-6 text-slate-500">Crea tu acceso o inicia sesión para comenzar tu presentación KawLink Full. <strong className="text-slate-700">Sin tarjeta. Sin pagos.</strong></p>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-2 gap-1 rounded-[22px] bg-slate-100 p-1">
          <button type="button" onClick={()=>{setMode('login');setError('')}} className={`rounded-[18px] px-3 py-3 text-sm font-extrabold ${!register?'bg-white text-slate-950 shadow-sm':'text-slate-500'}`}>Ya tengo cuenta</button>
          <button type="button" onClick={()=>{setMode('register');setError('');setLoginMethod('email')}} className={`rounded-[18px] px-3 py-3 text-sm font-extrabold ${register?'bg-white text-slate-950 shadow-sm':'text-slate-500'}`}>Crear acceso</button>
        </div>

        <div className="p-4 pt-5">
          {!register&&<div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={()=>setLoginMethod('email')} className={`rounded-xl px-3 py-2.5 text-xs font-black ${loginMethod==='email'?'bg-white text-slate-950 shadow-sm':'text-slate-500'}`}>Correo seguro</button>
            <button type="button" onClick={()=>setLoginMethod('password')} className={`rounded-xl px-3 py-2.5 text-xs font-black ${loginMethod==='password'?'bg-white text-slate-950 shadow-sm':'text-slate-500'}`}>Contraseña Kawvo</button>
          </div>}

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Correo electrónico
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="nombre@email.com" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"/>
              {validLeadToken(sessionStorage.getItem(LEAD_TOKEN_KEY)||'')&&<span className="mt-2 block rounded-xl bg-cyan-50 px-3 py-2 text-[11px] font-bold leading-5 text-cyan-800">Usa el mismo correo que colocaste en el formulario de registro. Ese correo será el que autoriza la activación y el acceso a tu presentación.</span>}
            </label>
            {!register&&loginMethod==='password'&&<label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Contraseña Kawvo
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"/>
            </label>}
            {error&&<p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{loading?'Procesando…':register?'Crear acceso y continuar':loginMethod==='password'?'Entrar y activar mi prueba':'Continuar con correo'}</button>
          </form>

          <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200"/><span className="text-xs font-semibold text-slate-400">o continúa con</span><span className="h-px flex-1 bg-slate-200"/></div>
          <button type="button" onClick={google} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.5 6.5 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continuar con Google
          </button>
          <p className="mt-5 text-center text-xs leading-5 text-slate-400">Tu prueba Full comienza cuando completas la activación. Tendrás 4 días completos para personalizar y compartir tu presentación.</p>
        </div>
      </div>
    </section>
  </main>
}
