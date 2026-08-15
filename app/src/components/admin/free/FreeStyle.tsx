import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch, apiPut } from '../../../lib/api'
import { FreeBackButton, FreeUpgradeCard } from './FreePanelUi'

type LayoutId = 'impacto' | 'personal' | 'esencial'
type PaletteId = 'intap' | 'oceano' | 'esmeralda' | 'violeta' | 'coral' | 'grafito' | 'arena' | 'personalizada'
type MeData = {
  layout_id?: LayoutId | null
  slug?: string | null
  free_palette_id?: PaletteId | null
  free_brand_color?: string | null
  category?: string | null
}
type Palette = {
  id: Exclude<PaletteId, 'personalizada'>
  name: string
  colors: string[]
}

const layouts: Array<{ id: LayoutId; name: string; description: string; recommended: string }> = [
  { id: 'impacto', name: 'Impacto', description: 'Portada visual con imagen protagonista y foto de perfil.', recommended: 'Empresas, negocios y marcas' },
  { id: 'personal', name: 'Personal', description: 'Tu fotografía y tu identidad tienen mayor protagonismo.', recommended: 'Asesores, vendedores y marca personal' },
  { id: 'esencial', name: 'Esencial', description: 'Diseño limpio, directo y sin fotografía de portada.', recommended: 'Perfiles rápidos y profesionales' },
]

const palettes: Palette[] = [
  { id: 'intap', name: 'INTAP', colors: ['#071F5F', '#0B61C9', '#10B981', '#EAF0F7'] },
  { id: 'oceano', name: 'Océano', colors: ['#0C4A6E', '#0284C7', '#0891B2', '#F0F9FF'] },
  { id: 'esmeralda', name: 'Esmeralda', colors: ['#064E3B', '#047857', '#10B981', '#ECFDF5'] },
  { id: 'violeta', name: 'Violeta', colors: ['#4C1D95', '#7C3AED', '#A855F7', '#FAF5FF'] },
  { id: 'coral', name: 'Coral', colors: ['#9F1239', '#E11D48', '#FB7185', '#FFF1F2'] },
  { id: 'grafito', name: 'Grafito', colors: ['#111827', '#374151', '#64748B', '#F3F4F6'] },
  { id: 'arena', name: 'Arena', colors: ['#5C4033', '#8B6F47', '#B08968', '#FAF7F2'] },
]

