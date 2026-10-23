import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'

const STORAGE_KEY='kawvo_kawmed_claim_code'
const RESUME_KEY='kawvo_kawmed_claim_resume'
function valid(code:string){return /^MED-[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(code)}

export default function KawMedClaim(){
  const[params]=useSearchParams()
  const initial=String(params.get('code')||sessionStorage.getItem(STORAGE_KEY)||localStorage.getItem(STORAGE_KEY)||'').trim().toUpperCase()
  const[code,setCode]=useState(initial)
  const[context,setContext]=useState<any>(null)
  const[loading,setLoading]=useState(false)
  const[account,setAccount]=useState<any>(null)
  const[confirmed,setConfirmed]=useState(false)
  const[message,setMessage]=useState('')
  const[error,setError]=useState('')

  const lookup=async(next=code)=>{
    const normalized=next.trim().toUpperCase()
    setCode(normalized);setError('');setMessage('');setContext(null);setAccount(null);setConfirmed(false)
    if(!valid(normalized)){setError('Usa un código KawMed con formato MED-XXX-XXX.');return}
    setLoading(true)
    try{
      const j:any=await apiGet('/public/kawmed/claim/'+encodeURIComponent(normalized))
      if(!j?.ok)throw new Error(j?.error||'No pudimos validar el código.')
      setContext(j.data||null)
      if(j.data?.status==='available'){
        try{const check:any=await apiGet('/me/kawmed/claim-check/'+encodeURIComponent(normalized));if(check?.ok)setAccount(check.data||null)}catch{/* Login requerido. */}
      }
      sessionStorage.setItem(STORAGE_KEY,normalized);localStorage.setItem(STORAGE_KEY,normalized)
    }catch(e){setError(e instanceof Error?e.message:'No pudimos validar el código.')}finally{setLoading(false)}
  }

  useEffect(()=>{if(valid(initial))void lookup(initial)},[])

  const activate=async()=>{
    if(!valid(code)||!confirmed||!account?.can_activate)return
    setLoading(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/me/kawmed/claim',{code,confirm_account:true,confirm_email:account.email})
      if(j?.ok){
        sessionStorage.removeItem(STORAGE_KEY);localStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem(RESUME_KEY);localStorage.removeItem(RESUME_KEY)
        setMessage('Acceso KawMed activado. Estamos abriendo tu panel médico…')
        window.setTimeout(()=>window.location.assign(String(j.data?.next_url||'/admin/medical')),500)
        return
      }
      if(j?.error==='Unauthorized'||j?.status===401)throw Object.assign(new Error('Necesitas iniciar sesión para activar KawMed.'),{unauthorized:true})
      throw new Error(j?.error||'No pudimos activar KawMed.')
    }catch(e:any){
      if(e?.message==='Unauthorized'||e?.unauthorized){
        sessionStorage.setItem(STORAGE_KEY,code);localStorage.setItem(STORAGE_KEY,code)
        sessionStorage.setItem(RESUME_KEY,'1');localStorage.setItem(RESUME_KEY,'1')
        window.location.assign('/admin/login?resume=kawmed&med_code='+encodeURIComponent(code))
        return
      }
      setError(e instanceof Error?e.message:'No pudimos activar KawMed.')
    }finally{setLoading(false)}
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-8 font-['Inter'] text-slate-950">
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] flex-col justify-center">
      <div className="text-center"><p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-700">KAWMED</p><h1 className="mt-3 text-3xl font-black tracking-[-.04em]">Activa tu perfil médico</h1><p className="mt-2 text-sm leading-6 text-slate-500">Este acceso es exclusivo para perfiles profesionales KawMed.</p></div>
      <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xs font-black uppercase tracking-[.1em] text-slate-500">Código MED<input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,11))} placeholder="MED-ABC-123" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center font-mono text-lg font-black tracking-[.12em] outline-none focus:border-cyan-400"/></label>
        <button type="button" onClick={()=>void lookup()} disabled={loading||!valid(code)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black disabled:opacity-40">{loading?'Validando…':'Validar código'}</button>

        {context&&<div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3"><strong className="font-mono">{context.code}</strong><span className={'rounded-full px-2 py-1 text-[11px] font-black '+(context.status==='available'?'bg-emerald-50 text-emerald-700':'bg-slate-200 text-slate-600')}>{context.status==='available'?'Disponible':context.status==='claimed'?'Ya utilizado':'Inactivo'}</span></div>
          {context.sponsored?<div className="mt-3"><p className="text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">Programa patrocinado</p><p className="mt-1 text-sm font-bold">{context.sponsor_name}</p><p className="mt-1 text-xs text-slate-500">{context.program_name}</p><p className="mt-3 text-xs leading-5 text-slate-500">El patrocinio se mostrará únicamente dentro de tu entorno profesional autenticado. Tus pacientes no verán al patrocinador en tu perfil público.</p></div>:<p className="mt-3 text-sm text-slate-500">Acceso KawMed independiente, sin patrocinador asociado.</p>}
          {context.status==='available'&&<>
            {!account&&<p className="mt-4 text-sm text-amber-800">Antes de activar, inicia sesión con el correo que utilizarás exclusivamente para KawMed.</p>}
            {account&&<div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Cuenta autenticada</p><strong className="break-all">{account.email}</strong>
              {account.reason==='existing_link'&&<p className="mt-2 font-semibold text-rose-700">Este correo ya tiene una cuenta Link registrada. Utiliza otro correo para KawMed.</p>}
              {account.reason==='already_med'&&<p className="mt-2 font-semibold text-rose-700">Esta cuenta ya tiene un acceso KawMed y no puede reclamar otro código.</p>}
              {account.can_activate&&<label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Confirmo que deseo activar KawMed con este correo y comprendo que el código es de un solo uso.</span></label>}
            </div>}
            <a className="mt-3 block rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-bold" href={'/admin/login?resume=kawmed&med_code='+encodeURIComponent(code)}>{account?'Cambiar de cuenta / iniciar sesión':'Iniciar sesión o registrarme'}</a>
            <button type="button" onClick={()=>void activate()} disabled={loading||!confirmed||!account?.can_activate} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{loading?'Activando…':'Confirmar y activar KawMed'}</button>
          </>}
        </div>}

        {message&&<p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}
        {error&&<p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
        <div className="mt-4 flex justify-center gap-4 text-sm"><a href="/admin/login" className="font-semibold text-cyan-800">Ir a iniciar sesión</a><a href="/" className="font-semibold text-slate-600">Salir de la activación</a></div>
      </div>
    </section>
  </main>
}
