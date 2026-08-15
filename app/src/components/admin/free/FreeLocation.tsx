import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'
import { FreeBackButton, FreeUpgradeCard } from './FreePanelUi'

type LocationResult = {
  display_name?: string
  name?: string
  place_name?: string
  lat?: string | number
  lon?: string | number
  latitude?: string | number
  longitude?: string | number
}

type SelectedLocation = {
  placeName: string
  address: string
  latitude: number
  longitude: number
}

function readCoordinate(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function FreeLocation() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [selected, setSelected] = useState<SelectedLocation | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/me/contact').then((json: any) => {
      if (!json.ok || !json.data) return
      const lat = readCoordinate(json.data.latitude)
      const lon = readCoordinate(json.data.longitude)
      setQuery(json.data.place_name || json.data.address || '')
      if (lat !== null && lon !== null) {
        setSelected({
          placeName: json.data.place_name || json.data.address || 'Mi ubicación',
          address: json.data.address || json.data.place_name || '',
          latitude: lat,
          longitude: lon,
        })
      }
    })
  }, [])

  const mapEmbedUrl = useMemo(() => {
    if (!selected) return ''
    const q = encodeURIComponent(`${selected.latitude},${selected.longitude}`)
    return `https://maps.google.com/maps?q=${q}&z=17&output=embed`
  }, [selected])

  const search = async () => {
    const q = query.trim()
    setSaved(false)
    setError('')
    if (q.length < 3) {
      setError('Escribe al menos 3 caracteres: nombre del negocio, dirección, sector o ciudad.')
      return
    }
    setSearching(true)
    try {
      const json: any = await apiGet(`/me/location/search?q=${encodeURIComponent(q)}`)
      if (!json.ok) {
        setError(json.error || 'No pudimos buscar esa ubicación.')
        return
      }
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json.results) ? json.results : []
      setResults(list.slice(0, 5))
      if (list.length === 0) setError('No encontramos resultados. Prueba con el nombre del negocio + ciudad o una dirección más completa.')
    } catch {
      setError('No pudimos buscar esa ubicación.')
    } finally {
      setSearching(false)
    }
  }

  const selectResult = (result: LocationResult) => {
    const lat = readCoordinate(result.lat ?? result.latitude)
    const lon = readCoordinate(result.lon ?? result.longitude)
    if (lat === null || lon === null) return
    const address = String(result.display_name || result.place_name || result.name || query).trim()
    const placeName = String(result.name || result.place_name || address.split(',')[0] || query).trim()
    setSelected({ placeName, address, latitude: lat, longitude: lon })
    setQuery(placeName || address)
    setSaved(false)
    setError('')
  }

  const useCurrentLocation = () => {
    setSaved(false)
    setError('')
    if (!navigator.geolocation) {
      setError('Este navegador no permite obtener tu ubicación actual.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelected({
          placeName: query.trim() || 'Mi ubicación',
          address: query.trim() || 'Ubicación seleccionada desde el dispositivo',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => setError('No pudimos obtener tu ubicación. Revisa el permiso de ubicación del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const save = async () => {
    if (!selected) {
      setError('Busca y selecciona una ubicación antes de guardar.')
      return
    }
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const json: any = await apiPut('/me/contact', {
        address: selected.address,
        place_name: selected.placeName,
        latitude: selected.latitude,
        longitude: selected.longitude,
      })
      if (json.ok) setSaved(true)
      else setError(json.error || 'No se pudo guardar la ubicación.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[470px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Ubicación</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Busca por nombre de tu negocio o por dirección. Luego elige el resultado exacto y confírmalo en el mapa.</p>

        <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.05)]">
          <label className="text-xs font-black text-slate-600">Nombre del negocio o dirección</label>
          <div className="mt-2 flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} placeholder="Ej. Ferretería Beato, Villa Consuelo" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
            <button type="button" onClick={() => void search()} className="rounded-2xl bg-slate-950 px-4 text-xs font-black text-white">{searching ? '...' : 'Buscar'}</button>
          </div>
          <button type="button" onClick={useCurrentLocation} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">Usar mi ubicación actual</button>

          {results.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Selecciona la ubicación correcta</p>
              {results.map((result, index) => {
                const address = String(result.display_name || result.place_name || result.name || 'Ubicación')
                return <button key={`${address}-${index}`} type="button" onClick={() => selectResult(result)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-xs leading-5 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50">{address}</button>
              })}
            </div>
          )}

          {selected && (
            <div className="mt-5">
              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-100">
                <iframe title="Mapa de ubicación seleccionada" src={mapEmbedUrl} className="h-[280px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
              <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-800">{selected.placeName}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{selected.address}</p>
                <p className="mt-1 text-[10px] text-slate-400">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</p>
              </div>
            </div>
          )}

          {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">{error}</p>}
          {saved && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">Ubicación guardada.</p>}
          <button type="button" onClick={() => void save()} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white">{saving ? 'Guardando…' : 'Guardar ubicación'}</button>
        </section>

        <div className="mt-5"><FreeUpgradeCard compact /></div>
      </div>
    </main>
  )
}
