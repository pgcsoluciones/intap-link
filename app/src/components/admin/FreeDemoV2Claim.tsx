import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'

export default function FreeDemoV2Claim(){
  const[context,setContext]=useState<any>(null)
  const[email,setEmail]=useState('')
  const[password,setPassword]=useState('')
  const[confirm,setConfirm]=useState('')
  const[error,setError]=useState('')
  const[busy,setBusy]=useState(false)

  useEffect(()=>{
    apiGet('/auth/free-demo-v2-claim/context').then((j:any)=>{
      if(j?.ok)setContext(j.data)
      else setError(j?.error||'El acceso de reclamo expiró.')
    }).catch(()=>setError('No pudimos validar el reclamo.'))
  },[])

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('')
    if(password!==confirm){setError('Las contraseñas no coinciden.');return}
    setBusy(true)
    try{
      const j:any=await apiPost('/auth/free-demo-v2-claim/complete',{new_email:email,password})
      if(j?.ok)window.location.assign(j.data?.next_url||'/admin/free')
      else setError(j?.error||'No pudimos completar el reclamo.')
    }catch{setError('Error de conexión.')}finally{setBusy(false)}
  }

  return <main className="min-h-screen bg-[#f7f9fc] p-5 text-slate-950">
    <section className="mx-auto mt-16 max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">KAWVO LINK</p>
      <h1 className="mt-2 text-2xl font-black">Hacer mía esta presentación</h1>
      {context&&<div className="mt-4 rounded-2xl bg-cyan-50 p-4"><strong>{context.name}</strong><div className="mt-1 text-sm text-cyan-800">/{context.slug}</div></div>}
      <p className="mt-4 text-sm leading-6 text-slate-600">Crea las credenciales definitivas. Al terminar, esta presentación deja de formar parte de las Demos administradas y pasa a tu cuenta Free.</p>
      {error&&<div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-black">Tu correo definitivo<input className="rounded-2xl border border-slate-300 p-3 font-medium" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label>
        <label className="grid gap-2 text-sm font-black">Nueva contraseña Kawvo<input className="rounded-2xl border border-slate-300 p-3 font-medium" type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label className="grid gap-2 text-sm font-black">Confirmar contraseña<input className="rounded-2xl border border-slate-300 p-3 font-medium" type="password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
        <button disabled={busy||!context} className="mt-2 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">{busy?'Transfiriendo…':'Guardar credenciales y continuar'}</button>
      </form>
    </section>
  </main>
}
