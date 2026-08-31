import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'
import { FreeBackButton, FreeUpgradeCard } from './FreePanelUi'

function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function mapsEmbedUrl(query: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}

export default function FreeLocation() {
  const navigate = useNavigate()
  const [address, setAddress] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [previewQuery, setPreviewQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selected, setSelected] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/me/contact').then((json: any) => {
      if (!json.ok || !json.data) return
      const savedAddress = json.data.place_name || json.data.address || ''
      const savedMapUrl = json.data.map_url || ''
      setAddress(savedAddress)
      setMapUrl(savedMapUrl)
      if (savedAddress) setPreviewQuery(savedAddress)
      setSelected(Boolean(savedMapUrl))
    })
  }, [])

  const mapPreviewUrl = useMemo(() => {
    return previewQuery ? mapsEmbedUrl(previewQuery) : ''
  }, [previewQuery])

  const searchLocation = () => {
    const query = address.trim()
    if (!query) {
      setError('Escribe el nombre del negocio o una dirección.')
      return
    }
    setError('')
    setSaved(false)
    setSelected(false)
    setMapUrl('')
    setPreviewQuery(query)
  }

  const usePreviewLocation = () => {
    if (!previewQuery) return
    setMapUrl(mapsSearchUrl(previewQuery))
    setSelected(true)
    setSaved(false)
    setError('')
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite obtener tu ubicación actual.')
      return
    }

    setLocating(true)
    setSaved(false)
    setError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`
        if (!address.trim()) setAddress('Ubicación actual')
        setPreviewQuery(coordinates)
        setMapUrl(mapsSearchUrl(coordinates))
        setSelected(true)
        setLocating(false)
      },
      (geoError) => {
        setLocating(false)
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError('Permite el acceso a tu ubicación o búscala escribiendo el nombre o la dirección.')
          return
        }
        setError('No pudimos obtener tu ubicación. Intenta buscarla por nombre o dirección.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!address.trim()) {
      setError('Escribe el nombre del negocio o una dirección.')
      return
    }
    if (!mapUrl || !selected) {
      setError('Busca la ubicación y confirma “Usar esta ubicación” antes de guardar.')
      return
    }

    setSaving(true)
    setSaved(false)
    setError('')

    try {
      const json: any = await apiPut('/me/contact', {
        address: address.trim(),
        place_name: address.trim(),
        map_url: mapUrl,
      })
      if (json.ok) {
        setSaved(true)
      } else {
        setError(json.error || 'No pudimos guardar la ubicación.')
      }
    } catch {
      setError('No pudimos guardar la ubicación.')
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
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Encuentra tu negocio o dirección sin salir del panel, confirma el punto en el mapa y guárdalo en tu perfil.
        </p>

        <form onSubmit={save} className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.05)]">
          <label className="text-xs font-black text-slate-600">Nombre del negocio o dirección</label>
          <input
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              setSaved(false)
              setSelected(false)
              setMapUrl('')
              setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                searchLocation()
              }
            }}
            placeholder="Ej. Ferretería Beato, Villa Consuelo"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          />

          <button
            type="button"
            onClick={searchLocation}
            className="mt-3 w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-700"
          >
            Buscar ubicación
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
            <span className="h-px flex-1 bg-slate-200" />
            o
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
          >
            {locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}
          </button>

          {mapPreviewUrl && (
            <div className="mt-5">
              <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-100">
                <iframe
                  title="Vista previa de ubicación"
                  src={mapPreviewUrl}
                  className="h-[290px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Verifica que el mapa muestre el lugar correcto. Si no coincide, ajusta el nombre o la dirección y vuelve a buscar.
              </p>

              {!selected ? (
                <button
                  type="button"
                  onClick={usePreviewLocation}
                  className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                >
                  Usar esta ubicación
                </button>
              ) : (
                <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  ✓ Ubicación seleccionada
                </div>
              )}
            </div>
          )}

          {saved && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">Ubicación guardada en tu perfil.</p>}
          {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">{error}</p>}

          <button
            disabled={saving || !selected}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar ubicación'}
          </button>
        </form>

        <div className="mt-5">
          <FreeUpgradeCard compact />
        </div>
        <div className="mt-4"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>
      </div>
    </main>
  )
}
