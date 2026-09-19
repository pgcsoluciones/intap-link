import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type Prospect={
  contact_name:string;phone:string;whatsapp:string;email:string;instagram:string;
  company_name:string;company_type:string;source:string;source_detail:string;notes:string
}
type Trial={
  id:string;slug:string|null;name:string|null;status:'draft'|'active'|'inactive'|'expired';
  duration_hours:number;prospect:Prospect;activated_at:string|null;expires_at:string|null;created_at:string;updated_at:string
}
type EventRow={id:string;event_type:string;details:any;created_at:string}
type Analytics={summary:{events:number;views:number;unique_visitors:number;interactions:number};events:any[];locations:any[];actions:any[];daily:any[];devices:any[];pagination:{page:number;page_size:number;total:number;pages:number}}

const sourceOptions=[
  ['', 'Todos los orígenes'],
  ['fair_event','Feria / Evento'],
  ['commercial_visit','Visita comercial'],
  ['street_direct','Calle / contacto directo'],
  ['whatsapp','WhatsApp'],
  ['instagram','Instagram'],
  ['web','Web'],
  ['referral','Referido'],
  ['call','Llamada'],
  ['point_of_sale','Punto de venta'],
  ['other','Otro'],
] as const

const sourceLabels=Object.fromEntries(sourceOptions)
const WEB_ORIGIN=(import.meta.env.VITE_WEB_URL??'https://intaprd.com').replace(/\/$/,'')
const companyTypes=['Servicios profesionales','Automotriz / Taller','Belleza / Estética','Construcción / Ferretería','Salud','Gastronomía','Tecnología','Comercio / Retail','Educación','Inmobiliaria']
const statusLabels:any={draft:'Borrador',active:'Activo',inactive:'Desactivado',expired:'Expirado'}
const eventLabels:any={visit:'Visita',whatsapp:'WhatsApp',quick_call:'Llamar',quick_instagram:'Instagram',quick_location:'Ubicación',quick_email:'Correo',quick_tiktok:'TikTok',save_contact:'Guardar contacto',portfolio_open:'Portafolio',service_open:'Servicio',custom_link:'Enlace',share:'Compartir',copy_link:'Copiar enlace',qr_open:'Abrir QR',qr_download:'Descargar QR',qr_save_photo:'Guardar QR',interest_click:'Interés'}

function formatDate(value:string|null){
  if(!value)return '—'
  const d=new Date(value.includes('T')?value:value.replace(' ','T')+'Z')
  return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-DO',{dateStyle:'medium',timeStyle:'short'})
}
function remaining(value:string|null){
  if(!value)return '—'
  const ms=new Date(value.replace(' ','T')+'Z').getTime()-Date.now()
  if(ms<=0)return 'Finalizado'
  const h=Math.ceil(ms/3600000)
  if(h<48)return `${h} h`
  return `${Math.ceil(h/24)} días`
}

