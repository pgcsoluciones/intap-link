import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { apiGet, apiPatch, apiPost } from '../../../lib/api'

type Seller={id:string;first_name:string;last_name:string;whatsapp:string;email?:string;zone?:string;territory?:string;active:number}
type Assignment={id:string;representative_id:string;public_code:string;group_label?:string;active:number}
const cols=['employee_code','first_name','last_name','whatsapp','email','zone','territory']
const input='rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm'
type Artifact={public_code:string;batch_name:string}
export default function SponsorCommercialSellers({artifacts,role,onAssignmentsChanged}:{artifacts:Artifact[];role:'visitor'|'seller';onAssignmentsChanged:()=>Promise<void>}){
 const rolePlural=role==='visitor'?'visitadores':'vendedores'
 const roleSingular=role==='visitor'?'Visitador':'Vendedor'
 const[sellers,setSellers]=useState<Seller[]>([]),[assignments,setAssignments]=useState<Assignment[]>([])
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const[selectedSeller,setSelectedSeller]=useState(''),[selectedCodes,setSelectedCodes]=useState<string[]>([]),[group,setGroup]=useState('')
 const[manual,setManual]=useState({employee_code:'',first_name:'',last_name:'',whatsapp:'',email:'',zone:'',territory:''})
 const[search,setSearch]=useState('')
 const[batch,setBatch]=useState('all'),[quantity,setQuantity]=useState(5)
 async function load(){const r:any=await apiGet('/sponsor/commercial/sellers');if(!r?.ok)throw Error(r?.error||'No se pudieron cargar vendedores.');setSellers(r.data?.sellers||[]);setAssignments(r.data?.assignments||[])}
 useEffect(()=>{void load().catch(e=>setError(String(e.message||e)))},[])
 const batches=useMemo(()=>[...new Set(artifacts.map(a=>a.batch_name||'Sin lote'))].sort(),[artifacts])
 const batchCodes=useMemo(()=>artifacts.filter(a=>batch==='all'||(a.batch_name||'Sin lote')===batch).map(a=>a.public_code),[artifacts,batch])
 const filtered=useMemo(()=>batchCodes.filter(x=>x.toLowerCase().includes(search.toLowerCase())),[batchCodes,search])
 function selectNext(){const existing=new Set(assignments.filter(a=>Number(a.active)===1).map(a=>a.public_code));const next=batchCodes.filter(c=>!existing.has(c)&&!selectedCodes.includes(c)).slice(0,Math.max(1,Math.min(250,quantity)));setSelectedCodes(old=>[...old,...next].slice(0,250))}
 function template(){const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([cols,['V001','Ana','Pérez','8095550101','ana@empresa.com','Distrito Nacional','Zona norte']]);XLSX.utils.book_append_sheet(wb,ws,'Vendedores');XLSX.writeFile(wb,'plantilla_vendedores_kawvo.xlsx')}
 async function addManual(){setError('');setMessage('');setBusy(true);try{const result:any=await apiPost('/sponsor/commercial/sellers/import',{rows:[manual]});if(!result?.ok)throw Error(result?.error||'No se pudo registrar.');setManual({employee_code:'',first_name:'',last_name:'',whatsapp:'',email:'',zone:'',territory:''});setMessage(roleSingular+' registrado correctamente.');await load()}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar.')}finally{setBusy(false)}}
 async function upload(file?:File){if(!file)return;setError('');setMessage('');setBusy(true);try{
  const book=XLSX.read(await file.arrayBuffer(),{type:'array'});const sheet=book.Sheets[book.SheetNames[0]];if(!sheet)throw Error('Archivo sin hoja de vendedores.')
  const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:''}).filter(r=>Object.values(r).some(v=>String(v).trim()))
  if(rows.length>250)throw Error('Máximo 250 vendedores por archivo.')
  const result:any=await apiPost('/sponsor/commercial/sellers/import',{rows})
  if(!result?.ok)throw Error(result?.error||'No se pudo importar.')
  setMessage(result.created+' vendedores agregados.');await load()
 }catch(e){setError(e instanceof Error?e.message:'Error de importación.')}finally{setBusy(false)}}
 async function saveAssignments(){setError('');setMessage('');setBusy(true);try{const r:any=await apiPost('/sponsor/commercial/assign',{representative_id:selectedSeller,codes:selectedCodes,group_label:group});if(!r?.ok)throw Error(r?.error||'No se pudo asignar.');setMessage(r.assigned+' códigos asignados correctamente.');setSelectedCodes([]);await load();await onAssignmentsChanged()}catch(e){setError(e instanceof Error?e.message:'Error de asignación.')}finally{setBusy(false)}}
 async function toggle(seller:Seller){setError('');setBusy(true);try{const r:any=await apiPatch('/sponsor/commercial/sellers/'+encodeURIComponent(seller.id),{active:Number(seller.active)!==1});if(!r?.ok)throw Error(r?.error||'No se pudo actualizar.');await load()}catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar.')}finally{setBusy(false)}}
 return <div className="space-y-4">
  <section className="rounded-3xl border border-slate-200 bg-white p-5">
   <h2 className="text-xl font-black">{role==='visitor'?'Visitadores':'Vendedores'}</h2><p className="mt-1 text-sm text-slate-500">Registra {rolePlural} individualmente o importa lotes desde Excel. Cada empresa administra exclusivamente los suyos.</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">{([['employee_code','Código interno'],['first_name','Nombre'],['last_name','Apellido'],['whatsapp','WhatsApp'],['email','Correo'],['zone','Zona'],['territory','Territorio']] as const).map(([key,label])=><label key={key} className="text-xs font-bold text-slate-600">{label}<input className={input+' mt-1 w-full'} value={manual[key]} onChange={e=>setManual(old=>({...old,[key]:e.target.value}))} placeholder={label}/></label>)}</div><button type="button" onClick={()=>void addManual()} disabled={busy||!manual.first_name.trim()||!manual.whatsapp.trim()} className="mt-3 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Registrar {roleSingular.toLowerCase()}</button><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-sm font-bold">Registro por lote desde Excel</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={template} className="rounded-full border border-cyan-200 px-4 py-2 text-sm font-black text-cyan-800">Descargar plantilla Excel</button><label className="cursor-pointer rounded-full bg-cyan-700 px-4 py-2 text-sm font-black text-white">Importar Excel<input hidden type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label></div></div>
   <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="text-slate-500"><th className="p-2">Nombre</th><th className="p-2">WhatsApp</th><th className="p-2">Zona</th><th className="p-2">Estado</th></tr></thead><tbody>{sellers.map(s=><tr key={s.id} className="border-t"><td className="p-2 font-bold">{s.first_name} {s.last_name}</td><td className="p-2">{s.whatsapp}</td><td className="p-2">{s.zone||'—'}</td><td className="p-2"><button type="button" disabled={busy} onClick={()=>void toggle(s)} className="rounded-full border px-3 py-1 text-xs font-bold">{s.active?'Activo':'Inactivo'}</button></td></tr>)}</tbody></table></div>
  </section>
  <section className="rounded-3xl border border-slate-200 bg-white p-5">
   <h2 className="text-xl font-black">Asignar por lote / cantidad</h2><p className="mt-1 text-sm text-slate-500">Selecciona un {roleSingular.toLowerCase()}, el lote y la cantidad. También puedes elegir códigos concretos. Reasignar conserva el historial.</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={selectedSeller} onChange={e=>setSelectedSeller(e.target.value)} className={input}><option value="">Seleccionar {roleSingular.toLowerCase()}</option>{sellers.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select><input className={input} placeholder="Lote o subgrupo" value={group} onChange={e=>setGroup(e.target.value)}/></div>
   <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Lote<select className={input+" mt-1 w-full"} value={batch} onChange={e=>{setBatch(e.target.value);setSelectedCodes([])}}><option value="all">Todos los lotes</option>{batches.map(b=><option key={b} value={b}>{b}</option>)}</select></label><label className="text-xs font-bold">Cantidad de códigos<input type="number" min={1} max={250} className={input+" mt-1 w-full"} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(250,Number(e.target.value)||1)))}/></label></div><button type="button" onClick={selectNext} disabled={busy||!selectedSeller} className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-800 disabled:opacity-40">Seleccionar próximos {quantity} sin asignar</button><div className="mt-3 flex gap-2"><input className={input} placeholder="Buscar código" value={search} onChange={e=>setSearch(e.target.value)}/><button type="button" onClick={()=>setSelectedCodes([...new Set([...selectedCodes,...filtered])].slice(0,250))} className="rounded-xl border px-3 text-xs font-bold">Seleccionar visibles</button><button type="button" onClick={()=>setSelectedCodes([])} className="rounded-xl border px-3 text-xs font-bold">Limpiar</button></div>
   <div className="mt-3 max-h-52 overflow-auto rounded-xl border p-3">{filtered.map(code=><label key={code} className="flex items-center gap-3 border-b p-2 text-sm"><input type="checkbox" checked={selectedCodes.includes(code)} onChange={e=>setSelectedCodes(a=>e.target.checked?[...a,code].slice(0,250):a.filter(x=>x!==code))}/><span className="font-mono">{code}</span></label>)}</div>
   <button type="button" disabled={busy||!selectedSeller||!selectedCodes.length} onClick={()=>void saveAssignments()} className="mt-3 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Asignar {selectedCodes.length} códigos</button>
   <h3 className="mt-5 text-sm font-black">Asignaciones recientes</h3><div className="mt-2 max-h-44 overflow-auto text-xs">{assignments.slice(0,30).map(a=><div key={a.id} className="border-b p-2">{a.public_code} · {sellers.find(s=>s.id===a.representative_id)?.first_name||roleSingular} · {a.group_label||'Sin lote'} · {a.active?'Actual':'Anterior'}</div>)}</div>
  </section>
  {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}{error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
 </div>
}
