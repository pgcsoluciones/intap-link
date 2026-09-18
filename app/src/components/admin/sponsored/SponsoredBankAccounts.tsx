import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/api'

type Bank={id:string;bank_name:string;account_number:string;account_type:'savings'|'checking';currency:'DOP'|'USD';holder_name:string;sort_order:number}
const MAX_ACTIVE=3
const BANKS=[
  'Banco Vimenca','Banco Promerica','Banco Popular Dominicano','Banco BDI','Banco Santa Cruz','Banco BHD León','Banco Ademi','Banesco','Scotiabank República Dominicana','La Nacional Ahorros y Préstamos','Banco de Reservas','Citi','Banco Caribe','Banco López de Haro','Bellbank','Banco Múltiple Activo Dominicana','Banco LAFISE','Asociación Cibao de Ahorros y Préstamos','Otro banco',
]
const blank={bank_name:'Banco Popular Dominicano',account_number:'',account_type:'savings' as const,currency:'DOP' as const,holder_name:''}

function bankInitials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'B'}

export function SponsoredBankAccountsSection({mode='beneficiary',profileId}:{mode?:'beneficiary'|'master';profileId?:string}={}){
  const params=new URLSearchParams();if(mode==='master')params.set('scope','master');else if(profileId)params.set('profile_id',profileId);const scopeQuery=params.toString()?`?${params.toString()}`:''
  const[enabled,setEnabled]=useState(false)
  const[items,setItems]=useState<Bank[]>([])
  const[form,setForm]=useState<any>(blank)
  const[editingId,setEditingId]=useState<string|null>(null)
  const[saving,setSaving]=useState(false)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[message,setMessage]=useState('')
  const remaining=useMemo(()=>Math.max(0,MAX_ACTIVE-items.length),[items.length])
  async function load(){setLoading(true);setError('');try{const j:any=await apiGet(`/me/sponsored-profile/bank-accounts${scopeQuery}`);if(!j?.ok)throw new Error(j?.error||'No pudimos cargar las cuentas.');setEnabled(Boolean(j.data?.enabled));setItems(Array.isArray(j.data?.items)?j.data.items:[])}catch(e){setError(e instanceof Error?e.message:'No pudimos cargar las cuentas.')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  function reset(){setEditingId(null);setForm(blank)}
  function startEdit(item:Bank){setEditingId(item.id);setForm({...item});document.getElementById('sponsored-bank-accounts')?.scrollIntoView({behavior:'smooth',block:'start'})}
  async function save(){if(saving)return;setError('');setMessage('');if(!form.bank_name.trim()||String(form.account_number||'').replace(/\s+/g,'').length<4||!form.holder_name.trim()){setError('Completa banco, número de cuenta y titular.');return}setSaving(true);try{const payload={...form,account_number:String(form.account_number||'').replace(/\s+/g,'')};const j:any=editingId?await apiPatch(`/me/sponsored-profile/bank-accounts/${editingId}${scopeQuery}`,payload):await apiPost(`/me/sponsored-profile/bank-accounts${scopeQuery}`,payload);if(!j?.ok)throw new Error(j?.error||'No pudimos guardar la cuenta.');setMessage(editingId?'Cuenta actualizada.':'Cuenta agregada.');reset();await load()}catch(e){setError(e instanceof Error?e.message:'No pudimos guardar la cuenta.')}finally{setSaving(false)}}
  async function remove(id:string){if(saving||!window.confirm('¿Eliminar esta cuenta bancaria?'))return;setSaving(true);setError('');setMessage('');try{const j:any=await apiDelete(`/me/sponsored-profile/bank-accounts/${id}${scopeQuery}`);if(!j?.ok)throw new Error(j?.error||'No pudimos eliminar la cuenta.');if(editingId===id)reset();setMessage('Cuenta eliminada.');await load()}catch(e){setError(e instanceof Error?e.message:'No pudimos eliminar la cuenta.')}finally{setSaving(false)}}
  if(loading)return <section id="sponsored-bank-accounts" data-sponsored-tour="bank-accounts" className="rounded-[26px] border border-slate-200 bg-white p-5"><p className="text-sm font-semibold text-slate-400">Cargando cuentas bancarias…</p></section>
  if(!enabled)return null
  return <section id="sponsored-bank-accounts" data-sponsored-tour="bank-accounts" className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.04)]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.12em] text-cyan-700">Cuentas bancarias</p><h2 className="mt-1 text-xl font-black">Facilita las transferencias bancarias</h2><p className="mt-1 text-sm leading-6 text-slate-500">Agrega hasta 3 cuentas para que tus clientes copien los datos necesarios desde tu perfil.</p></div><span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">{items.length}/{MAX_ACTIVE}</span></div>
    {(error||message)&&<p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-black ${error?'bg-rose-50 text-rose-700':'bg-emerald-50 text-emerald-700'}`}>{error||message}</p>}
    {(items.length<MAX_ACTIVE||editingId)&&<div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.1em] text-slate-400">{editingId?'Editar cuenta':'Agregar cuenta'}</p><p className="mt-1 text-lg font-black">{editingId?'Actualiza los datos':`${remaining} ${remaining===1?'espacio disponible':'espacios disponibles'}`}</p></div>{editingId&&<button type="button" onClick={reset} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600">Cancelar</button>}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="text-sm font-black text-slate-700">Banco</span><select value={form.bank_name} onChange={e=>setForm({...form,bank_name:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-semibold">{BANKS.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
        <label className="block sm:col-span-2"><span className="text-sm font-black text-slate-700">Número de cuenta</span><input value={form.account_number||''} onChange={e=>setForm({...form,account_number:e.target.value.replace(/[^0-9A-Za-z ]/g,'')})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-semibold tracking-wide outline-none focus:border-cyan-400"/></label>
        <label className="block"><span className="text-sm font-black text-slate-700">Tipo de cuenta</span><select value={form.account_type} onChange={e=>setForm({...form,account_type:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-semibold"><option value="savings">Ahorros</option><option value="checking">Corriente</option></select></label>
        <label className="block"><span className="text-sm font-black text-slate-700">Moneda</span><select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-semibold"><option value="DOP">Peso dominicano (DOP)</option><option value="USD">Dólar (USD)</option></select></label>
        <label className="block sm:col-span-2"><span className="text-sm font-black text-slate-700">Titular</span><input value={form.holder_name||''} onChange={e=>setForm({...form,holder_name:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-cyan-400"/></label>
      </div>
      <button type="button" onClick={()=>void save()} disabled={saving} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{saving?'Guardando…':editingId?'Guardar cambios':'Agregar cuenta'}</button>
    </div>}
    <div className="mt-5 space-y-3">{items.length===0?<div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><p className="font-black text-slate-700">Todavía no has agregado cuentas</p><p className="mt-1 text-sm text-slate-500">Cuando agregues una, aparecerá aquí y en tu perfil público.</p></div>:items.map((item,index)=><article key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">{bankInitials(item.bank_name)}</div><div className="min-w-0 flex-1"><h3 className="truncate text-base font-black">{item.bank_name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wide text-cyan-700">{item.account_type==='savings'?'Ahorros':'Corriente'} · {item.currency}</p><p className="mt-3 text-sm font-bold text-slate-900">{item.holder_name}</p><p className="mt-1 font-mono text-sm font-bold tracking-wide text-slate-500">{item.account_number}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={()=>startEdit(item)} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-black text-slate-700">Editar</button><button type="button" onClick={()=>void remove(item.id)} className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-black text-rose-700">Eliminar</button></div></article>)}</div>
  </section>
}


export default function SponsoredBankAccounts(){const params=new URLSearchParams(window.location.search);const fromSponsor=params.get('from')==='sponsor';const profileId=String(params.get('profile_id')||'');const backHref=fromSponsor?'/admin/sponsor':profileId?`/admin/sponsored?profile_id=${encodeURIComponent(profileId)}`:'/admin/sponsored';return <main className="min-h-screen bg-[#f7f9fc] px-4 py-7 font-['Inter'] text-slate-950"><div className="mx-auto max-w-[820px]"><a href={backHref} className="mb-4 inline-flex text-xs font-black text-cyan-700 no-underline">← {fromSponsor?'Panel patrocinador':'Mi presentación'}</a><SponsoredBankAccountsSection profileId={profileId||undefined}/></div></main>}
