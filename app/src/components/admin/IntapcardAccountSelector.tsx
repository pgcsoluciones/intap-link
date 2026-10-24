import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'

type AccountItem={
  id:string;kind:'medical'|'medical_master'|'sponsor'|'sponsored'|'free'|'trial'
  title:string;detail?:string;sponsor?:string;status?:string
}
const labels:Record<AccountItem['kind'],string>={
  medical:'KawMed · Perfil médico',medical_master:'KawMed · Master patrocinador',
  sponsor:'Kawvo Link · Patrocinador',sponsored:'Kawvo Link · Patrocinado',
  free:'Kawvo Link · Free',trial:'Kawvo Link · Trial'
}

export default function IntapcardAccountSelector(){
  const[items,setItems]=useState<AccountItem[]>([])
  const[loading,setLoading]=useState(true)
  const[busy,setBusy]=useState('')
  const[error,setError]=useState('')
  useEffect(()=>{let alive=true;apiGet('/me/intapcard/accounts').then((r:any)=>{
    if(!alive)return
    if(!r?.ok)throw new Error(r?.error||'No se pudieron cargar las cuentas.')
    setItems(Array.isArray(r.data?.items)?r.data.items:[])
  }).catch((e:Error)=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)})
  return()=>{alive=false}},[])

  async function choose(item:AccountItem){
    const key=item.kind+':'+item.id
    setBusy(key);setError('')
    try{
      if(item.kind==='medical'){
        const j:any=await apiPost('/me/intapcard/medical-context',{profile_id:item.id})
        if(!j?.ok)throw new Error(j?.error||'No se pudo seleccionar el perfil médico.')
        window.location.assign('/admin/medical')
      }else if(item.kind==='sponsor'||item.kind==='medical_master'){
        const j:any=await apiPost('/sponsor/context',{sponsor_id:item.id})
        if(!j?.ok)throw new Error(j?.error||'No se pudo seleccionar el patrocinador.')
        window.location.assign(item.kind==='medical_master'?'/admin/sponsor/kawmed':'/admin/sponsor')
      }else if(item.kind==='sponsored'){
        window.location.assign('/admin/sponsored?profile_id='+encodeURIComponent(item.id))
      }else if(item.kind==='free'){
        window.location.assign('/admin/free')
      }else if(item.kind==='trial'){
        const host=window.location.hostname
        const origin=host==='app.preview.intaprd.com'?'https://preview.intaprd.com':'https://intaprd.com'
        window.location.assign(origin+'/trial/mi/'+encodeURIComponent(item.id))
      }
    }catch(e){setError(e instanceof Error?e.message:'No se pudo seleccionar la cuenta.');setBusy('')}
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 font-['Inter'] text-slate-950">
    <div className="mx-auto max-w-[1020px] space-y-5">
      <header className="rounded-[28px] border border-slate-200 bg-white p-6">
        <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Intapcard · Multicuenta</p>
        <h1 className="mt-2 text-3xl font-black">Selecciona la cuenta que deseas administrar</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Cada perfil tiene sus propios códigos, datos y configuración. Seleccionar una cuenta nunca crea ni modifica otra.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="/claim/kawmed" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800">+ Activar nuevo código MED</a>
          <a href="/admin/sponsored/entry" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black">+ Activar código patrocinado</a>
        </div>
      </header>
      {loading&&<p role="status" className="rounded-2xl bg-white p-5 text-sm">Cargando cuentas…</p>}
      {error&&<p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>}
      {!loading&&!error&&items.length===0&&<p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">No existen cuentas registradas para este correo.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(item=><article key={item.kind+':'+item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">{labels[item.kind]}</p>
          <h2 className="mt-2 text-xl font-black">{item.title}</h2>
          {item.sponsor&&<p className="mt-1 text-sm font-semibold text-slate-600">{item.sponsor}</p>}
          {item.detail&&<p className="mt-2 break-all text-xs text-slate-500">{item.detail}</p>}
          {item.status&&<p className="mt-1 text-xs text-slate-500">Estado: {item.status}</p>}
          <button type="button" disabled={Boolean(busy)} onClick={()=>void choose(item)} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            {busy===item.kind+':'+item.id?'Abriendo…':'Administrar esta cuenta'}
          </button>
        </article>)}
      </div>
    </div>
  </main>
}
