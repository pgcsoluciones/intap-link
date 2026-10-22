import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'

const CODE_KEY='kawvo_kawmed_master_code'
const RESUME_KEY='kawvo_kawmed_master_resume'
function valid(code:string){return /^MEDM-[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(code)}

export default function KawMedMasterClaim(){
  const[params]=useSearchParams()
  const initial=String(params.get('code')||sessionStorage.getItem(CODE_KEY)||localStorage.getItem(CODE_KEY)||'').trim().toUpperCase()
  const[code,setCode]=useState(initial)
  const[context,setContext]=useState<any>(null)
  const[loading,setLoading]=useState(false)
  const[error,setError]=useState('')
  const[message,setMessage]=useState('')
  const[currentEmail,setCurrentEmail]=useState('')
  const[wrongAccount,setWrongAccount]=useState(false)
  const[authKnown,setAuthKnown]=useState(false)

  async function lookup(next=code){
    const normalized=next.trim().toUpperCase();setCode(normalized);setError('');setMessage('');setContext(null)
    if(!valid(normalized)){setError('Usa un Master KawMed con formato MEDM-XXX-XXX.');return}
    setLoading(true)
    try{
      const j:any=await apiGet('/public/kawmed-master/'+encodeURIComponent(normalized))
      if(!j?.ok)throw new Error(j?.error||'No pudimos validar el Master KawMed.')
      setContext(j.data||null)
      sessionStorage.setItem(CODE_KEY,normalized);localStorage.setItem(CODE_KEY,normalized)
      setWrongAccount(false);setCurrentEmail('');setAuthKnown(false)
      try{
        const access:any=await apiGet('/me/kawmed-master/access/'+encodeURIComponent(normalized))
        if(access?.ok){
          setAuthKnown(true)
          setCurrentEmail(String(access.data?.current_email||''))
          setWrongAccount(access.data?.reason==='wrong_account')
        }
      }catch{/* Sin sesión: el botón Continuar llevará al login existente. */}
    }catch(e){setError(e instanceof Error?e.message:'No pudimos validar el Master KawMed.')}finally{setLoading(false)}
  }

  useEffect(()=>{if(valid(initial))void lookup(initial)},[])

  async function activate(){
    if(!valid(code))return
    setLoading(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/me/kawmed-master/claim',{code})
      if(j?.ok){
        sessionStorage.removeItem(CODE_KEY);localStorage.removeItem(CODE_KEY);sessionStorage.removeItem(RESUME_KEY);localStorage.removeItem(RESUME_KEY)
        setMessage('Master KawMed activado. Abriendo el panel del patrocinador…')
        window.setTimeout(()=>window.location.assign(String(j.data?.next_url||'/admin/sponsor/kawmed')),450)
        return
      }
      if(j?.error==='Unauthorized'||j?.status===401)throw Object.assign(new Error('Necesitas iniciar sesión para activar este Master.'),{unauthorized:true})
      if(j?.code==='kawmed_master_wrong_account'){
        setWrongAccount(true)
        const me:any=await apiGet('/me').catch(()=>null)
        if(me?.ok)setCurrentEmail(String(me?.data?.email||me?.email||''))
        return
      }
      throw new Error(j?.error||'No pudimos activar el Master KawMed.')
    }catch(e:any){
      if(e?.message==='Unauthorized'||e?.unauthorized){
        sessionStorage.setItem(CODE_KEY,code);localStorage.setItem(CODE_KEY,code);sessionStorage.setItem(RESUME_KEY,'1');localStorage.setItem(RESUME_KEY,'1')
        window.location.assign('/admin/login?resume=kawmed_master&med_master_code='+encodeURIComponent(code))
        return
      }
      setError(e instanceof Error?e.message:'No pudimos activar el Master KawMed.')
    }finally{setLoading(false)}
  }

  async function switchAccount(){
    if(!valid(code))return
    setLoading(true);setError('');setMessage('')
    try{await apiPost('/auth/logout',{})}catch{/* El login retomará el Master aunque el logout remoto falle. */}
    sessionStorage.setItem(CODE_KEY,code);localStorage.setItem(CODE_KEY,code)
    sessionStorage.setItem(RESUME_KEY,'1');localStorage.setItem(RESUME_KEY,'1')
    window.location.assign('/admin/login?resume=kawmed_master&med_master_code='+encodeURIComponent(code))
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] flex-col justify-center">
    <div className="text-center"><p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-700">KAWMED · MASTER</p><h1 className="mt-3 text-3xl font-black tracking-[-.04em]">Acceso del patrocinador</h1><p className="mt-2 text-sm leading-6 text-slate-500">Activa el acceso privado para administrar programas médicos, lotes, visitadores y trazabilidad.</p></div>
    <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-xs font-black uppercase tracking-[.1em] text-slate-500">Código Master KawMed<input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,12))} placeholder="MEDM-ABC-123" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center font-mono text-lg font-black tracking-[.1em] outline-none focus:border-cyan-400"/></label>
      <button type="button" onClick={()=>void lookup()} disabled={loading||!valid(code)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black disabled:opacity-40">{loading?'Validando…':'Validar Master'}</button>
      {context&&<div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-3">{context.logo_url&&<img src={context.logo_url} alt="" className="h-12 w-12 rounded-xl object-contain"/>}<div><p className="text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">Patrocinador KawMed</p><p className="mt-1 font-black">{context.sponsor_name}</p></div></div><div className="mt-3 flex items-center justify-between"><strong className="font-mono">{context.master_code}</strong><span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{context.status==='claimed'?'Activado':context.status==='inactive'?'Inactivo':'Disponible'}</span></div>{authKnown&&currentEmail&&<div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"><p className="text-[11px] font-black uppercase tracking-[.08em] text-slate-400">Sesión actual</p><p className="mt-1 break-all font-bold text-slate-700">{currentEmail}</p></div>}{context.status!=='inactive'&&!wrongAccount&&<button type="button" onClick={()=>void activate()} disabled={loading} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{loading?'Activando…':'Continuar con mi cuenta'}</button>}{wrongAccount&&<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left"><p className="text-sm font-black text-rose-700">Esta sesión no corresponde al correo autorizado para este patrocinador.</p><p className="mt-2 text-xs leading-5 text-rose-600">{currentEmail?<>La sesión actual es <strong>{currentEmail}</strong>. </>:null}Cierra esta sesión e inicia con la cuenta autorizada. El código Master se conservará.</p><button type="button" onClick={()=>void switchAccount()} disabled={loading} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{loading?'Cerrando sesión…':'Cerrar sesión y usar correo autorizado'}</button></div>}</div>}
      {message&&<p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}
      {error&&<p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
    </div>
  </section></main>
}
