import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { apiGet, apiPatch, apiPost } from '../../../lib/api'

type Rep={id:string;employee_code?:string;first_name:string;last_name?:string;whatsapp:string;email?:string;zone?:string;territory?:string;active?:number;codes_total?:number;doctors_active?:number}
type Batch={id:string;name:string;program_name?:string;codes_total?:number;codes_claimed?:number}
type Code={id:string;code:string;status:string;station_number?:number|null;batch_id?:string;batch_name?:string;program_name?:string;medical_name?:string;professional_prefix?:string;medical_specialty?:string;medical_phone?:string;medical_email?:string;medical_slug?:string;representative_id?:string;representative_first_name?:string;representative_last_name?:string;representative_whatsapp?:string;representative_zone?:string;assignment_group?:string;representative_assigned_at?:string;claimed_at?:string}
type Overview={sponsor:{id:string;name:string;role:string};programs:any[];batches:Batch[];representatives:Rep[];codes:Code[]}

const input='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'
const label='block text-[11px] font-black uppercase tracking-[.08em] text-slate-500'
const card='rounded-[24px] border border-slate-200 bg-white p-5'

function repName(rep?:Partial<Rep>|null){return [rep?.first_name,rep?.last_name].filter(Boolean).join(' ').trim()||'Sin asignar'}
function station(code:Code){return code.station_number?String(code.station_number).padStart(3,'0'):'—'}

