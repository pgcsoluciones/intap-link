import { useEffect, useMemo, useState } from 'react'

type Props = {
  address: string
  mapUrl: string
  onChange: (values: { address: string; map_url: string }) => void
}

function mapsSearchUrl(query: string) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query)
}
function mapsEmbedUrl(query: string) {
  return 'https://www.google.com/maps?q=' + encodeURIComponent(query) + '&output=embed'
}

/** Location selection follows the existing FreeLocation Google Maps search and confirmation flow,
 * but delegates persistence to the medical center editor instead of writing /me/contact. */
export default function MedicalCenterLocationPicker({address,mapUrl,onChange}:Props){
  const [query,setQuery]=useState(address)
  const [preview,setPreview]=useState(mapUrl?'':address)
  const [error,setError]=useState('')
  const [locating,setLocating]=useState(false)
  useEffect(()=>{setQuery(address);if(!mapUrl)setPreview(address)},[address,mapUrl])
  const embed=useMemo(()=>preview?mapsEmbedUrl(preview):'',[preview])
  function search(){
    if(!query.trim()){setError('Escribe el centro o una dirección para buscar.');return}
    setPreview(query.trim());setError('')
  }
  function confirm(){
    if(!preview)return
    onChange({address:query.trim()||address,map_url:mapsSearchUrl(preview)})
    setError('')
  }
  function currentLocation(){
    if(!navigator.geolocation){setError('Este dispositivo no permite localizarte.');return}
    setLocating(true);setError('')
    navigator.geolocation.getCurrentPosition(({coords})=>{
      const p=coords.latitude.toFixed(6)+','+coords.longitude.toFixed(6)
      setPreview(p);setQuery(current=>current||'Ubicación actual')
      setLocating(false)
    },()=>{setError('No se pudo acceder a tu ubicación. Puedes buscarla por nombre o dirección.');setLocating(false)},{enableHighAccuracy:true,timeout:10000,maximumAge:30000})
  }
  return <div className="rounded-2xl border border-slate-200 bg-white p-3">
    <p className="text-xs font-bold text-slate-700">Ubicación del centro · Google Maps</p>
    <input value={query} onChange={e=>{setQuery(e.target.value);setError('')}} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" placeholder="Busca por nombre o dirección"/>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={search} className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-900">Buscar ubicación</button>
      <button type="button" onClick={currentLocation} disabled={locating} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">{locating?'Buscando…':'Usar ubicación actual'}</button>
    </div>
    {embed&&<div className="mt-3 space-y-2"><iframe title="Vista previa de la ubicación del centro" src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full rounded-xl border border-slate-200"/><a href={mapsSearchUrl(preview)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-cyan-800 underline">Abrir en Maps</a><p className="text-xs text-slate-500">Verifica que el punto es correcto antes de confirmarlo.</p><button type="button" onClick={confirm} className="block w-full rounded-xl bg-cyan-700 px-3 py-3 text-xs font-black text-white">Confirmar ubicación</button></div>}
    {mapUrl&&<p className="mt-2 text-xs font-semibold text-emerald-700">✓ Ubicación seleccionada. Guarda el centro para conservarla.</p>}
    {error&&<p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
  </div>
}
