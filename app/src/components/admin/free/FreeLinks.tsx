import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
} from 'react-router-dom'
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
} from '../../../lib/api'

interface FreeLinkItem {
  id: string
  label: string
  url: string
  is_active: number
}

const MAX_FREE_LINKS = 3

function normalizeHttpUrl(
  input: string,
): string | null {
  const trimmed = input.trim()

  if (!trimmed) {
    return null
  }

  const candidate =
    /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, '')}`

  try {
    const parsed = new URL(candidate)

    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:'
    ) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(
      /^www\./,
      '',
    )
  } catch {
    return url
  }
}

export default function FreeLinks() {
  const navigate = useNavigate()

  const [links, setLinks] =
    useState<FreeLinkItem[]>([])

  const [label, setLabel] =
    useState('')

  const [url, setUrl] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState('')

  const reload = async () => {
    try {
      const json: any =
        await apiGet('/me/links')

      if (json.ok) {
        setLinks(json.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const addLink = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault()
    setError('')

    if (links.length >= MAX_FREE_LINKS) {
      setError(
        'Ya alcanzaste el máximo de 3 enlaces.',
      )
      return
    }

    const normalizedUrl =
      normalizeHttpUrl(url)

    if (!normalizedUrl) {
      setError(
        'Escribe una dirección válida, por ejemplo: youtube.com o www.instagram.com/empresa',
      )
      return
    }

    setSaving(true)

    try {
      const json: any =
        await apiPost('/me/links', {
          label: label.trim(),
          url: normalizedUrl,
        })

      if (json.ok) {
        setLabel('')
        setUrl('')
        await reload()
        return
      }

      if (json.limit) {
        setError(
          `Alcanzaste el límite de ${json.limit} enlaces de tu plan.`,
        )
        return
      }

      setError(
        json.error ||
        'No se pudo guardar el enlace.',
      )
    } catch {
      setError(
        'Error de conexión al guardar.',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (
    item: FreeLinkItem,
  ) => {
    await apiPut(
      `/me/links/${item.id}`,
      {
        is_active: !item.is_active,
      },
    )

    await reload()
  }

  const deleteLink = async (
    id: string,
  ) => {
    if (
      !confirm(
        '¿Eliminar este enlace?',
      )
    ) {
      return
    }

    await apiDelete(`/me/links/${id}`)
    await reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  const remaining =
    MAX_FREE_LINKS - links.length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] px-4 py-10">
      <div className="w-full max-w-lg mx-auto">
        <header className="flex items-center gap-4 mb-7">
          <Link
            to="/admin"
            className="text-slate-400 hover:text-slate-900"
          >
            ←
          </Link>

          <div className="flex-1">
            <h1 className="text-xl font-black">
              Mis enlaces
            </h1>

            <p className="text-xs text-slate-500 mt-1">
              Agrega hasta 3 redes sociales,
              páginas o enlaces importantes.
            </p>
          </div>

          <span className="text-xs font-black bg-white border border-slate-200 rounded-full px-3 py-1.5">
            {links.length}/{MAX_FREE_LINKS}
          </span>
        </header>

        <form
          onSubmit={addLink}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3"
        >
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Agregar enlace
          </p>

          <input
            type="text"
            value={label}
            onChange={(event) =>
              setLabel(event.target.value)
            }
            placeholder="Ej: Mi canal de YouTube"
            maxLength={60}
            required
            disabled={remaining === 0}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-intap-mint/50 disabled:bg-slate-100"
          />

          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(event) =>
              setUrl(event.target.value)
            }
            onBlur={() => {
              const normalized =
                normalizeHttpUrl(url)

              if (normalized) {
                setUrl(normalized)
              }
            }}
            placeholder="youtube.com o www.instagram.com/empresa"
            required
            disabled={remaining === 0}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-intap-mint/50 disabled:bg-slate-100"
          />

          <p className="text-[11px] text-slate-500">
            No necesitas escribir “https://”.
            Lo agregaremos automáticamente.
          </p>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              saving ||
              remaining === 0
            }
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Guardando…'
              : remaining === 0
                ? 'Límite alcanzado'
                : '+ Agregar enlace'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          {links.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
              <p className="text-sm font-bold text-slate-700">
                Todavía no tienes enlaces
              </p>

              <p className="text-xs text-slate-500 mt-1">
                Agrega por lo menos dos acciones
                para poder publicar tu perfil.
              </p>
            </div>
          ) : (
            links.map((item) => (
              <div
                key={item.id}
                className={`bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 ${
                  item.is_active
                    ? ''
                    : 'opacity-50'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  🔗
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {item.label}
                  </p>

                  <p className="text-xs text-slate-500 truncate">
                    {hostLabel(item.url)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    toggleActive(item)
                  }
                  className={`text-xs font-black px-2.5 py-1.5 rounded-full border ${
                    item.is_active
                      ? 'text-green-600 border-green-200 bg-green-50'
                      : 'text-slate-500 border-slate-200'
                  }`}
                >
                  {item.is_active
                    ? 'Activo'
                    : 'Oculto'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    deleteLink(item.id)
                  }
                  title="Eliminar"
                  className="text-slate-400 hover:text-red-500"
                >
                  🗑
                </button>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            navigate('/admin/free/portfolio')
          }
          className="w-full mt-7 bg-slate-900 text-white font-bold py-3 rounded-xl text-sm"
        >
          Continuar al portafolio →
        </button>

        <button
          type="button"
          onClick={() =>
            navigate('/admin')
          }
          className="w-full mt-2 text-xs text-slate-500 py-2"
        >
          Completar después
        </button>
      </div>
    </div>
  )
}
