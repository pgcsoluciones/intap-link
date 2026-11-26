import { useEffect, useState } from 'react'
import { apiGet, apiPut } from '../../../lib/api'
import { FiStar } from 'react-icons/fi'
import { KawvoActionContent } from './KawvoAdminIcon'
import GoogleReviewLinkEditor, {type GoogleSearchCapability} from './GoogleReviewLinkEditor'

type Settings={googleSearch?:GoogleSearchCapability;enabled:boolean;googleReviewUrl:string;published:boolean;publicUrl:string;stats:{days:number;views:number;qr:number;clicks:number;clickRate:number|null}}
/** Reusable UI; endpoint and identity are supplied by an authorized product adapter. */
export default function ReviewsTenantPanel({profileId,endpoint='/me/profile/reviews',showAccessStatus=false,homeShortcut=false}:{profileId:string;endpoint?:string;showAccessStatus?:boolean;homeShortcut?:boolean}){
  const path=endpoint+'/'+encodeURIComponent(profileId)
  const [data,setData]=useState<Settings|null>(null)
  const [days,setDays]=useState(30)
  const [enabled,setEnabled]=useState(false)
  const [url,setUrl]=useState('')
  // null = manual; empty = search with no verified selection.
  const [searchDraft,setSearchDraft]=useState<string|null>(null)
  const [message,setMessage]=useState('')
  const [loadError,setLoadError]=useState(false)
  const [unavailable,setUnavailable]=useState(false)
  const [busy,setBusy]=useState(false)
  const [expanded,setExpanded]=useState(!homeShortcut)
  useEffect(()=>{
    let live=true
    setData(null);setSearchDraft(null);setMessage('');setLoadError(false);setUnavailable(false)
    apiGet(path+'?days='+days).then(r=>{
      if(!live)return
      if(!r?.ok){if(r?.error==='Reseñas no disponible temporalmente.')setLoadError(true);else setUnavailable(true);return}
      setData(r.data);setEnabled(r.data.enabled);setUrl(r.data.googleReviewUrl)
    }).catch(()=>{if(live)setLoadError(true)})
    return()=>{live=false}
  },[path,days])
  if(loadError)return <p role="status" className="text-sm text-slate-600">Reseñas no está disponible temporalmente.</p>
  if(!data)return showAccessStatus?<p role="status" className="rounded-xl border bg-white p-4 text-sm text-slate-600">{unavailable?'Reseñas no está disponible para esta cuenta.':'Cargando configuración de reseñas…'}</p>:null
  if(homeShortcut&&!expanded)return <button type="button" onClick={()=>setExpanded(true)} className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800"><KawvoActionContent name="reviews" title="Reseñas" detail="Google, QR y estadísticas"/></button>
  const shareUrl=data.publicUrl+'?share=reviews#resenas'
  const qrUrl=data.publicUrl+'?src=reviews-qr#resenas'
  const canShare=data.enabled&&data.published&&Boolean(data.googleReviewUrl)
  const effectiveUrl=searchDraft===null?url:searchDraft
  const canSave=searchDraft===null||Boolean(searchDraft)
  const save=async()=>{
    if(!canSave||busy)return
    setBusy(true);setMessage('')
    try{
      const r=await apiPut(path,{enabled,googleReviewUrl:effectiveUrl.trim()})
      if(!r?.ok){setMessage(r?.error||'No se pudo guardar.');return}
      const next=await apiGet(path+'?days='+days)
      if(!next?.ok){setMessage('Guardado; vuelve a abrir el módulo para comprobarlo.');return}
      setData(next.data);setEnabled(next.data.enabled);setUrl(next.data.googleReviewUrl);setSearchDraft(null);setMessage('Configuración guardada.')
    }catch{setMessage('No pudimos comprobar el guardado.')}finally{setBusy(false)}
  }
  const download=async()=>{
    try{
      const QRCode=await import('qrcode')
      const png=await QRCode.toDataURL(qrUrl,{width:1400,margin:3,errorCorrectionLevel:'H',color:{dark:'#111111',light:'#FFFFFF'}})
      const a=document.createElement('a');a.href=png;a.download='kawvo-resenas.png';a.click()
    }catch{setMessage('No pudimos generar el QR.')}
  }
  const copy=async()=>{
    try{await navigator.clipboard.writeText(shareUrl);setMessage('Enlace copiado.')}catch{setMessage('No pudimos copiar. Selecciona el enlace.')}
  }
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
    {homeShortcut&&<button type="button" onClick={()=>setExpanded(false)} className="mb-3 min-h-11 text-sm font-bold text-cyan-800">Volver a Inicio</button>}
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-cyan-800"><FiStar className="h-5 w-5" aria-hidden="true"/></span><div className="min-w-0"><h2 className="text-base font-bold">Reseñas</h2><p className="text-xs text-slate-600">Invita a tus clientes a opinar en Google.</p></div></div>
    <div className="mt-4"><GoogleReviewLinkEditor key={path+'|'+data.googleReviewUrl} path={path} value={url} onChange={setUrl} searchDraft={searchDraft} onSearchDraftChange={setSearchDraft} capability={data.googleSearch} disabled={busy}/></div>
    <form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();void save()}}>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} disabled={busy}/> Mostrar sección de reseñas</label>
      {!canSave&&<p role="status" className="text-sm text-slate-600">Selecciona un establecimiento real para guardar o vuelve al modo manual. Tu enlace guardado no se ha modificado.</p>}
      <button disabled={busy||!canSave} className="min-h-11 w-full rounded-xl bg-slate-900 px-3 font-bold text-white disabled:opacity-50">{busy?'Guardando…':'Guardar'}</button>
    </form>
    {canShare&&<div className="mt-4 space-y-2"><label className="block text-sm">Enlace de reseñas<input readOnly value={shareUrl} className="mt-1 w-full min-w-0 rounded-xl border p-3 text-sm"/></label><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><button type="button" className="min-h-11 rounded-xl border p-2 text-sm font-bold" onClick={()=>void copy()}>Copiar</button><a href={'https://wa.me/?text='+encodeURIComponent('Tu opinión es de suma importancia para nosotros.\n'+shareUrl)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border p-2 text-sm font-bold">Compartir</a><button type="button" className="min-h-11 rounded-xl border p-2 text-sm font-bold" onClick={()=>void download()}>Descargar QR</button></div></div>}
    {!data.published&&<p className="mt-3 text-xs text-slate-600">El enlace y QR estarán disponibles al publicar tu presentación.</p>}
    {message&&<p role="status" className="mt-3 break-words text-sm text-slate-700">{message}</p>}
    <div className="mt-5 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Estadísticas de reseñas</h3><label className="text-sm">Período <select value={days} disabled={busy||enabled!==data.enabled||effectiveUrl!==data.googleReviewUrl||searchDraft!==null} onChange={e=>setDays(Number(e.target.value))} className="min-h-11 rounded-lg border p-2"><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label></div>
      <div className="mt-3 grid grid-cols-2 gap-2">{[['Visitas',data.stats.views],['Accesos atribuidos al QR',data.stats.qr],['Clics en Google',data.stats.clicks],['Tasa de clics',data.stats.clickRate===null?'—':data.stats.clickRate+'%']].map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">{label}</p><strong className="text-xl">{value}</strong></div>)}</div>
      <p className="mt-2 text-xs text-slate-500">Los clics no acreditan reseñas publicadas. El origen QR se atribuye al enlace marcado.</p>
    </div>
  </section>
}
