import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'

type CredentialsStatus = {
  email: string
  password_enabled: boolean
  google_linked: boolean
  google_email?: string | null
  secure_email_access: boolean
}

type Flow = 'idle' | 'password-code' | 'password-new' | 'email-current-code' | 'email-new' | 'email-new-code'
type Props = { backTo?: string; onBack?: () => void; embedded?: boolean }

export default function FreeCredentials({backTo='/admin/free/account',onBack,embedded=false}:Props) {
  const navigate = useNavigate()
  const [status,setStatus]=useState<CredentialsStatus|null>(null)
  const [flow,setFlow]=useState<Flow>('idle')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [code,setCode]=useState('')
  const [password,setPassword]=useState('')
  const [password2,setPassword2]=useState('')
  const [newEmail,setNewEmail]=useState('')
  const publicUrl=useMemo(()=>'',[])

  const load=async()=>{const j:any=await apiGet('/me/account/credentials').catch(()=>({ok:false}));if(j?.ok)setStatus(j.data)}
  useEffect(()=>{void load()},[])

  const startVerify=async(purpose:'password'|'email_change')=>{
    setBusy(true);setMessage('');setCode('')
    const j:any=await apiPost('/me/account/credentials/verify/start',{purpose}).catch(()=>({ok:false,error:'No pudimos enviar el código.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos enviar el código.')
    setFlow(purpose==='password'?'password-code':'email-current-code');setMessage('Te enviamos un código de 6 dígitos a tu correo actual.')
  }
  const confirmVerify=async(purpose:'password'|'email_change')=>{
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/credentials/verify/confirm',{purpose,code}).catch(()=>({ok:false,error:'No pudimos validar el código.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'Código inválido.')
    setCode('');setFlow(purpose==='password'?'password-new':'email-new')
  }
  const savePassword=async()=>{
    if(password.length<8)return setMessage('La contraseña debe tener al menos 8 caracteres.')
    if(password!==password2)return setMessage('Las contraseñas no coinciden.')
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/password',{password}).catch(()=>({ok:false,error:'No pudimos guardar la contraseña.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos guardar la contraseña.')
    setFlow('idle');setPassword('');setPassword2('');setMessage('Contraseña Kawvo actualizada.');await load()
  }
  const startEmailNew=async()=>{
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/email/change/start',{new_email:newEmail}).catch(()=>({ok:false,error:'No pudimos validar el nuevo correo.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos continuar.')
    setCode('');setFlow('email-new-code');setMessage(`Enviamos un código a ${newEmail}.`)
  }
  const confirmEmailNew=async()=>{
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/email/change/confirm',{new_email:newEmail,code}).catch(()=>({ok:false,error:'No pudimos cambiar el correo.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos cambiar el correo.')
    setFlow('idle');setCode('');setNewEmail('');setMessage('Correo principal actualizado.');await load()
  }
  const goBack=()=>{if(onBack){onBack();return}navigate(backTo)}

  return <main className={`${embedded?'bg-white':'min-h-screen bg-white pb-24'} font-['Inter'] text-slate-900`}><section className="mx-auto w-full max-w-[430px] px-5 pt-6 pb-8">
    <div className="flex items-center gap-3 pb-5"><button type="button" onClick={goBack} className="text-[34px] font-light text-slate-500">←</button><div><h1 className="text-[30px] font-black tracking-[-.04em]">Credenciales</h1><p className="text-sm text-slate-500">Elige cómo acceder a tu cuenta Kawvo.</p></div></div>

    <div className="rounded-[24px] bg-[#f5f5f5] p-5">
      <p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Correo principal</p><p className="mt-2 break-all text-lg font-black">{status?.email||'Cargando…'}</p><p className="mt-1 text-sm leading-6 text-slate-500">Se usa para acceso seguro, verificaciones y recuperación de tu cuenta.</p>
      <button type="button" onClick={()=>void startVerify('email_change')} disabled={busy||!status} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-cyan-700 disabled:opacity-40">Cambiar correo</button>
    </div>

    <div className="mt-4 rounded-[24px] bg-[#f5f5f5] p-5">
      <p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Métodos de acceso</p>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4"><div><p className="font-black">Google</p><p className="mt-1 text-xs text-slate-500">{status?.google_linked?`Conectado${status.google_email?` · ${status.google_email}`:''}`:'Disponible desde el inicio de sesión'}</p></div><span className="text-emerald-600 font-black">{status?.google_linked?'✓':'○'}</span></div>
        <div className="flex items-center justify-between rounded-2xl bg-white p-4"><div><p className="font-black">Correo seguro</p><p className="mt-1 text-xs text-slate-500">Código/enlace enviado a tu correo principal</p></div><span className="text-emerald-600 font-black">✓</span></div>
        <div className="rounded-2xl bg-white p-4"><div className="flex items-center justify-between"><div><p className="font-black">Contraseña Kawvo</p><p className="mt-1 text-xs text-slate-500">Independiente de la contraseña de tu correo</p></div><span className={`font-black ${status?.password_enabled?'text-emerald-600':'text-slate-400'}`}>{status?.password_enabled?'✓':'○'}</span></div><button type="button" onClick={()=>void startVerify('password')} disabled={busy||!status} className="mt-3 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{status?.password_enabled?'Cambiar contraseña':'Crear contraseña'}</button></div>
      </div>
    </div>

    {flow==='password-code'||flow==='email-current-code'?<div className="mt-4 rounded-[24px] border border-cyan-100 bg-cyan-50 p-5"><h2 className="text-lg font-black">Confirma que eres tú</h2><p className="mt-1 text-sm text-slate-600">Ingresa el código enviado a {status?.email}.</p><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="mt-4 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-[.2em]"/><button type="button" onClick={()=>void confirmVerify(flow==='password-code'?'password':'email_change')} disabled={busy||code.length!==6} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Validar código</button></div>:null}

    {flow==='password-new'?<form onSubmit={e=>{e.preventDefault();void savePassword()}} className="mt-4 rounded-[24px] border border-slate-200 p-5"><h2 className="text-lg font-black">Nueva contraseña Kawvo</h2><p className="mt-1 text-sm text-slate-500">No tiene relación con la contraseña de tu correo.</p><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm"/><input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} autoComplete="new-password" placeholder="Repetir contraseña" className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm"/><button type="submit" disabled={busy} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Guardar contraseña</button></form>:null}

    {flow==='email-new'?<form onSubmit={e=>{e.preventDefault();void startEmailNew()}} className="mt-4 rounded-[24px] border border-slate-200 p-5"><h2 className="text-lg font-black">Nuevo correo</h2><p className="mt-1 text-sm text-slate-500">Primero verificaremos que el nuevo correo también te pertenece.</p><input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} autoComplete="email" placeholder="nuevo@email.com" className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm"/><button type="submit" disabled={busy||!newEmail} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Enviar código al nuevo correo</button></form>:null}

    {flow==='email-new-code'?<div className="mt-4 rounded-[24px] border border-cyan-100 bg-cyan-50 p-5"><h2 className="text-lg font-black">Confirma el nuevo correo</h2><p className="mt-1 text-sm text-slate-600">Código enviado a {newEmail}.</p><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="mt-4 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-[.2em]"/><button type="button" onClick={()=>void confirmEmailNew()} disabled={busy||code.length!==6} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Confirmar nuevo correo</button></div>:null}

    {message&&<p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{message}</p>}
    <p className="mt-6 text-xs leading-5 text-slate-400">Los cambios sensibles requieren verificación por correo. Google y el acceso seguro por correo continúan disponibles aunque configures una contraseña Kawvo.</p>
  </section></main>
}
