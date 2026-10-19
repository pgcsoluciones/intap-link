import { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../lib/api'

export default function FreeDemoV2Claim(){
  const[context,setContext]=useState<any>(null)
  const[email,setEmail]=useState('')
  const[error,setError]=useState('')
  const[busy,setBusy]=useState(false)
  const[sent,setSent]=useState(false)

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const oauthError=params.get('error')
    if(oauthError)setError(oauthError==='verified_user_already_has_free_profile'?'Ese correo ya administra otro perfil Free. Usa otra cuenta.':'No pudimos completar el acceso con Google. Intenta nuevamente.')
    apiGet('/auth/free-demo-v2-claim/context').then((j:any)=>{
      if(j?.ok)setContext(j.data)
      else setError(j?.error||'El acceso de reclamo expiró.')
    }).catch(()=>setError('No pudimos validar el reclamo.'))
  },[])

  const secureEmail=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setBusy(true);setSent(false)
    try{
      const j:any=await apiPost('/auth/magic-link/start',{email,flow:'free_demo_claim'})
      if(j?.ok)setSent(true)
      else setError(j?.error||'No pudimos enviar el acceso seguro.')
    }catch{setError('Error de conexión.')}finally{setBusy(false)}
  }

  const google=()=>{
    window.location.assign(`${API_BASE}/auth/google/start?flow=free_demo_claim`)
  }

  return <main className="min-h-screen bg-[#f7f9fc] p-5 text-slate-950">
    <section className="mx-auto mt-12 max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">KAWVO LINK</p>
      <h1 className="mt-2 text-2xl font-black">Haz tuya esta presentación</h1>
      {context&&<div className="mt-4 rounded-2xl bg-cyan-50 p-4"><strong>{context.name}</strong><div className="mt-1 text-sm text-cyan-800">intaprd.com/{context.slug}</div></div>}
      <p className="mt-4 text-sm leading-6 text-slate-600">El código de reclamo ya fue validado. Ahora identifica al propietario definitivo usando uno de los métodos normales de Kawvo.</p>
      {error&&<div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="mt-6 grid gap-3">
        <button type="button" disabled={!context||busy} onClick={google} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-900 disabled:opacity-40">Continuar con Google</button>
        <div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-slate-200"/><span className="text-xs font-bold text-slate-400">o</span><span className="h-px flex-1 bg-slate-200"/></div>
        <form onSubmit={secureEmail} className="grid gap-3">
          <label className="grid gap-2 text-sm font-black">Correo definitivo<input className="rounded-2xl border border-slate-300 p-3 font-medium" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label>
          <button disabled={busy||!context} className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">{busy?'Enviando…':'Continuar con correo seguro'}</button>
        </form>
      </div>

      {sent&&<div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><strong>Revisa tu correo.</strong><br/>Te enviamos el acceso seguro mediante el sistema normal de Kawvo. Al abrirlo se transferirá esta presentación a tu cuenta verificada.</div>}

      <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        <strong>Después del reclamo</strong><br/>Podrás administrar tu presentación como cualquier perfil Free. Si deseas una contraseña Kawvo, podrás crearla desde <strong>Mi cuenta → Credenciales</strong> usando la verificación por correo existente.
      </div>
    </section>
  </main>
}