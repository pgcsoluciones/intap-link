import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'
import { FreeBackButton, FreeUpgradeCard } from './FreePanelUi'

function normalizeMapsUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function FreeLocation() {
  const navigate = useNavigate()
  const [address, setAddress] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/me/contact').then((json: any) => {
      if (!json.ok || !json.data) return
      setAddress(json.data.place_name || json.data.address || '')
      setMapUrl(json.data.map_url || '')
    })
  }, [])

  const mapsSearchUrl = useMemo(() => {
    const query = address.trim()
    return query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : 'https://www.google.com/maps'
  }, [address])

  const mapPreviewUrl = useMemo(() => {
    if (!address.trim()) return ''
    return `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`
  }, [address])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!address.trim()) {
      setError('Escribe el nombre del negocio o una dirección.')
      return
    }

    setSaving(true)
    setSaved(false)
    setError('')

    const normalizedUrl = normalizeMapsUrl(mapUrl) || mapsSearchUrl

    try {
      const json: any = await apiPut('/me/contact', {
        address: address.trim(),
        place_name: address.trim(),
        map_url: normalizedUrl,
      })
      if (json.ok) {
        setMapUrl(normalizedUrl)
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
          Escribe el nombre de tu negocio o una dirección. Abre Google Maps para localizar el punto exacto y, si quieres, pega aquí su enlace compartido.
        </p>

        <form onSubmit={save} className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.05)]">
          <label className="text-xs font-black text-slate-600">Nombre del negocio o dirección</label>
          <input
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              setSaved(false)
              setError('')
            }}
            placeholder="Ej. Ferretería Beato, Villa Consuelo"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          />

          <a
            href={mapsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-700"
          >
            Buscar esta ubicación en Google Maps
          </a>

          <label className="mt-5 block text-xs font-black text-slate-600">Enlace exacto de Google Maps</label>
          <input
            value={mapUrl}
            onChange={(event) => {
              setMapUrl(event.target.value)
              setSaved(false)
              setError('')
            }}
            inputMode="url"
            placeholder="Pega aquí el enlace copiado de Google Maps"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          />
          <p className="mt-2 text-xs leading-5 text-slate-400">
            En Google Maps: busca tu empresa → Compartir → Copiar enlace. Si no pegas uno, guardaremos el enlace de búsqueda generado con el nombre o dirección.
          </p>

          {mapPreviewUrl && (
            <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-100">
              <iframe
                title="Vista previa de ubicación"
                src={mapPreviewUrl}
                className="h-[250px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}

          {saved && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">Ubicación guardada.</p>}
          {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">{error}</p>}

          <button
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-40"
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
