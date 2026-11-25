import {useEffect,useRef,useState} from 'react'
import {apiPost} from '../../../lib/api'
import {buildGoogleReviewUrl,normalizeGoogleReviewUrl,validGooglePlaceId,COUNTRY_CODES,countryName} from '../../../../../shared/google-review-link'

export type GoogleSearchCapability={available:boolean;embedKey?:string;businessName?:string;address?:string}
type Props={path:string;value:string;onChange:(value:string)=>void;searchDraft:string|null;onSearchDraftChange:(value:string|null)=>void;capability?:GoogleSearchCapability;disabled:boolean}
const inputClass='mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 p-3 text-sm'
const secondary='min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50'
const countries=COUNTRY_CODES.map(code=>({code,name:countryName(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,'es'))

function embedUrl(placeId:string,key:string){
 const u=new URL('https://www.google.com/maps/embed/v1/place')
 u.searchParams.set('key',key);u.searchParams.set('q','place_id:'+placeId);u.searchParams.set('language','es')
 return u.href
}
function mapsUrl(placeId:string,query:string){
 const u=new URL('https://www.google.com/maps/search/')
 u.searchParams.set('api','1');u.searchParams.set('query',query);u.searchParams.set('query_place_id',placeId)
 return u.href
}

/** App only. No searches until explicit submission; no Google calls from public profiles. */
export default function GoogleReviewLinkEditor({path,value,onChange,searchDraft,onSearchDraftChange,capability,disabled}:Props){
 const available=capability?.available===true&&Boolean(capability.embedKey)
 const mode=searchDraft===null?'manual':'search'
 const [billingBlocked,setBillingBlocked]=useState(false)
 const [simulation,setSimulation]=useState(false)
 const [simulated,setSimulated]=useState<{name:string;location:string;selected:boolean}|null>(null)
 const simulationAllowed=import.meta.env.MODE==='preview'&&window.location.hostname==='app.preview.intaprd.com'
 const [businessName,setBusinessName]=useState(capability?.businessName||'')
 const [city,setCity]=useState('')
 const [address,setAddress]=useState(capability?.address||'')
 const [countryCode,setCountryCode]=useState('DO')
 const [busy,setBusy]=useState(false)
 const [results,setResults]=useState<string[]|null>(null)
 const [index,setIndex]=useState(0)
 const [selected,setSelected]=useState('')
 const [message,setMessage]=useState('')
 const [resultQuery,setResultQuery]=useState('')
 const generation=useRef(0)
 const inFlight=useRef(false)
 useEffect(()=>()=>{generation.current++},[])
 useEffect(()=>{if(!available){generation.current++;onSearchDraftChange(null);setResults(null);setSelected('');setMessage('');setBusy(false);inFlight.current=false;setBillingBlocked(false);setSimulation(false);setSimulated(null)}},[available,onSearchDraftChange])
 const chooseMode=(next:'manual'|'search')=>{
  if(disabled||busy)return
  if(next===mode)return
  onSearchDraftChange(next==='manual'?null:'');setMessage('');setSelected('');setResults(null);setBillingBlocked(false);setSimulation(false);setSimulated(null);setIndex(0)
 }
 const resetSelection=()=>{onSearchDraftChange('');setSelected('');setResults(null);setSimulated(null);setMessage('');setIndex(0)}
 const search=async()=>{
  if(!available||disabled||inFlight.current||!businessName.trim()||!city.trim())return
  resetSelection()
  if(simulation&&simulationAllowed&&billingBlocked){
   setSimulated({name:businessName.trim()+' — ejemplo ficticio',location:[address.trim(),city.trim(),countryName(countryCode)||countryCode].filter(Boolean).join(', '),selected:false});return
  }
  setBillingBlocked(false)
  inFlight.current=true
  const token=++generation.current
  setBusy(true)
  const query=businessName.trim()+', '+city.trim()+', '+(countryName(countryCode)||countryCode)
  try{
   const r=await apiPost(path+'/google-search',{businessName:businessName.trim(),city:city.trim(),address:address.trim(),countryCode,language:'es'})
   if(token!==generation.current)return
   if(r?.ok!==true||!Array.isArray(r.results)){setBillingBlocked(r?.code==='GOOGLE_SEARCH_BILLING');setMessage(typeof r?.error==='string'?r.error:'No pudimos buscar. Introduce el enlace manualmente.');return}
   const ids=r.results.map((p:unknown)=>p&&typeof p==='object'&&'placeId' in p?p.placeId:null)
   if(ids.length>5||!ids.every(validGooglePlaceId)){setMessage('No pudimos comprobar los resultados. Introduce el enlace manualmente.');return}
   setResultQuery(query);setResults([...new Set(ids as string[])])
  }catch{if(token===generation.current)setMessage('No pudimos buscar tu negocio. Intenta nuevamente o introduce el enlace manualmente.')}
  finally{if(token===generation.current){inFlight.current=false;setBusy(false)}}
 }
 const select=(id:string)=>{
  if(disabled||busy||!results?.includes(id))return
  const url=buildGoogleReviewUrl(id)
  if(!url)return
  setSelected(id);onSearchDraftChange(url);setMessage('Enlace generado. Pruébalo y guarda la configuración.')
 }
 const displayedUrl=mode==='manual'?value:(searchDraft||'')
 const safe=normalizeGoogleReviewUrl(displayedUrl.trim())
 const current=results?.[index]
 const chosen=selected&&buildGoogleReviewUrl(selected)===searchDraft?selected:''
 return <div className="min-w-0 space-y-3">
  {available?<fieldset className="min-w-0 space-y-2">
   <legend className="mb-2 text-sm font-bold">¿Cómo deseas configurar tu enlace?</legend>
   <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <button type="button" aria-pressed={mode==='search'} className={secondary+(mode==='search'?' border-cyan-700 bg-cyan-50':'')} onClick={()=>chooseMode('search')} disabled={disabled||busy}>Buscar mi negocio</button>
    <button type="button" aria-pressed={mode==='manual'} className={secondary+(mode==='manual'?' border-cyan-700 bg-cyan-50':'')} onClick={()=>chooseMode('manual')} disabled={disabled||busy}>Introducir enlace manualmente</button>
   </div>
  </fieldset>:<p className="text-sm text-slate-600">Puedes configurar tu enlace manualmente. El buscador no está disponible por ahora.</p>}
  {available&&mode==='search'&&<div className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3">
   <p className="text-xs leading-5 text-slate-600">La consulta se envía a Google Maps para localizar establecimientos. <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacidad de Google</a> · <a className="underline" href="https://www.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Términos de Maps</a>.</p>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();void search()}}>
    <label className="block text-sm font-semibold">Nombre del negocio<input required maxLength={120} className={inputClass} value={businessName} onChange={e=>{setBusinessName(e.target.value);resetSelection()}} disabled={disabled||busy}/></label>
    <label className="block text-sm font-semibold">País<select className={inputClass} value={countryCode} onChange={e=>{setCountryCode(e.target.value);resetSelection()}} disabled={disabled||busy}>{countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
    <label className="block text-sm font-semibold">Ciudad o localidad<input required maxLength={100} className={inputClass} value={city} onChange={e=>{setCity(e.target.value);resetSelection()}} disabled={disabled||busy}/></label>
    <label className="block text-sm font-semibold">Dirección o referencia (opcional)<input maxLength={180} className={inputClass} value={address} onChange={e=>{setAddress(e.target.value);resetSelection()}} disabled={disabled||busy}/></label>
    <button type="submit" className="min-h-11 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={disabled||busy||!businessName.trim()||!city.trim()}>{busy?'Buscando establecimientos…':simulation?'Simular búsqueda':'Buscar establecimiento'}</button>
   </form>
   {message&&<p role="status" className="rounded-xl bg-slate-50 p-3 break-words text-sm text-slate-700">{message}</p>}
   {billingBlocked&&simulationAllowed&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm space-y-2"><strong className="block">Google requiere facturación habilitada.</strong><button type="button" className={secondary+' w-full'} disabled={disabled||busy} onClick={()=>{resetSelection();setSimulation(v=>!v)}}>{simulation?'Salir de la simulación':'Probar modo simulado'}</button>{simulation&&<p>Modo demostración: no consulta Google ni permite guardar enlaces ficticios.</p>}</div>}
   {simulation&&simulated&&<div className="rounded-xl border border-amber-300 p-3 space-y-2" aria-label="Resultado simulado"><strong className="block">Resultado de demostración</strong><p className="font-bold break-words">{simulated.name}</p><p className="text-sm break-words">{simulated.location}</p><button type="button" disabled={disabled} className={secondary+' w-full'} onClick={()=>setSimulated(s=>s?{...s,selected:true}:s)}>Seleccionar ejemplo ficticio</button>{simulated.selected&&<p role="status" className="text-sm">Ejemplo seleccionado. En el modo real se generaría aquí el enlace oficial. No se crea un ID ni una URL de Google ficticios.</p>}</div>}
   {results?.length===0&&<p role="status" className="text-sm text-slate-600">No encontramos establecimientos. Añade una dirección o sector, o utiliza el enlace manual.</p>}
   {current&&!chosen&&<div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Resultado {index+1} de {results?.length}</strong><div className="flex gap-2"><button type="button" className={secondary} disabled={index===0||disabled} onClick={()=>setIndex(i=>i-1)}>Anterior</button><button type="button" className={secondary} disabled={index===(results?.length||0)-1||disabled} onClick={()=>setIndex(i=>i+1)}>Siguiente</button></div></div>
    <p className="text-sm text-slate-600">Confirma que el establecimiento y su sucursal sean los correctos.</p>
    <iframe key={current} title={'Google Maps, resultado '+(index+1)} src={embedUrl(current,capability!.embedKey!)} width="100%" height="260" style={{border:0,minHeight:200}} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
    <a className="block break-words text-sm font-semibold text-cyan-800 underline" href={mapsUrl(current,resultQuery)} target="_blank" rel="noopener noreferrer">Consultar este establecimiento en Google Maps</a>
    <button type="button" className={secondary+' w-full'} onClick={()=>select(current)} disabled={disabled}>Seleccionar este establecimiento</button>
    <p className="text-xs text-slate-600">Si el mapa no carga o no identifica bien la sucursal, abre Google Maps o refina la búsqueda.</p>
   </div>}
   {chosen&&<div className="space-y-2"><strong className="block text-sm">Establecimiento seleccionado</strong><iframe title="Mapa del establecimiento seleccionado" src={embedUrl(chosen,capability!.embedKey!)} width="100%" height="260" style={{border:0,minHeight:200}} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/><button type="button" className={secondary+' w-full'} disabled={disabled} onClick={resetSelection}>Cambiar establecimiento</button></div>}
  </div>}
  <label className="block text-sm font-semibold">{mode==='search'?'Enlace generado de Google':'Enlace oficial de Google'}<input value={displayedUrl} onChange={e=>{if(mode==='manual')onChange(e.target.value)}} type="url" maxLength={2048} placeholder={mode==='search'?'Se generará al seleccionar el establecimiento':'https://g.page/r/…/review'} className={inputClass} disabled={disabled||busy} readOnly={mode==='search'}/></label>
  {safe&&<div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><a className={secondary+' flex items-center justify-center'} href={safe} target="_blank" rel="noopener noreferrer">Probar enlace</a><button type="button" className={secondary} onClick={async()=>{try{await navigator.clipboard.writeText(safe);setMessage('Enlace de Google copiado.')}catch{setMessage('No pudimos copiar. Selecciona el enlace.')}}}>Copiar enlace de Google</button></div>}
  {mode==='manual'&&message&&<p role="status" className="break-words text-sm text-slate-700">{message}</p>}
 </div>
}
