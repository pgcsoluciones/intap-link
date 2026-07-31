import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  useNavigate,
} from 'react-router-dom'
import {
  divIcon,
  type LatLngTuple,
} from 'leaflet'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  apiGet,
  apiPut,
} from '../../../lib/api'

interface LocationResult {
  place_name: string
  address: string
  latitude: number
  longitude: number
}

interface MapClickHandlerProps {
  onPick: (
    latitude: number,
    longitude: number,
  ) => void
}

interface MapViewUpdaterProps {
  center: LatLngTuple
  zoom: number
}

const DEFAULT_CENTER: LatLngTuple = [
  18.4861,
  -69.9312,
]

const locationPin = divIcon({
  className: '',
  html: `
    <div
      style="
        width:42px;
        height:42px;
        border-radius:50% 50% 50% 0;
        background:#6d28d9;
        border:4px solid white;
        box-shadow:0 5px 14px rgba(15,23,42,.3);
        transform:rotate(-45deg);
        display:flex;
        align-items:center;
        justify-content:center;
      "
    >
      <div
        style="
          width:12px;
          height:12px;
          border-radius:999px;
          background:white;
        "
      ></div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
})

function MapClickHandler({
  onPick,
}: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onPick(
        event.latlng.lat,
        event.latlng.lng,
      )
    },
  })

  return null
}

function MapViewUpdater({
  center,
  zoom,
}: MapViewUpdaterProps) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom)
  }, [
    center,
    map,
    zoom,
  ])

  return null
}

export default function FreeLocation() {
  const navigate = useNavigate()

  const [query, setQuery] =
    useState('')

  const [placeName, setPlaceName] =
    useState('')

  const [address, setAddress] =
    useState('')

  const [latitude, setLatitude] =
    useState<number | null>(null)

  const [longitude, setLongitude] =
    useState<number | null>(null)

  const [results, setResults] =
    useState<LocationResult[]>([])

  const [loading, setLoading] =
    useState(true)

  const [searching, setSearching] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [locating, setLocating] =
    useState(false)

  const [error, setError] =
    useState('')

  const hasPoint =
    latitude !== null &&
    longitude !== null

  const mapCenter =
    useMemo<LatLngTuple>(
      () => (
        hasPoint
          ? [
              latitude as number,
              longitude as number,
            ]
          : DEFAULT_CENTER
      ),
      [
        hasPoint,
        latitude,
        longitude,
      ],
    )

  useEffect(() => {
    apiGet('/me/contact')
      .then((json: any) => {
        if (!json.ok || !json.data) {
          return
        }

        const data = json.data

        setPlaceName(
          data.place_name || '',
        )

        setAddress(
          data.address || '',
        )

        const nextLatitude =
          Number(data.latitude)

        const nextLongitude =
          Number(data.longitude)

        if (
          Number.isFinite(nextLatitude) &&
          Number.isFinite(nextLongitude) &&
          nextLatitude >= -90 &&
          nextLatitude <= 90 &&
          nextLongitude >= -180 &&
          nextLongitude <= 180
        ) {
          setLatitude(nextLatitude)
          setLongitude(nextLongitude)
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const pickPoint = (
    nextLatitude: number,
    nextLongitude: number,
  ) => {
    setLatitude(nextLatitude)
    setLongitude(nextLongitude)
    setError('')
  }

  const searchPlaces = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault()
    setError('')
    setResults([])

    const cleanQuery =
      query.trim()

    if (cleanQuery.length < 3) {
      setError(
        'Escribe al menos tres caracteres.',
      )
      return
    }

    setSearching(true)

    try {
      const json: any =
        await apiGet(
          `/me/location/search?q=${encodeURIComponent(
            cleanQuery,
          )}`,
        )

      if (json.ok) {
        const items =
          Array.isArray(json.data)
            ? json.data
            : []

        setResults(items)

        if (items.length === 0) {
          setError(
            'No encontramos resultados. Agrega ciudad o país a la búsqueda.',
          )
        }

        return
      }

      if (json.error) {
        setError(json.error)
        return
      }

      setError(
        'No se pudo realizar la búsqueda.',
      )
    } catch {
      setError(
        'Error de conexión durante la búsqueda.',
      )
    } finally {
      setSearching(false)
    }
  }

  const selectResult = (
    result: LocationResult,
  ) => {
    setPlaceName(
      result.place_name,
    )

    setAddress(
      result.address,
    )

    setLatitude(
      result.latitude,
    )

    setLongitude(
      result.longitude,
    )

    setResults([])
    setError('')
  }

  const useCurrentLocation = () => {
    setError('')

    if (!navigator.geolocation) {
      setError(
        'Este navegador no permite obtener la ubicación.',
      )
      return
    }

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(
          position.coords.latitude,
        )

        setLongitude(
          position.coords.longitude,
        )

        setLocating(false)
      },
      () => {
        setError(
          'No se pudo obtener tu ubicación. Puedes marcarla manualmente en el mapa.',
        )

        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    )
  }

  const saveLocation = async () => {
    setError('')

    if (!hasPoint) {
      setError(
        'Busca una ubicación o marca un punto en el mapa.',
      )
      return
    }

    setSaving(true)

    try {
      const json: any =
        await apiPut(
          '/me/contact',
          {
            place_name:
              placeName.trim(),
            address:
              address.trim(),
            latitude,
            longitude,
          },
        )

      if (json.ok) {
        navigate(
          '/admin/free/links',
        )
        return
      }

      setError(
        json.error ||
        'No se pudo guardar la ubicación.',
      )
    } catch {
      setError(
        'Error de conexión al guardar.',
      )
    } finally {
      setSaving(false)
    }
  }

  const clearLocation = async () => {
    const confirmed =
      confirm(
        '¿Quitar la ubicación guardada?',
      )

    if (!confirmed) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const json: any =
        await apiPut(
          '/me/contact',
          {
            clear_location: true,
          },
        )

      if (json.ok) {
        setPlaceName('')
        setAddress('')
        setLatitude(null)
        setLongitude(null)
        setResults([])
        return
      }

      setError(
        json.error ||
        'No se pudo quitar la ubicación.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] px-4 py-10">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4, 5].map(
            (step) => (
              <div
                key={step}
                className="h-1 flex-1 rounded-full bg-intap-mint"
              />
            ),
          )}
        </div>

        <header className="mb-6">
          <p className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-2">
            Paso 5 de 5
          </p>

          <h1 className="text-2xl font-black">
            Ubicación
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Busca tu negocio o marca el punto
            exacto directamente en el mapa.
          </p>
        </header>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <form
            onSubmit={searchPlaces}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Nombre del negocio, dirección, ciudad o país"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-intap-mint/50"
            />

            <button
              type="submit"
              disabled={searching}
              className="bg-slate-900 text-white font-bold rounded-xl px-5 py-3 text-sm disabled:opacity-50"
            >
              {searching
                ? 'Buscando…'
                : 'Buscar'}
            </button>
          </form>

          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="w-full mt-3 border border-slate-200 rounded-xl py-2.5 text-xs font-bold text-slate-600 disabled:opacity-50"
          >
            {locating
              ? 'Obteniendo ubicación…'
              : '◎ Usar mi ubicación actual'}
          </button>

          <p className="text-[11px] text-slate-500 mt-3">
            La búsqueda se realiza únicamente
            cuando pulsas el botón Buscar.
            No introduzcas ubicaciones privadas
            que no quieras publicar.
          </p>

          {results.length > 0 && (
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
              {results.map(
                (result, index) => (
                  <button
                    key={`${result.latitude}-${result.longitude}-${index}`}
                    type="button"
                    onClick={() =>
                      selectResult(
                        result,
                      )
                    }
                    className="w-full text-left px-4 py-3 border-b last:border-b-0 border-slate-200 hover:bg-slate-50"
                  >
                    <p className="text-sm font-bold">
                      {result.place_name}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      {result.address}
                    </p>
                  </button>
                ),
              )}
            </div>
          )}
        </section>

        <section className="mt-5 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="h-[360px]">
            <MapContainer
              center={mapCenter}
              zoom={hasPoint ? 17 : 12}
              scrollWheelZoom
              className="w-full h-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapViewUpdater
                center={mapCenter}
                zoom={hasPoint ? 17 : 12}
              />

              <MapClickHandler
                onPick={pickPoint}
              />

              {hasPoint && (
                <Marker
                  position={[
                    latitude as number,
                    longitude as number,
                  ]}
                  icon={locationPin}
                  draggable
                  eventHandlers={{
                    dragend(event: any) {
                      const next =
                        event.target
                          .getLatLng()

                      pickPoint(
                        next.lat,
                        next.lng,
                      )
                    },
                  }}
                />
              )}
            </MapContainer>
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              Pulsa sobre el mapa o arrastra el pin
              hasta el punto exacto.
            </p>

            {hasPoint && (
              <p className="text-[11px] text-slate-400 mt-1">
                {latitude.toFixed(6)},
                {' '}
                {longitude.toFixed(6)}
              </p>
            )}
          </div>
        </section>

        <section className="mt-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Nombre del lugar
            </label>

            <input
              type="text"
              value={placeName}
              onChange={(event) =>
                setPlaceName(
                  event.target.value,
                )
              }
              placeholder="Ej: Prince Grupo Creativo"
              maxLength={120}
              className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-intap-mint/50"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Dirección visible
            </label>

            <textarea
              value={address}
              onChange={(event) =>
                setAddress(
                  event.target.value,
                )
              }
              placeholder="Calle, sector, ciudad y país"
              maxLength={240}
              rows={3}
              className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-intap-mint/50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={saveLocation}
            disabled={saving}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {saving
              ? 'Guardando…'
              : 'Guardar ubicación y continuar →'}
          </button>

          {hasPoint && (
            <button
              type="button"
              onClick={clearLocation}
              disabled={saving}
              className="w-full border border-red-100 bg-red-50 text-red-500 font-bold py-3 rounded-xl text-xs disabled:opacity-50"
            >
              Quitar ubicación
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              navigate(
                '/admin/free/links',
              )
            }
            className="w-full text-xs text-slate-500 py-2"
          >
            Omitir por ahora
          </button>
        </section>
      </div>
    </div>
  )
}
