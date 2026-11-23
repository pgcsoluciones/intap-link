import {useEffect,useRef,useState} from 'react'
import {apiGet} from '../../../lib/api'

type Resource='sellers'|'assignments'
type Row=Record<string,string|number|null>
type Page={tenant_id:string;items:Row[];total:number;page:number;limit:number;has_previous:boolean;has_more:boolean;reset_required:boolean}
const input='w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm'
const button='min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40'
function rowText(row:Row,key:string){return String(row[key]??'').trim()}
export default function SponsorCommercialPages({tenantId,role,onOpenLegacy}:{tenantId:string;role:'seller'|'visitor';onOpenLegacy:()=>void}){
 const [resource,setResource]=useState<Resource>('sellers')
 const [search,setSearch]=useState(''),[term,setTerm]=useState('')
 const [state,setState]=useState('all'),[page,setPage]=useState(1)
 const [data,setData]=useState<Page|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 const serial=useRef(0)
 const label=role==='visitor'?'visitadores':'vendedores'
 useEffect(()=>{const timer=window.setTimeout(()=>setTerm(search.trim()),300);return()=>window.clearTimeout(timer)},[search])
 useEffect(()=>{setPage(1);setData(null)},[tenantId,resource,state,term])
 useEffect(()=>{
  const id=++serial.current
  let alive=true
  setLoading(true);setError('');setData(null)
  const qs=new URLSearchParams({limit:'10',page:String(page),state})
  if(term)qs.set('q',term)
  apiGet('/sponsor/commercial/'+resource+'/page?'+qs.toString())
   .then((r:any)=>{
    if(!alive||id!==serial.current)return
    if(!r?.ok||r.data?.version!=='g7.2-a'||r.data?.resource!==resource||r.data?.tenant_id!==tenantId||!Array.isArray(r.data?.items))
      throw new Error(r?.error||'El listado comercial G7.2 no está disponible para este patrocinador.')
    const result=r.data as Page
    if(result.reset_required){setPage(1);return}
    setData(result)
   })
   .catch(e=>{if(alive&&id===serial.current)setError(e instanceof Error?e.message:'No se pudo cargar el listado.')})
   .finally(()=>{if(alive&&id===serial.current)setLoading(false)})
  return()=>{alive=false}
 },[tenantId,resource,page,state,term,revision])
 const changeResource=(next:Resource)=>{setResource(next);setPage(1)}
 return <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6" data-testid="g7-2-commercial-paged">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
   <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-cyan-800">Gestión comercial · G7.2 Preview</p>
    <h2 className="mt-1 text-xl font-black text-slate-900">Listados paginados</h2>
    <p className="mt-1 text-sm text-slate-600">Busca y consulta {label} o asignaciones sin descargar la lista completa.</p>
   </div>
   <button type="button" className={button} onClick={onOpenLegacy}>Gestionar asignaciones (G5)</button>
  </div>
  <div className="mt-5 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de listado">
   <button type="button" aria-pressed={resource==='sellers'} className={button+(resource==='sellers'?' border-cyan-700 bg-cyan-50 text-cyan-900':'')} onClick={()=>changeResource('sellers')}>{role==='visitor'?'Visitadores':'Vendedores'}</button>
   <button type="button" aria-pressed={resource==='assignments'} className={button+(resource==='assignments'?' border-cyan-700 bg-cyan-50 text-cyan-900':'')} onClick={()=>changeResource('assignments')}>Asignaciones</button>
  </div>
  <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
   <label className="min-w-0 text-xs font-semibold text-slate-600">Buscar
    <input className={input+' mt-1'} value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder={resource==='sellers'?'Nombre, código, zona o WhatsApp':'Código NFC, grupo o responsable'} aria-label="Buscar en listado comercial"/>
   </label>
   <label className="text-xs font-semibold text-slate-600">Estado
    <select className={input+' mt-1'} value={state} onChange={e=>setState(e.target.value)} aria-label="Filtrar estado"><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>
   </label>
  </div>
  {loading&&<p role="status" className="mt-4 text-sm text-slate-600">Cargando página {page}…</p>}
  {error&&<div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
   {error}<div className="mt-3"><button type="button" className={button} onClick={()=>{setPage(1);setRevision(v=>v+1)}}>Reintentar desde el inicio</button></div>
  </div>}
  {!loading&&!error&&data&&<>
   <p className="mt-4 text-sm font-semibold text-slate-700" role="status">{data.total===0?'No hay resultados.':data.total+' registros · página '+data.page+' · mostrando '+data.items.length}</p>
   <div className="mt-3 grid min-w-0 gap-2">
    {data.items.map(row=><article key={rowText(row,'id')} className="min-w-0 rounded-xl border border-slate-200 p-3">
     {resource==='sellers'?<>
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-words font-bold text-slate-900">{rowText(row,'first_name')} {rowText(row,'last_name')}</p>
       <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{Number(row.active)===1?'Activo':'Inactivo'}</span></div>
      <p className="mt-1 break-all text-sm text-slate-700">{rowText(row,'whatsapp')}</p>
      <p className="mt-1 text-xs text-slate-500">{[rowText(row,'employee_code'),rowText(row,'zone'),rowText(row,'territory')].filter(Boolean).join(' · ')}</p>
     </>:<>
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-all font-mono text-sm font-bold">{rowText(row,'public_code')}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{Number(row.active)===1?'Actual':'Histórica'}</span></div>
      <p className="mt-1 break-words text-sm font-semibold">{rowText(row,'representative_name')}</p>
      {rowText(row,'group_label')&&<p className="mt-1 text-xs text-slate-500">{rowText(row,'group_label')}</p>}
     </>}
    </article>)}
   </div>
   <nav aria-label="Paginación comercial" className="mt-5 flex flex-wrap items-center justify-between gap-3">
    <button type="button" className={button} disabled={!data.has_previous} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</button>
    <span className="text-sm font-semibold">Página {data.page} de {Math.max(1,Math.ceil(data.total/data.limit))}</span>
    <button type="button" className={button} disabled={!data.has_more} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
   </nav>
  </>}
 </section>
}
