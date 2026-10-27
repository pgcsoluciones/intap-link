import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { apiGet, apiPatch, apiPost } from '../../../lib/api'

type Seller={id:string;first_name:string;last_name:string;whatsapp:string;email?:string;zone?:string;territory?:string;active:number}
type Assignment={id:string;representative_id:string;public_code:string;group_label?:string;active:number}
const cols=['employee_code','first_name','last_name','whatsapp','email','zone','territory']
const input='rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm'
export default function SponsorCommercialSellers({codes}:{codes:string[]}){
 const[sellers,setSellers]=useState<Seller[]>([]),[assignments,setAssignments]=useState<Assignment[]>([])
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const[selectedSeller,setSelectedSeller]=useState(''),[selectedCodes,setSelectedCodes]=useState<string[]>([]),[group,setGroup]=useState('')
 const[search,setSearch]=useState('')
 async function load(){const r:any=await apiGet('/sponsor/commercial/sellers');if(!r?.ok)throw Error(r?.error||'No se pudieron cargar vendedores.');setSellers(r.data?.sellers||[]);setAssignments(r.data?.assignments||[])}
 useEffect(()=>{void load().catch(e=>setError(String(e.message||e)))},[])
 const filtered=useMemo(()=>codes.filter(x=>x.toLowerCase().includes(search.toLowerCase())),[codes,search])
 function template(){const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([cols,['V001','Ana','Pérez','8095550101','ana@empresa.com','Distrito Nacional','Zona norte']]);XLSX.utils.book_append_sheet(wb,ws,'Vendedores');XLSX.writeFile(wb,'plantilla_vendedores_kawvo.xlsx')}
 async function upload(file?:File){if(!file)return;setError('');setMessage('');setBusy(true);try{
  const book=XLSX.read(await file.arrayBuffer(),{type:'array'});const sheet=book.Sheets[book.SheetNames[0]];if(!sheet)throw Error('Archivo sin hoja de vendedores.')
  const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:''}).filter(r=>Object.values(r).some(v=>String(v).trim()))
  if(rows.length>250)throw Error('Máximo 250 vendedores por archivo.')
  const result:any=await apiPost('/sponsor/commercial/sellers/import',{rows})
  if(!result?.ok)throw Error(result?.error||'No se pudo importar.')
  setMessage(result.created+' vendedores agregados.');await load()
 }catch(e){setError(e instanceof Error?e.message:'Error de importación.')}finally{setBusy(false)}}
 async function saveAssignments(){setError('');setMessage('');setBusy(true);try{const r:any=await apiPost('/sponsor/commercial/assign',{representative_id:selectedSeller,codes:selectedCodes,group_label:group});if(!r?.ok)throw Error(r?.error||'No se pudo asignar.');setMessage(r.assigned+' códigos asignados correctamente.');setSelectedCodes([]);await load()}catch(e){setError(e instanceof Error?e.message:'Error de asignación.')}finally{setBusy(false)}}
 async function toggle(seller:Seller){setError('');setBusy(true);try{const r:any=await apiPatch('/sponsor/commercial/sellers/'+encodeURIComponent(seller.id),{active:Number(seller.active)!==1});if(!r?.ok)throw Error(r?.error||'No se pudo actualizar.');await load()}catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar.')}finally{setBusy(false)}}
 return <div className="space-y-4">
  <section className="rounded-3xl border border-slate-200 bg-white p-5">
   <h2 className="text-xl font-black">Vendedores</h2><p className="mt-1 text-sm text-slate-500">Importa vendedores desde la plantilla Excel; cada empresa administra exclusivamente los suyos.</p>
   <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={template} className="rounded-full border border-cyan-200 px-4 py-2 text-sm font-black text-cyan-800">Descargar plantilla Excel</button><label className="cursor-pointer rounded-full bg-cyan-700 px-4 py-2 text-sm font-black text-white">Importar Excel<input hidden type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label></div>
   <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="text-slate-500"><th className="p-2">Nombre</th><th className="p-2">WhatsApp</th><th className="p-2">Zona</th><th className="p-2">Estado</th></tr></thead><tbody>{sellers.map(s=><tr key={s.id} className="border-t"><td className="p-2 font-bold">{s.first_name} {s.last_name}</td><td className="p-2">{s.whatsapp}</td><td className="p-2">{s.zone||'—'}</td><td className="p-2"><button type="button" disabled={busy} onClick={()=>void toggle(s)} className="rounded-full border px-3 py-1 text-xs font-bold">{s.active?'Activo':'Inactivo'}</button></td></tr>)}</tbody></table></div>
  </section>
  <section className="rounded-3xl border border-slate-200 bg-white p-5">
   <h2 className="text-xl font-black">Asignación por lote</h2><p className="mt-1 text-sm text-slate-500">Selecciona un vendedor y los códigos NFC que recibirá. Reasignar conserva el historial anterior.</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={selectedSeller} onChange={e=>setSelectedSeller(e.target.value)} className={input}><option value="">Seleccionar vendedor</option>{sellers.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select><input className={input} placeholder="Lote o subgrupo" value={group} onChange={e=>setGroup(e.target.value)}/></div>
   <div className="mt-3 flex gap-2"><input className={input} placeholder="Buscar código" value={search} onChange={e=>setSearch(e.target.value)}/><button type="button" onClick={()=>setSelectedCodes([...new Set([...selectedCodes,...filtered])].slice(0,250))} className="rounded-xl border px-3 text-xs font-bold">Seleccionar visibles</button><button type="button" onClick={()=>setSelectedCodes([])} className="rounded-xl border px-3 text-xs font-bold">Limpiar</button></div>
   <div className="mt-3 max-h-52 overflow-auto rounded-xl border p-3">{filtered.map(code=><label key={code} className="flex items-center gap-3 border-b p-2 text-sm"><input type="checkbox" checked={selectedCodes.includes(code)} onChange={e=>setSelectedCodes(a=>e.target.checked?[...a,code].slice(0,250):a.filter(x=>x!==code))}/><span className="font-mono">{code}</span></label>)}</div>
   <button type="button" disabled={busy||!selectedSeller||!selectedCodes.length} onClick={()=>void saveAssignments()} className="mt-3 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Asignar {selectedCodes.length} códigos</button>
   <h3 className="mt-5 text-sm font-black">Asignaciones recientes</h3><div className="mt-2 max-h-44 overflow-auto text-xs">{assignments.slice(0,30).map(a=><div key={a.id} className="border-b p-2">{a.public_code} · {sellers.find(s=>s.id===a.representative_id)?.first_name||'Vendedor'} · {a.group_label||'Sin lote'} · {a.active?'Actual':'Anterior'}</div>)}</div>
  </section>
  {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}{error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
 </div>
}