function normalizeHex(value: string) {
  let raw = value.trim().replace(/[^0-9a-fA-F#]/g, '')
  if (!raw.startsWith('#')) raw = `#${raw}`
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : null
}

export default function FreeStyle() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<LayoutId>('esencial')
  const [palette, setPalette] = useState<PaletteId>('intap')
  const [brandColor, setBrandColor] = useState('#071F5F')
  const [slug, setSlug] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [previewVersion, setPreviewVersion] = useState(1)

  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  const previewUrl = useMemo(() => slug ? `${webUrl}/${encodeURIComponent(slug)}?preview=1&v=${previewVersion}` : '', [webUrl, slug, previewVersion])
  const refreshPreview = () => setPreviewVersion((current) => current + 1)

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (!json?.ok) return
      const data = (json.data || {}) as MeData
      if (data.layout_id === 'impacto' || data.layout_id === 'personal' || data.layout_id === 'esencial') setSelected(data.layout_id)
      const currentPalette = data.free_palette_id
      if (currentPalette && ['intap', 'oceano', 'esmeralda', 'violeta', 'coral', 'grafito', 'arena', 'personalizada'].includes(currentPalette)) setPalette(currentPalette)
      if (data.free_brand_color && /^#[0-9a-fA-F]{6}$/.test(data.free_brand_color)) setBrandColor(data.free_brand_color.toUpperCase())
      setCategory(data.category || '')
      setSlug(data.slug || null)
    }).finally(() => setLoading(false))
  }, [])

  async function chooseLayout(layout: LayoutId) {
    if (saving) return
    setSaving(true)
    setMessage('')
    try {
      const json: any = await apiPut('/me/profile', { layout_id: layout })
      if (!json?.ok) return setMessage(json?.error || 'No se pudo guardar el estilo.')
      setSelected(layout)
      setMessage('Estilo actualizado.')
      refreshPreview()
    } catch {
      setMessage('No se pudo guardar el estilo.')
    } finally {
      setSaving(false)
    }
  }

  async function choosePalette(paletteId: PaletteId, color?: string) {
    if (saving) return
    const customColor = paletteId === 'personalizada' ? normalizeHex(color || brandColor) : null
    if (paletteId === 'personalizada' && !customColor) return setMessage('Selecciona un color válido.')
    setSaving(true)
    setMessage('')
    try {
      const json: any = await apiPatch('/me/profile/free-appearance', {
        palette_id: paletteId,
        brand_color: paletteId === 'personalizada' ? customColor : undefined,
      })
      if (!json?.ok) return setMessage(json?.error || 'No se pudo guardar la paleta.')
      setPalette(paletteId)
      if (customColor) setBrandColor(customColor)
      setMessage('Colores actualizados.')
      refreshPreview()
    } catch {
      setMessage('No se pudo guardar la paleta.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] font-['Inter']"><div className="flex min-h-screen items-center justify-center text-sm font-bold text-slate-400">Cargando…</div></main>

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-5 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[1040px]">
        <FreeBackButton onClick={() => navigate('/admin/free')} />

        <div className="grid gap-8 lg:grid-cols-[430px_minmax(0,1fr)] lg:items-start">
          <div className="contents lg:block">
            <div className="order-1 lg:order-none">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">INTAP LINK</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Estilo de mi perfil</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Tus datos son los mismos. Elige cómo quieres presentarlos.</p>
              {category && <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-500 shadow-sm">{category}</p>}

              <section className="mt-7">
                <h2 className="text-sm font-black">Diseño</h2>
                <div className="mt-3 space-y-3">
                  {layouts.map((layout) => {
                    const active = selected === layout.id
                    return (
                      <button key={layout.id} type="button" disabled={saving} onClick={() => void chooseLayout(layout.id)} className={`w-full rounded-[22px] border bg-white p-4 text-left transition ${active ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200 hover:border-slate-300'} disabled:opacity-60`}>
                        <div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-black">{layout.name}</h3><p className="mt-1 text-[11px] font-bold text-cyan-600">{layout.recommended}</p></div>{active && <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-700">Activo</span>}</div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{layout.description}</p>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>

            <section className="order-3 mt-7 lg:order-none">
              <h2 className="text-sm font-black">Colores de mi marca</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Elige una combinación completa. No necesitas configurar cada sección.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {palettes.map((item) => {
                  const active = palette === item.id
                  return (
                    <button key={item.id} type="button" disabled={saving} onClick={() => void choosePalette(item.id)} className={`rounded-[20px] border bg-white p-3 text-left transition ${active ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200 hover:border-slate-300'} disabled:opacity-60`}>
                      <div className="flex gap-1.5">{item.colors.map((color) => <span key={color} className="h-8 flex-1 rounded-lg border border-black/5" style={{ backgroundColor: color }} />)}</div>
                      <div className="mt-2 flex items-center justify-between"><span className="text-xs font-black">{item.name}</span>{active && <span className="text-[10px] font-black text-cyan-600">Activa</span>}</div>
                    </button>
                  )
                })}
              </div>

              <div className={`mt-3 rounded-[22px] border bg-white p-4 ${palette === 'personalizada' ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black">Personalizar</h3><p className="mt-1 text-xs leading-5 text-slate-400">Elige tu color principal y el sistema crea el resto.</p></div><input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" aria-label="Color principal" /></div>
                <div className="mt-3 flex gap-2"><input value={brandColor} onChange={(event) => setBrandColor(event.target.value.toUpperCase())} maxLength={7} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold uppercase outline-none focus:border-cyan-400" /><button type="button" disabled={saving} onClick={() => void choosePalette('personalizada', brandColor)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Aplicar</button></div>
              </div>
              {message && <p className="order-4 mt-5 text-center text-xs font-bold text-slate-500 lg:order-none">{message}</p>}
              <div className="mt-5"><FreeUpgradeCard compact /></div>
            </section>
          </div>

          <aside className="order-2 lg:sticky lg:top-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vista previa</p><p className="mt-1 text-xs font-bold text-slate-600">Así se ve tu perfil</p></div><button type="button" onClick={refreshPreview} className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600">Actualizar</button></div>
              {slug ? <div className="mx-auto overflow-hidden rounded-[24px] border border-slate-200 bg-[#eef3f8]"><iframe key={previewVersion} src={previewUrl} title="Vista previa de mi perfil" className="h-[720px] w-full bg-white" /></div> : <div className="flex h-[520px] items-center justify-center rounded-[24px] bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Completa tu perfil para ver la vista previa.</div>}
              {slug && <a href={`${webUrl}/${slug}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white">Abrir perfil completo</a>}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
