import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'

type LayoutId = 'impacto' | 'personal' | 'esencial'

type MeData = {
  layout_id?: LayoutId | null
  slug?: string | null
}

const layouts: Array<{
  id: LayoutId
  name: string
  description: string
  recommended: string
}> = [
  {
    id: 'impacto',
    name: 'Impacto',
    description: 'Portada visual con imagen protagonista y foto de perfil.',
    recommended: 'Empresas, negocios y marcas',
  },
  {
    id: 'personal',
    name: 'Personal',
    description: 'Tu fotografía y tu identidad tienen mayor protagonismo.',
    recommended: 'Asesores, vendedores y marca personal',
  },
  {
    id: 'esencial',
    name: 'Esencial',
    description: 'Diseño limpio, directo y sin fotografía de portada.',
    recommended: 'Perfiles rápidos y profesionales',
  },
]

export default function FreeStyle() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<LayoutId>('esencial')
  const [slug, setSlug] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (!json?.ok) return
      const current = json.data?.layout_id
      if (current === 'impacto' || current === 'personal' || current === 'esencial') {
        setSelected(current)
      }
      setSlug(json.data?.slug || null)
    })
  }, [])

  async function choose(layout: LayoutId) {
    if (saving) return
    setSaving(true)
    setMessage('')

    try {
      const json: any = await apiPut('/me/profile', {
        layout_id: layout,
      })

      if (!json?.ok) {
        setMessage(json?.error || 'No se pudo guardar el estilo.')
        return
      }

      setSelected(layout)
      setMessage('Estilo actualizado.')
    } catch {
      setMessage('No se pudo guardar el estilo.')
    } finally {
      setSaving(false)
    }
  }

  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[430px]">
        <button
          onClick={() => navigate('/admin/free')}
          className="mb-6 text-sm font-bold text-slate-500"
        >
          ← Mi panel
        </button>

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">
          INTAP LINK
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
          Estilo de mi perfil
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Tus datos son los mismos. Solo cambia la forma de presentarlos.
        </p>

        <div className="mt-7 space-y-4">
          {layouts.map((layout) => {
            const active = selected === layout.id

            return (
              <button
                key={layout.id}
                type="button"
                disabled={saving}
                onClick={() => choose(layout.id)}
                className={`w-full rounded-[24px] border bg-white p-5 text-left transition ${
                  active
                    ? 'border-cyan-500 ring-4 ring-cyan-100'
                    : 'border-slate-200'
                } disabled:opacity-60`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black">{layout.name}</h2>
                    <p className="mt-1 text-xs font-bold text-cyan-600">
                      {layout.recommended}
                    </p>
                  </div>

                  {active && (
                    <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-700">
                      Activo
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {layout.description}
                </p>

                <div
                  className={`mt-4 h-28 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-3 ${
                    layout.id === 'impacto'
                      ? 'bg-[linear-gradient(145deg,#dbeafe_0%,#f8fafc_55%)]'
                      : layout.id === 'personal'
                        ? 'bg-[linear-gradient(180deg,#cbd5e1_0%,#1e3a8a_100%)]'
                        : 'bg-white'
                  }`}
                >
                  <div className="mx-auto h-full max-w-[150px] rounded-xl border border-slate-200 bg-white/90 p-2">
                    {layout.id === 'impacto' && (
                      <div className="h-9 rounded-md bg-slate-300" />
                    )}
                    <div
                      className={`mx-auto rounded-full bg-slate-400 ${
                        layout.id === 'impacto'
                          ? '-mt-3 h-8 w-8 border-2 border-white'
                          : layout.id === 'personal'
                            ? 'mt-1 h-12 w-12'
                            : 'mt-2 h-9 w-9'
                      }`}
                    />
                    <div className="mx-auto mt-2 h-2 w-16 rounded bg-slate-800" />
                    <div className="mx-auto mt-1 h-1.5 w-12 rounded bg-slate-300" />
                    <div className="mt-3 h-5 rounded-md bg-cyan-600" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {message && (
          <p className="mt-4 text-center text-xs font-bold text-slate-500">
            {message}
          </p>
        )}

        {slug && (
          <a
            href={`${webUrl}/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white"
          >
            Ver mi perfil
          </a>
        )}
      </section>
    </main>
  )
}
