import { useEffect, useMemo, useState } from 'react'

/**
 * Reusable client-side navigation list for small, already-bounded sets only.
 * Large API-backed collections MUST paginate/filter on the server before rendering.
 */
export type KawvoListItem = { id:string; title:string; detail?:string; group?:string; keywords?:string; disabled?:boolean }
type Props = {
  items:KawvoListItem[]
  pageSize?:number
  onOpen:(id:string)=>void
  title?:string
}
export default function KawvoPagedList({items,pageSize=6,onOpen,title='Opciones disponibles'}:Props){
  const [query,setQuery]=useState('')
  const [group,setGroup]=useState('all')
  const [page,setPage]=useState(1)
  const groups=useMemo(()=>Array.from(new Set(items.map(item=>item.group||'General'))),[items])
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('es')
    return items.filter(item=>(group==='all'||(item.group||'General')===group)&&(!q||[item.title,item.detail,item.group,item.keywords].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(q)))
  },[items,query,group])
  const size=Math.max(1,Math.min(25,Math.floor(pageSize)||6))
  const pages=Math.max(1,Math.ceil(filtered.length/size))
  const safePage=Math.min(page,pages)
  const visible=filtered.slice((safePage-1)*size,safePage*size)
  useEffect(()=>{setPage(1)},[query,group])
  return <section aria-label={title} className="space-y-3">
    <label className="block text-sm font-semibold text-slate-700" htmlFor="kawvo-shell-search">Buscar una función</label>
    <input id="kawvo-shell-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ej.: contacto, portafolio, ubicación…" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-cyan-700"/>
    <div className="flex flex-wrap gap-2" aria-label="Filtrar módulos">
      <button type="button" aria-pressed={group==='all'} onClick={()=>setGroup('all')} className={'min-h-11 rounded-full border px-4 text-sm font-semibold '+(group==='all'?'border-cyan-700 bg-cyan-50 text-cyan-900':'border-slate-200 bg-white')}>Todos</button>
      {groups.map(g=><button type="button" key={g} aria-pressed={group===g} onClick={()=>setGroup(g)} className={'min-h-11 rounded-full border px-4 text-sm font-semibold '+(group===g?'border-cyan-700 bg-cyan-50 text-cyan-900':'border-slate-200 bg-white')}>{g}</button>)}
    </div>
    <p className="text-xs text-slate-500" role="status" aria-live="polite">{filtered.length} resultado{filtered.length===1?'':'s'} · página {safePage} de {pages}</p>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {visible.length?visible.map(item=><button type="button" key={item.id} disabled={item.disabled} onClick={()=>onOpen(item.id)} className="flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 disabled:opacity-50"><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{item.title}</strong>{item.detail&&<span className="mt-1 block text-xs text-slate-600">{item.detail}</span>}</span><span aria-hidden="true" className="text-slate-400">›</span></button>):<div className="p-5 text-sm text-slate-600">No encontramos resultados. Prueba otra búsqueda o selecciona «Todos».</div>}
    </div>
    {pages>1&&<nav aria-label="Paginación de funciones" className="flex items-center justify-between gap-3">
      <button type="button" disabled={safePage===1} onClick={()=>setPage(safePage-1)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-40">Anterior</button>
      <span className="text-xs text-slate-600">{safePage} / {pages}</span>
      <button type="button" disabled={safePage===pages} onClick={()=>setPage(safePage+1)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-40">Siguiente</button>
    </nav>}
  </section>
}