export default function SuperAdminTrials(){
  const [items,setItems]=useState<Trial[]>([])
  const [page,setPage]=useState(1)
  const [pages,setPages]=useState(1)
  const [total,setTotal]=useState(0)
  const [status,setStatus]=useState('')
  const [source,setSource]=useState('')
  const [q,setQ]=useState('')
  const [debouncedQ,setDebouncedQ]=useState('')
  const [selected,setSelected]=useState<Trial|null>(null)
  const [prospect,setProspect]=useState<Prospect|null>(null)
  const [events,setEvents]=useState<EventRow[]>([])
  const [analytics,setAnalytics]=useState<Analytics|null>(null)
  const [analyticsPage,setAnalyticsPage]=useState(1)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [extendHours,setExtendHours]=useState(72)

  useEffect(()=>{const t=window.setTimeout(()=>{setDebouncedQ(q);setPage(1)},250);return()=>window.clearTimeout(t)},[q])

  async function load(){
    const params=new URLSearchParams({page:String(page),page_size:'12'})
    if(status)params.set('status',status)
    if(source)params.set('source',source)
    if(debouncedQ)params.set('q',debouncedQ)
    const json:any=await apiGet(`/superadmin/trials?${params.toString()}`)
    if(json?.ok){
      setItems(json.data.items||[])
      setPages(Number(json.data.pages||1))
      setTotal(Number(json.data.total||0))
      if(selected){
        const updated=(json.data.items||[]).find((x:Trial)=>x.id===selected.id)
        if(updated){setSelected(updated);setProspect(updated.prospect)}
      }
    }
  }
  useEffect(()=>{void load()},[page,status,source,debouncedQ])

  async function loadAnalytics(trialId:string,nextPage=1){
    const stats:any=await apiGet(`/superadmin/trials/${trialId}/analytics?page=${nextPage}&page_size=20`)
    if(stats?.ok){setAnalytics(stats.data);setAnalyticsPage(Number(stats.data?.pagination?.page||1))}
  }

  async function selectTrial(item:Trial){
    setSelected(item);setProspect(item.prospect);setMessage('');setAnalyticsPage(1)
    const [json]:any[]=await Promise.all([apiGet(`/superadmin/trials/${item.id}/events`),loadAnalytics(item.id,1)])
    setEvents(json?.ok?(json.data||[]):[])
  }

  async function saveProspect(){
    if(!selected||!prospect)return
    setSaving(true);setMessage('')
    const json:any=await apiPatch(`/superadmin/trials/${selected.id}`,{prospect})
    setSaving(false)
    if(!json?.ok){setMessage(json?.error||'No se pudo guardar.');return}
    setMessage('Ficha guardada.')
    await selectTrial({...selected,prospect})
    await load()
  }

  async function extendTrial(){
    if(!selected)return
    setSaving(true);setMessage('')
    const json:any=await apiPost(`/superadmin/trials/${selected.id}/extend`,{hours:extendHours})
    setSaving(false)
    if(!json?.ok){setMessage(json?.error||'No se pudo extender.');return}
    setMessage(`Trial extendido ${extendHours} horas.`)
    const detail:any=await apiGet(`/superadmin/trials/${selected.id}`)
    if(detail?.ok){setSelected(detail.data);setProspect(detail.data.prospect)}
    const ev:any=await apiGet(`/superadmin/trials/${selected.id}/events`)
    setEvents(ev?.ok?ev.data:[])
    await load()
  }

  async function deactivateTrial(){
    if(!selected||selected.status!=='active')return
    if(!window.confirm('¿Desactivar este Trial? El enlace se conservará, pero el perfil dejará de estar disponible públicamente.'))return
    setSaving(true);const json:any=await apiPost(`/superadmin/trials/${selected.id}/deactivate`,{});setSaving(false)
    if(!json?.ok){setMessage(json?.error||'No se pudo desactivar.');return}
    const detail:any=await apiGet(`/superadmin/trials/${selected.id}`)
    if(detail?.ok){setSelected(detail.data);setProspect(detail.data.prospect)}
    setMessage('Trial desactivado.');await load()
  }

  async function reactivateTrial(){
    if(!selected||selected.status!=='inactive')return
    setSaving(true);const json:any=await apiPost(`/superadmin/trials/${selected.id}/reactivate`,{});setSaving(false)
    if(!json?.ok){setMessage(json?.error||'No se pudo reactivar.');return}
    const detail:any=await apiGet(`/superadmin/trials/${selected.id}`)
    if(detail?.ok){setSelected(detail.data);setProspect(detail.data.prospect)}
    setMessage('Trial reactivado.');await load()
  }

  async function deleteDraft(){
    if(!selected||selected.status!=='draft')return
    if(!window.confirm('Eliminar definitivamente este borrador y sus recursos? Esta acción no se puede deshacer.'))return
    setSaving(true);const json:any=await apiDelete(`/superadmin/trials/${selected.id}`);setSaving(false)
    if(!json?.ok){setMessage(json?.error||'No se pudo eliminar.');return}
    setSelected(null);setProspect(null);setEvents([]);setAnalytics(null);await load()
  }

  const activeCount=useMemo(()=>items.filter(x=>x.status==='active').length,[items])
  const field='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500'
  const label='grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500'

  return <SuperAdminLayout currentSection="trials">
    <div className="mx-auto max-w-[1280px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">TRIALS · TRAZABILIDAD</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Gestión de Trials</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Prospectos, duración, estado y seguimiento comercial. Los Trials vencidos se conservan; no se eliminan.</p>
        </div>
        <a href={`${WEB_ORIGIN}/trial`} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">+ Crear Trial</a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Resultados filtrados</p><strong className="mt-1 block text-2xl">{total}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Activos en esta página</p><strong className="mt-1 block text-2xl">{activeCount}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Página</p><strong className="mt-1 block text-2xl">{page} / {pages}</strong></div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_.6fr_.8fr]">
          <input className={field} placeholder="Buscar nombre, empresa, teléfono, correo o slug…" value={q} onChange={e=>setQ(e.target.value)}/>
          <select className={field} value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}>
            <option value="">Todos los estados</option><option value="draft">Borrador</option><option value="active">Activo</option><option value="inactive">Desactivado</option><option value="expired">Expirado</option>
          </select>
          <select className={field} value={source} onChange={e=>{setSource(e.target.value);setPage(1)}}>
            {sourceOptions.map(([value,labelText])=><option key={value} value={value}>{labelText}</option>)}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-3">Prospecto / Trial</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Origen</th><th className="px-4 py-3">Vence</th><th className="px-4 py-3">Acción</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item=><tr key={item.id} className="align-top">
                <td className="px-4 py-4"><strong className="block text-slate-950">{item.prospect.contact_name||item.name||'Sin nombre'}</strong><span className="block text-xs text-slate-500">{item.prospect.company_name||item.prospect.company_type||'Sin empresa'}</span><code className="mt-1 block text-[11px] text-slate-400">{item.slug?'/trial/'+item.slug:'Borrador sin slug'}</code></td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status==='active'?'bg-emerald-100 text-emerald-800':item.status==='inactive'?'bg-slate-200 text-slate-700':item.status==='expired'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800'}`}>{statusLabels[item.status]}</span></td>
                <td className="px-4 py-4 text-slate-600">{item.prospect.source?(sourceLabels[item.prospect.source]||item.prospect.source):'—'}{item.prospect.source_detail&&<small className="block text-slate-400">{item.prospect.source_detail}</small>}</td>
                <td className="px-4 py-4 text-slate-600">{formatDate(item.expires_at)}<small className="block font-bold text-slate-400">{remaining(item.expires_at)}</small></td>
                <td className="px-4 py-4"><button onClick={()=>void selectTrial(item)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">Gestionar</button></td>
              </tr>)}
              {!items.length&&<tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No hay Trials con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-30">Anterior</button>
          <span className="text-xs font-bold text-slate-500">Página {page} de {pages}</span>
          <button disabled={page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))} className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-30">Siguiente</button>
        </div>
      </section>

      {selected&&prospect&&<section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wide text-cyan-700">Ficha de prospecto</p><h2 className="text-2xl font-black">{prospect.contact_name||selected.name||'Trial'}</h2><p className="text-sm text-slate-500">{selected.slug?'/trial/'+selected.slug:'Borrador'} · {statusLabels[selected.status]}</p></div>
          <div className="flex flex-wrap gap-2">
            {selected.slug&&<a className="rounded-lg border px-3 py-2 text-xs font-black" href={`${WEB_ORIGIN}/trial/${selected.slug}`} target="_blank" rel="noreferrer">Abrir Trial</a>}
            <a className="rounded-lg border px-3 py-2 text-xs font-black" href={`${WEB_ORIGIN}/trial/edit/${selected.id}`} target="_blank" rel="noreferrer">Editar perfil</a>
            {selected.status==='active'&&<button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800" onClick={()=>void deactivateTrial()}>Desactivar</button>}
            {selected.status==='inactive'&&<button className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800" onClick={()=>void reactivateTrial()}>Reactivar</button>}
            {selected.status==='draft'&&<button className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={()=>void deleteDraft()}>Eliminar definitivamente</button>}
            <button className="rounded-lg border px-3 py-2 text-xs font-black" onClick={()=>setSelected(null)}>Cerrar</button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className={label}>Nombre de contacto<input className={field} value={prospect.contact_name} onChange={e=>setProspect({...prospect,contact_name:e.target.value})}/></label>
          <label className={label}>Teléfono<input className={field} value={prospect.phone} onChange={e=>setProspect({...prospect,phone:e.target.value})}/></label>
          <label className={label}>WhatsApp<input className={field} value={prospect.whatsapp} onChange={e=>setProspect({...prospect,whatsapp:e.target.value})}/></label>
          <label className={label}>Correo<input className={field} value={prospect.email} onChange={e=>setProspect({...prospect,email:e.target.value})}/></label>
          <label className={label}>Instagram<input className={field} value={prospect.instagram} onChange={e=>setProspect({...prospect,instagram:e.target.value})}/></label>
          <label className={label}>Empresa<input className={field} value={prospect.company_name} onChange={e=>setProspect({...prospect,company_name:e.target.value})}/></label>
          <label className={label}>Tipo de empresa / actividad<input list="trial-company-types" className={field} value={prospect.company_type} onChange={e=>setProspect({...prospect,company_type:e.target.value})}/><datalist id="trial-company-types">{companyTypes.map(x=><option key={x} value={x}/>)}</datalist></label>
          <label className={label}>Origen<select className={field} value={prospect.source} onChange={e=>setProspect({...prospect,source:e.target.value})}>{sourceOptions.map(([v,l])=><option key={v} value={v}>{v?l:'Sin especificar'}</option>)}</select></label>
          <label className={label}>Detalle del origen<input className={field} placeholder="Ej. Expo Cibao Santiago 2026" value={prospect.source_detail} onChange={e=>setProspect({...prospect,source_detail:e.target.value})}/></label>
          <label className={label+' md:col-span-2 lg:col-span-3'}>Notas<textarea className={field+' min-h-24'} value={prospect.notes} onChange={e=>setProspect({...prospect,notes:e.target.value})}/></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={()=>void saveProspect()} disabled={saving} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{saving?'Guardando…':'Guardar ficha'}</button>{message&&<span className="text-sm font-bold text-slate-600">{message}</span>}</div>

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-black">Duración y vencimiento</h3>
            <p className="mt-1 text-sm text-slate-500">Duración inicial: {selected.duration_hours} horas · Vence: {formatDate(selected.expires_at)}</p>
            {selected.activated_at?<div className="mt-4 flex flex-wrap gap-2"><select className={field+' max-w-48'} value={extendHours} onChange={e=>setExtendHours(Number(e.target.value))}><option value={24}>+1 día</option><option value={48}>+2 días</option><option value={72}>+3 días</option><option value={96}>+4 días</option><option value={120}>+5 días</option><option value={144}>+6 días</option><option value={168}>+7 días</option></select><button onClick={()=>void extendTrial()} disabled={saving} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-black text-white">Extender Trial</button></div>:<div className="mt-4 flex flex-wrap gap-2"><select className={field+' max-w-48'} value={selected.duration_hours} onChange={async e=>{const duration_hours=Number(e.target.value);const json:any=await apiPatch(`/superadmin/trials/${selected.id}`,{duration_hours});if(json?.ok){setSelected({...selected,duration_hours});setMessage('Duración inicial actualizada.');await load()}else setMessage(json?.error||'No se pudo actualizar.')}}><option value={24}>1 día</option><option value={48}>2 días</option><option value={72}>3 días</option><option value={96}>4 días</option><option value={120}>5 días</option><option value={144}>6 días</option><option value={168}>7 días</option></select><span className="self-center text-xs font-bold text-amber-700">Comienza al publicar.</span></div>}
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-black">Conversión</h3>
            <p className="mt-1 text-sm text-slate-500">Preparado para asociar credenciales y convertir este prospecto en perfil definitivo.</p>
            <button disabled className="mt-4 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-black text-slate-500">Convertir en perfil definitivo · Próximamente</button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">Rendimiento del Trial</p><h3 className="mt-1 text-xl font-black text-slate-950">Actividad del perfil</h3><p className="mt-1 text-sm text-slate-500">Métricas desde la activación de esta función. No se reconstruyen visitas históricas.</p></div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-500 shadow-sm">Últimos 7 días + histórico</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Visitas',analytics?.summary?.views||0,'Aperturas del perfil'],
              ['Visitantes',analytics?.summary?.unique_visitors||0,'Navegadores identificados'],
              ['Interacciones',analytics?.summary?.interactions||0,'Clics y acciones'],
              ['Eventos',analytics?.summary?.events||0,'Actividad total'],
            ].map(([title,value,caption])=><div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><small className="font-black uppercase tracking-wide text-slate-400">{title}</small><strong className="mt-1 block text-3xl font-black text-slate-950">{value}</strong><span className="mt-1 block text-xs text-slate-400">{caption}</span></div>)}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><strong className="text-sm">Actividad por día</strong><p className="text-xs text-slate-400">Visitas e interacciones de los últimos 7 días.</p></div></div>
              <div className="mt-4 grid gap-3">{(analytics?.daily||[]).map((d:any)=>{const max=Math.max(1,...(analytics?.daily||[]).map((x:any)=>Number(x.views||0)+Number(x.interactions||0)));const totalDay=Number(d.views||0)+Number(d.interactions||0);return <div key={d.day} className="grid grid-cols-[84px_1fr_78px] items-center gap-3 text-xs"><span className="font-bold text-slate-500">{new Date(d.day+'T12:00:00').toLocaleDateString('es-DO',{weekday:'short',day:'numeric'})}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{width:`${Math.max(4,(totalDay/max)*100)}%`}}/></div><span className="text-right font-black text-slate-700">{d.views||0} / {d.interactions||0}</span></div>})}{!(analytics?.daily||[]).length&&<p className="py-6 text-center text-sm text-slate-400">Aún no hay datos suficientes.</p>}</div>
              <div className="mt-3 flex gap-4 text-[11px] text-slate-400"><span><b className="text-slate-700">Izq.</b> día</span><span><b className="text-slate-700">Der.</b> visitas / interacciones</span></div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><strong className="text-sm">Dispositivos</strong><div className="mt-3 grid gap-2">{(analytics?.devices||[]).map((x:any)=><div key={x.device_type} className="flex items-center justify-between text-sm"><span className="capitalize text-slate-600">{x.device_type||'desconocido'}</span><b>{x.n}</b></div>)}{!(analytics?.devices||[]).length&&<span className="text-sm text-slate-400">Sin datos todavía.</span>}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><strong className="text-sm">Ubicación aproximada</strong><div className="mt-3 grid gap-2">{(analytics?.locations||[]).slice(0,5).map((x:any,i:number)=><div key={i} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-600">{[x.city,x.region,x.country].filter(Boolean).join(', ')||'No disponible'}</span><b>{x.views}</b></div>)}{!(analytics?.locations||[]).length&&<span className="text-sm text-slate-400">Sin datos todavía.</span>}</div></div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><strong className="text-sm">Acciones principales</strong><p className="text-xs text-slate-400">Interacciones acumuladas.</p></div></div><div className="mt-3 grid gap-2">{(analytics?.actions||[]).map((x:any)=><div key={x.event_type} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold text-slate-600">{eventLabels[x.event_type]||x.event_type}</span><b className="rounded-full bg-white px-2 py-0.5 text-slate-900">{x.n}</b></div>)}{!(analytics?.actions||[]).length&&<span className="text-sm text-slate-400">Sin interacciones todavía.</span>}</div></div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><strong className="text-sm">Actividad reciente</strong><p className="text-xs text-slate-400">Eventos paginados para facilitar lectura y seguimiento.</p></div><span className="text-xs font-black text-slate-400">{analytics?.pagination?.total||0} registros</span></div>
              <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2">Evento</th><th className="px-3 py-2">Detalle</th><th className="px-3 py-2">Ubicación</th><th className="px-3 py-2">Campaña</th><th className="px-3 py-2">Fecha</th></tr></thead><tbody className="divide-y divide-slate-100">{(analytics?.events||[]).map((ev:any,i:number)=><tr key={i}><td className="px-3 py-2 font-black">{eventLabels[ev.event_type]||ev.event_type}</td><td className="px-3 py-2 text-slate-600">{ev.event_label||'—'}</td><td className="px-3 py-2 text-slate-600">{[ev.city,ev.region,ev.country].filter(Boolean).join(', ')||'—'}</td><td className="px-3 py-2 text-slate-600">{ev.utm_source||ev.referrer_host||'—'}{ev.utm_campaign&&<small className="block text-slate-400">{ev.utm_campaign}</small>}</td><td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDate(ev.created_at)}</td></tr>)}{!(analytics?.events||[]).length&&<tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Sin actividad pública registrada todavía.</td></tr>}</tbody></table></div>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><button disabled={analyticsPage<=1} onClick={()=>selected&&void loadAnalytics(selected.id,analyticsPage-1)} className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-30">Anterior</button><span className="text-xs font-bold text-slate-500">Página {analytics?.pagination?.page||1} de {analytics?.pagination?.pages||1}</span><button disabled={analyticsPage>=(analytics?.pagination?.pages||1)} onClick={()=>selected&&void loadAnalytics(selected.id,analyticsPage+1)} className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-30">Siguiente</button></div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-black">Trazabilidad administrativa</h3>
            <div className="mt-3 grid gap-2">{events.map(ev=><div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"><strong className="text-sm">{ev.event_type}</strong><span className="text-xs text-slate-400">{formatDate(ev.created_at)}</span></div>)}{!events.length&&<p className="text-sm text-slate-400">Los Trials existentes antes de esta función no tienen eventos históricos retroactivos.</p>}</div>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-4"><strong className="text-sm">Medición publicitaria</strong><p className="mt-1 text-sm text-slate-500">La medición propia permanece disponible sin cookies publicitarias. Meta Pixel, Conversions API y Google Ads se habilitarán más adelante con configuración y consentimiento específico para terceros.</p></div>
        </div>
      </section>}
    </div>
  </SuperAdminLayout>
}
