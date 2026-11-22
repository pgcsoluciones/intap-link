import {useEffect,useRef,useState} from 'react'
import {API_BASE,activeIntapTabHeaders} from '../../../lib/api'
import type {SponsorSurface} from './sponsor-shell-navigation'

type Row={artifact_id:string;public_code:string;product_type:string;status:string;username?:string;business_name?:string;business_phone?:string;business_whatsapp?:string;email?:string;batch_name?:string;city?:string;zone?:string;activated_at?:string;profile_status?:string}
type Page={version:'g7.1';tenant_id:string;items:Row[];total:number;limit:number;from:number;to:number;next_cursor:string|null;previous_cursor:string|null;reset_required:boolean}
export async function readSponsorInventory(path:string,tenant:string,signal?:AbortSignal){
 const response=await fetch(API_BASE+'/sponsor/artifacts/page'+path,{credentials:'include',headers:activeIntapTabHeaders(),signal,cache:'no-store'})
 const json=await response.json().catch(()=>null)
 if(!response.ok||!json?.ok)throw Error(json?.error||(response.status===404?'El inventario no está disponible en este Preview. Puedes usar la vista anterior.':'No pudimos consultar el inventario.'))
 const data=json.data
 if(data?.version!=='g7.1'||data.tenant_id!==tenant)throw Error('El inventario no corresponde al patrocinador verificado.')
 return data
}
function pageData(data:any):Page{
 if(!Array.isArray(data.items)||data.items.length>10||data.limit!==10||!['total','from','to'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0)||data.to>data.total||data.items.some((x:any)=>!x||typeof x.artifact_id!=='string'||typeof x.public_code!=='string')||!['next_cursor','previous_cursor'].every(k=>data[k]===null||typeof data[k]==='string'&&/^[A-Za-z0-9_-]{1,2048}$/.test(data[k])))throw Error('La API devolvió una página de inventario inválida.')
 return data
}
export default function SponsorInventory({tenantId,surface,active,onNavigate,onFallback,publicOrigin,revision,onRefresh}:{tenantId:string;surface:SponsorSurface;active:boolean;onNavigate:(next:Partial<SponsorSurface>,replace?:boolean)=>void;onFallback:()=>void;publicOrigin:string;revision:number;onRefresh:()=>void}){
 const[state,setState]=useState<{status:'loading'|'ready'|'error';data?:Page;error?:string}>({status:'loading'}),[attempt,setAttempt]=useState(0),[copied,setCopied]=useState(''),serial=useRef(0)
 const commercial=surface.assignment!=='all'
 useEffect(()=>{
  const request=++serial.current,controller=new AbortController()
  if(!active||commercial)return()=>controller.abort()
  setState({status:'loading'})
  const timer=window.setTimeout(()=>{
   const p=new URLSearchParams({limit:'10',status:surface.status,q:surface.query})
   if(surface.cursor)p.set('cursor',surface.cursor)
   readSponsorInventory('?'+p.toString(),tenantId,controller.signal).then(data=>{
    if(controller.signal.aborted||request!==serial.current)return
    const page=pageData(data)
    if(page.reset_required){onNavigate({page:1,cursor:undefined},true);return}
    setState({status:'ready',data:page})
   }).catch(error=>{if(!controller.signal.aborted&&request===serial.current)setState({status:'error',error:String(error?.message||'No pudimos consultar el inventario.')})})
  },300)
  return()=>{clearTimeout(timer);controller.abort()}
 },[tenantId,active,commercial,surface.query,surface.status,surface.cursor,attempt,revision])
 const page=state.data,reset=()=>onNavigate({query:'',status:'all',assignment:'all',page:1,cursor:undefined})
 const card='rounded-2xl border border-slate-200 bg-white p-4',button='rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 disabled:opacity-40'
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setCopied(value)}catch{setCopied('No se pudo copiar.')}}
 const codeUrl=(code:string)=>publicOrigin+'/l/'+encodeURIComponent(String(code||'').trim().toUpperCase())
 const status=(row:Row)=>row.status==='available'?'Pendiente de activar':row.status==='activated'?'Activado':row.status==='inactive'?'Inactivo':row.status
 const actions=(r:Row)=><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>void copy(r.public_code)}>Copiar código</button><button type="button" className={button} onClick={()=>void copy(codeUrl(r.public_code))}>Copiar enlace NFC</button>{r.username&&<a href={publicOrigin+'/p/'+encodeURIComponent(r.username)} target="_blank" rel="noopener noreferrer" className={button}>Ver perfil</a>}</div>
 return <section aria-label="Inventario paginado" className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
  <h2 className="text-xl font-black">Códigos, clientes y comercios</h2><p className="text-sm text-slate-600">Busca los códigos y comercios de este patrocinador.</p>
  <div className="flex flex-wrap gap-2 [&_button]:!px-2 [&_button]:!text-xs sm:[&_button]:!text-sm"><button type="button" className={button} onClick={()=>{onNavigate({page:1,cursor:undefined},true);setAttempt(x=>x+1);onRefresh()}}>Actualizar</button><button type="button" className={button} onClick={onFallback}>Inventario anterior</button></div>
  <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Buscar códigos<input aria-label="Buscar códigos" type="search" placeholder="Código, comercio, correo, lote, zona…" value={surface.query} onChange={e=>onNavigate({query:e.target.value.slice(0,160),page:1,cursor:undefined},true)} className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"/></label><label className="text-sm font-bold">Estado<select aria-label="Filtrar estado" value={surface.status} onChange={e=>onNavigate({status:e.target.value,page:1,cursor:undefined})} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"><option value="all">Todos los estados</option><option value="available">Pendientes</option><option value="activated">Activados</option><option value="published">Perfil publicado</option></select></label></div>
  <div className="flex flex-wrap items-center gap-3"><button type="button" className={button} onClick={reset}>Limpiar filtros</button><p className="break-words text-sm text-slate-600">{surface.query||surface.status!=='all'?`Filtros: ${surface.query||'sin término'} · ${surface.status==='all'?'todos los estados':surface.status}`:'Sin filtros aplicados'}</p></div>
  {commercial?<div role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Hay un filtro de asignación activo. Usa el inventario anterior para aplicarlo o pulsa Limpiar filtros.</div>:state.status==='loading'?<p role="status">Cargando inventario…</p>:state.status==='error'?<div role="alert" className="space-y-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800"><p>{state.error}</p><button type="button" className={button} onClick={()=>setAttempt(x=>x+1)}>Reintentar inventario</button>{surface.cursor&&<button type="button" className={button} onClick={()=>onNavigate({page:1,cursor:undefined})}>Volver a la primera página</button>}</div>:page&&<>
   <p role="status" aria-live="polite" className="text-sm font-bold">{page.total?`Mostrando ${page.from}–${page.to} de ${page.total} códigos · Página ${Math.floor((page.from-1)/page.limit)+1} de ${Math.ceil(page.total/page.limit)}`:'No hay códigos que coincidan con estos filtros.'}</p>
   <div className="min-w-0 overflow-x-auto"><table className="hidden w-full min-w-[850px] text-left text-sm md:table"><thead><tr className="border-b text-xs text-slate-500">{['Código NFC','Producto','Estado','Cliente o comercio','Correo','Lote / zona','Acciones'].map(t=><th key={t} className="px-2 py-3">{t}</th>)}</tr></thead><tbody>{page.items.map(r=><tr key={r.artifact_id} className="border-b border-slate-100 align-top"><td className="px-2 py-4 font-bold">{r.public_code}</td><td className="px-2 py-4">{r.product_type}</td><td className="px-2 py-4">{status(r)}{r.profile_status&&<small className="block">Perfil: {r.profile_status}</small>}</td><td className="px-2 py-4">{r.business_name||'Comercio pendiente de registrar'}{(r.business_phone||r.business_whatsapp)&&<small className="block">{r.business_phone||r.business_whatsapp}</small>}</td><td className="max-w-[200px] break-all px-2 py-4">{r.email||'—'}</td><td className="px-2 py-4">{[r.batch_name,r.city,r.zone].filter(Boolean).join(' · ')||'—'}</td><td className="px-2 py-4">{actions(r)}</td></tr>)}</tbody></table></div>
   <div className="space-y-3 md:hidden">{page.items.map(r=><article key={r.artifact_id} className={card}><div className="flex flex-wrap justify-between gap-2"><strong className="break-all">{r.public_code}</strong><span className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-bold">{status(r)}</span></div><p className="mt-3 break-words text-sm font-bold">{r.business_name||'Comercio pendiente de registrar'}</p><p className="mt-2 text-sm">Producto: {r.product_type}{r.profile_status?' · Perfil: '+r.profile_status:''}</p>{r.email&&<p className="mt-2 break-all text-sm">{r.email}</p>}{(r.business_phone||r.business_whatsapp)&&<p className="mt-2 break-all text-sm">{r.business_phone||r.business_whatsapp}</p>}<p className="my-3 break-words text-xs text-slate-600">{[r.batch_name,r.city,r.zone].filter(Boolean).join(' · ')||'Sin lote o zona'}</p>{actions(r)}</article>)}</div>
   {(page.previous_cursor||page.next_cursor)&&<div className="flex flex-wrap justify-between gap-3"><button type="button" className={button} disabled={!page.previous_cursor} onClick={()=>onNavigate({page:Math.max(1,(surface.page||1)-1),cursor:page.previous_cursor||undefined})}>Anterior</button><button type="button" className={button} disabled={!page.next_cursor} onClick={()=>onNavigate({page:(surface.page||1)+1,cursor:page.next_cursor||undefined})}>Siguiente</button></div>}
  </>}
  {copied&&<p role="status" className="break-all text-xs text-slate-600">{copied==='No se pudo copiar.'?copied:'Copiado: '+copied}</p>}
 </section>
}