export default function SponsorKawMed(){
  const[data,setData]=useState<Overview|null>(null)
  const[sponsorAccounts,setSponsorAccounts]=useState<any[]>([])
  const[currentSponsorId,setCurrentSponsorId]=useState('')
  const[loading,setLoading]=useState(true)
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState('')
  const[error,setError]=useState('')
  const[selected,setSelected]=useState<string[]>([])
  const[repId,setRepId]=useState('')
  const[batchId,setBatchId]=useState('')
  const[quantity,setQuantity]=useState(10)
  const[groupLabel,setGroupLabel]=useState('')
  const[query,setQuery]=useState('')
  const[status,setStatus]=useState('all')
  const[repFilter,setRepFilter]=useState('all')
  const[newRep,setNewRep]=useState({employee_code:'',first_name:'',last_name:'',whatsapp:'',email:'',zone:'',territory:''})
  const[importRows,setImportRows]=useState<any[]>([])

  async function load(){
    setLoading(true);setError('')
    try{
      const[j,accounts]:any[]=await Promise.all([apiGet('/sponsor/kawmed/overview'),apiGet('/sponsor/accounts')])
      if(!j?.ok)throw new Error(j?.error||'No pudimos abrir KawMed.')
      setData(j.data)
      if(accounts?.ok){setSponsorAccounts(Array.isArray(accounts.data?.accounts)?accounts.data.accounts:[]);setCurrentSponsorId(String(accounts.data?.current_sponsor_id||j.data?.sponsor?.id||''))}
    }catch(e){setError(e instanceof Error?e.message:'No pudimos abrir KawMed.')}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  async function changeSponsorAccount(sponsorId:string){
    if(!sponsorId||sponsorId===currentSponsorId)return
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/sponsor/context',{sponsor_id:sponsorId})
      if(!j?.ok)throw new Error(j?.error||'No pudimos cambiar de patrocinador.')
      window.location.assign('/admin/sponsor/kawmed')
    }catch(e){setError(e instanceof Error?e.message:'No pudimos cambiar de patrocinador.');setBusy(false)}
  }

  const codes=data?.codes||[],reps=data?.representatives||[],batches=data?.batches||[]
  const currentAccount=sponsorAccounts.find((account:any)=>String(account.sponsor_id)===currentSponsorId)
  const hasNormalMaster=Number(currentAccount?.has_normal_master||0)===1
  const firstMedicalProfile=codes.find((code:any)=>code.status==='claimed'&&code.medical_slug)
  const stats=useMemo(()=>({
    total:codes.length,
    active:codes.filter(c=>c.status==='claimed').length,
    pending:codes.filter(c=>c.status==='available').length,
    assigned:codes.filter(c=>Boolean(c.representative_id)).length,
  }),[codes])

  const filtered=useMemo(()=>codes.filter(c=>{
    if(status!=='all'&&c.status!==status)return false
    if(repFilter==='unassigned'&&c.representative_id)return false
    if(repFilter!=='all'&&repFilter!=='unassigned'&&c.representative_id!==repFilter)return false
    const q=query.trim().toLowerCase()
    if(!q)return true
    return [c.code,c.batch_name,c.program_name,c.assignment_group,c.medical_name,c.medical_specialty,c.medical_phone,c.medical_email,c.representative_first_name,c.representative_last_name,station(c)].some(v=>String(v||'').toLowerCase().includes(q))
  }),[codes,status,repFilter,query])

  function toggle(id:string){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
  function selectFiltered(){setSelected(filtered.map(c=>c.id))}
  function clearSelection(){setSelected([])}

  async function assignSelection(){
    if(!repId||!selected.length)return
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/sponsor/kawmed/assign',{representative_id:repId,code_ids:selected,group_label:groupLabel})
      if(!j?.ok)throw new Error(j?.error||'No pudimos asignar.')
      setMessage(j.data?.assigned+' estaciones asignadas al visitador.')
      setSelected([]);await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos asignar.')}finally{setBusy(false)}
  }

  async function assignQuantity(){
    if(!repId||!batchId||quantity<1)return
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/sponsor/kawmed/assign',{representative_id:repId,batch_id:batchId,quantity,group_label:groupLabel})
      if(!j?.ok)throw new Error(j?.error||'No pudimos asignar.')
      setMessage(j.data?.assigned+' estaciones del lote asignadas al visitador.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos asignar.')}finally{setBusy(false)}
  }

  async function createRep(){
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/sponsor/kawmed/representatives',newRep)
      if(!j?.ok)throw new Error(j?.error||'No pudimos registrar el visitador.')
      setNewRep({employee_code:'',first_name:'',last_name:'',whatsapp:'',email:'',zone:'',territory:''})
      setMessage('Visitador registrado.');await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos registrar.')}finally{setBusy(false)}
  }

  function downloadTemplate(){
    const ws=XLSX.utils.json_to_sheet([{Codigo:'V001',Nombre:'Carlos',Apellido:'Perez',WhatsApp:'8095551234',Correo:'carlos@empresa.com',Zona:'Distrito Nacional',Territorio:'Centro'}])
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Visitadores');XLSX.writeFile(wb,'plantilla-visitadores-kawmed.xlsx')
  }

  async function readExcel(file:File){
    try{
      const buffer=await file.arrayBuffer(),wb=XLSX.read(buffer,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]]
      const raw:any[]=XLSX.utils.sheet_to_json(ws,{defval:''})
      const rows=raw.slice(0,1000).map(row=>({
        employee_code:row.Codigo||row.codigo||row.employee_code||'',
        first_name:row.Nombre||row.nombre||row.first_name||'',
        last_name:row.Apellido||row.apellido||row.last_name||'',
        whatsapp:row.WhatsApp||row.whatsapp||row.Telefono||row.telefono||'',
        email:row.Correo||row.correo||row.Email||row.email||'',
        zone:row.Zona||row.zona||'',
        territory:row.Territorio||row.territorio||'',
      })).filter(r=>String(r.first_name).trim()&&String(r.whatsapp).trim())
      setImportRows(rows);setMessage(rows.length+' colaboradores listos para importar.');setError('')
    }catch{setError('No pudimos leer el archivo Excel. Usa la plantilla KawMed.')}
  }

  async function importExcel(){
    if(!importRows.length)return
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/sponsor/kawmed/representatives/import',{rows:importRows})
      if(!j?.ok)throw new Error(j?.error||'No pudimos importar.')
      setMessage((j.data?.accepted||0)+' visitadores importados/actualizados.')
      setImportRows([]);await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos importar.')}finally{setBusy(false)}
  }

  async function toggleRep(rep:Rep){
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPatch('/sponsor/kawmed/representatives/'+encodeURIComponent(rep.id),{active:rep.active===0})
      if(!j?.ok)throw new Error(j?.error||'No pudimos actualizar.')
      setMessage('Visitador actualizado.');await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos actualizar.')}finally{setBusy(false)}
  }

  if(loading)return <main className="min-h-screen bg-slate-50"/>
  if(!data)return <main className="min-h-screen bg-slate-50 p-6 font-['Inter']"><div className="mx-auto max-w-xl rounded-3xl bg-white p-6"><h1 className="text-2xl font-black">KawMed no disponible</h1><p className="mt-2 text-sm text-slate-500">{error||'Esta cuenta no tiene un programa KawMed patrocinado.'}</p></div></main>

  return <main className="min-h-screen bg-slate-50 px-4 py-6 font-['Inter'] text-slate-950"><div className="mx-auto max-w-[1280px] space-y-5">
    <header className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-700">KAWMED · PANEL MASTER</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">{data.sponsor.name}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Administra exclusivamente la experiencia médica patrocinada: Agenda, centros, horarios, seguros y excepciones, visitadores y trazabilidad.</p>{sponsorAccounts.length>1&&<label className="mt-3 block max-w-sm text-[11px] font-black uppercase tracking-[.08em] text-slate-500">Cuenta patrocinada<select value={currentSponsorId} onChange={e=>void changeSponsorAccount(e.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold normal-case tracking-normal text-slate-900">{sponsorAccounts.map(account=><option key={account.sponsor_id} value={account.sponsor_id}>{account.name}{Number(account.has_kawmed)===1?' · KawMed':''}</option>)}</select></label>}</div><div className="flex flex-wrap gap-2">{firstMedicalProfile&&<button onClick={()=>window.open((window.location.hostname.includes('preview')?'https://preview.intaprd.com':'https://intaprd.com')+'/m/'+encodeURIComponent(String(firstMedicalProfile.medical_slug||'')),'_blank','noopener,noreferrer')} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Ver perfil médico</button>}{hasNormalMaster&&<button onClick={()=>window.location.assign('/admin/sponsor')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black">Patrocinio general</button>}</div></div></header>

    {message&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
    {error&&<div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Estaciones',stats.total],['Activadas',stats.active],['Pendientes',stats.pending],['Asignadas',stats.assigned]].map(([l,v])=><div className={card} key={String(l)}><p className="text-xs font-black uppercase tracking-[.07em] text-slate-400">{l}</p><p className="mt-2 text-3xl font-black">{v}</p></div>)}</section>
    <section className={card}><p className="text-[11px] font-black uppercase tracking-[.14em] text-cyan-700">Experiencia médica patrocinada</p><h2 className="mt-2 text-xl font-black">La misma estructura que recibe cada médico</h2><p className="mt-2 text-sm leading-6 text-slate-500">El Master KawMed no crea un perfil comercial de ejemplo. Los perfiles de este programa usan la experiencia KawMed: identidad profesional, Agenda, centros de atención, horarios y seguros con sus excepciones. El cintillo, vademécum y visitador permanecen dentro del entorno privado del médico.</p><div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">{['Agenda','Centros','Horarios','Seguros / excepciones'].map(item=><div key={item} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 px-3 py-3 text-center text-xs font-black text-cyan-800">{item}</div>)}</div></section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className={card}><h2 className="text-xl font-black">Visitadores</h2><p className="mt-1 text-sm text-slate-500">Registra manualmente o importa tus colaboradores desde Excel.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className={label}>Código interno<input className={input} value={newRep.employee_code} onChange={e=>setNewRep({...newRep,employee_code:e.target.value})}/></label><label className={label}>Nombre<input className={input} value={newRep.first_name} onChange={e=>setNewRep({...newRep,first_name:e.target.value})}/></label><label className={label}>Apellido<input className={input} value={newRep.last_name} onChange={e=>setNewRep({...newRep,last_name:e.target.value})}/></label><label className={label}>WhatsApp<input className={input} value={newRep.whatsapp} onChange={e=>setNewRep({...newRep,whatsapp:e.target.value})}/></label><label className={label}>Correo<input className={input} value={newRep.email} onChange={e=>setNewRep({...newRep,email:e.target.value})}/></label><label className={label}>Zona<input className={input} value={newRep.zone} onChange={e=>setNewRep({...newRep,zone:e.target.value})}/></label><label className={label}>Territorio<input className={input} value={newRep.territory} onChange={e=>setNewRep({...newRep,territory:e.target.value})}/></label></div><button onClick={()=>void createRep()} disabled={busy||!newRep.first_name||!newRep.whatsapp} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Registrar visitador</button>
      <div className="mt-5 border-t border-slate-100 pt-5"><div className="flex flex-wrap gap-2"><button onClick={downloadTemplate} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black">Descargar plantilla Excel</button><label className="cursor-pointer rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-black text-cyan-800">Importar Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];e.currentTarget.value='';if(f)void readExcel(f)}}/></label>{importRows.length>0&&<button onClick={()=>void importExcel()} disabled={busy} className="rounded-xl bg-cyan-700 px-4 py-3 text-xs font-black text-white">Confirmar {importRows.length} colaboradores</button>}</div></div></div>

      <div className={card}><h2 className="text-xl font-black">Asignar por lote / cantidad</h2><p className="mt-1 text-sm text-slate-500">Selecciona el visitador, el lote y la cantidad de estaciones. El sistema toma las estaciones en orden numérico.</p><div className="mt-4 grid gap-3"><label className={label}>Visitador<select className={input} value={repId} onChange={e=>setRepId(e.target.value)}><option value="">Seleccionar</option>{reps.filter(r=>r.active!==0).map(r=><option key={r.id} value={r.id}>{repName(r)}{r.zone?' · '+r.zone:''}</option>)}</select></label><label className={label}>Lote<select className={input} value={batchId} onChange={e=>setBatchId(e.target.value)}><option value="">Seleccionar</option>{batches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.program_name||''}</option>)}</select></label><label className={label}>Cantidad de médicos / estaciones<input type="number" min={1} max={500} className={input} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(500,Number(e.target.value)||1)))}/></label><label className={label}>Nombre del sublote / grupo · opcional<input className={input} value={groupLabel} onChange={e=>setGroupLabel(e.target.value)} placeholder="Ej. Zona Norte · Ruta A"/></label></div><button onClick={()=>void assignQuantity()} disabled={busy||!repId||!batchId||quantity<1} className="mt-4 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Asignar próximas {quantity} estaciones</button></div>
    </section>

    <section className={card}><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Colaboradores registrados</h2><p className="mt-1 text-sm text-slate-500">{reps.length} visitadores disponibles en la plataforma.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reps.map(r=><article key={r.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{repName(r)}</p><p className="mt-1 text-xs text-slate-500">{r.employee_code||'Sin código'} · {r.zone||'Sin zona'}</p></div><button disabled={busy} onClick={()=>void toggleRep(r)} className={'rounded-full px-2 py-1 text-[11px] font-black '+(r.active!==0?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>{r.active!==0?'Activo':'Inactivo'}</button></div><p className="mt-3 text-sm font-semibold">{r.whatsapp}</p><p className="mt-1 break-all text-xs text-slate-500">{r.email||'—'}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="rounded-xl bg-slate-50 p-2"><strong>{r.codes_total||0}</strong> asignados</span><span className="rounded-xl bg-slate-50 p-2"><strong>{r.doctors_active||0}</strong> activados</span></div></article>)}</div></section>

    <section className={card}><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-black">Estaciones, códigos y médicos</h2><p className="mt-1 max-w-3xl text-sm text-slate-500">Selecciona estaciones individuales para formar un sublote y asignarlas a un visitador. En las activadas puedes consultar médico, especialidad y contacto profesional.</p></div><div className="grid gap-2 sm:grid-cols-3"><input className={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar estación, médico, código…"/><select className={input} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="available">Pendientes</option><option value="claimed">Activados</option><option value="inactive">Inactivos</option></select><select className={input} value={repFilter} onChange={e=>setRepFilter(e.target.value)}><option value="all">Todos los visitadores</option><option value="unassigned">Sin asignar</option>{reps.map(r=><option key={r.id} value={r.id}>{repName(r)}</option>)}</select></div></div>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50 p-3"><button onClick={selectFiltered} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">Seleccionar visibles</button><button onClick={clearSelection} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">Limpiar</button><span className="px-2 text-xs font-bold text-slate-500">{selected.length} seleccionadas</span><select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold" value={repId} onChange={e=>setRepId(e.target.value)}><option value="">Asignar a…</option>{reps.filter(r=>r.active!==0).map(r=><option key={r.id} value={r.id}>{repName(r)}</option>)}</select><input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold" value={groupLabel} onChange={e=>setGroupLabel(e.target.value)} placeholder="Sublote / grupo"/><button onClick={()=>void assignSelection()} disabled={busy||!repId||!selected.length} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Asignar visitador</button></div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[1450px] text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="p-3">Sel.</th><th className="p-3">Estación</th><th className="p-3">Código</th><th className="p-3">Estado</th><th className="p-3">Lote</th><th className="p-3">Visitador / sublote</th><th className="p-3">Médico</th><th className="p-3">Especialidad</th><th className="p-3">Teléfono</th><th className="p-3">Correo</th><th className="p-3">Activado</th></tr></thead><tbody>{filtered.map(c=><tr key={c.id} className="border-t border-slate-100 align-top"><td className="p-3"><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggle(c.id)}/></td><td className="p-3 text-lg font-black">{station(c)}</td><td className="p-3 font-mono font-black">{c.code}</td><td className="p-3">{c.status==='claimed'?'Activado':c.status==='inactive'?'Inactivo':'Pendiente'}</td><td className="p-3">{c.batch_name||'—'}</td><td className="p-3"><div className="font-bold">{[c.representative_first_name,c.representative_last_name].filter(Boolean).join(' ')||'Sin asignar'}</div><div className="mt-1 text-slate-400">{[c.assignment_group,c.representative_zone].filter(Boolean).join(' · ')||''}</div></td><td className="p-3">{c.medical_name?<><div className="font-bold">{[c.professional_prefix,c.medical_name].filter(Boolean).join(' ')}</div>{c.medical_slug&&<div className="mt-1 text-slate-400">/m/{c.medical_slug}</div>}</>:'—'}</td><td className="p-3">{c.medical_specialty||'—'}</td><td className="p-3">{c.medical_phone||'—'}</td><td className="max-w-[220px] break-all p-3">{c.medical_email||'—'}</td><td className="p-3">{c.claimed_at?new Date(c.claimed_at).toLocaleDateString():'—'}</td></tr>)}{!filtered.length&&<tr><td colSpan={11} className="p-8 text-center text-slate-400">No hay estaciones que coincidan.</td></tr>}</tbody></table></div>
    </section>
  </div></main>
}
