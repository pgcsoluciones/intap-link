import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch, apiPut } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

type LayoutId = 'impacto' | 'personal' | 'esencial'
type PaletteId = 'intap' | 'oceano' | 'esmeralda' | 'violeta' | 'coral' | 'grafito' | 'arena'

type MeData = {
  slug?: string | null
  name?: string | null
  bio?: string | null
  layout_id?: LayoutId | null
  free_palette_id?: PaletteId | null
  templateData?: Record<string, unknown> | null
}

const layouts: Array<{ id: LayoutId; name: string; text: string }> = [
  { id: 'impacto', name: 'Impacto', text: 'Portada protagonista + foto de perfil' },
  { id: 'personal', name: 'Personal', text: 'Tu identidad tiene mayor protagonismo' },
  { id: 'esencial', name: 'Esencial', text: 'Limpio, directo y sin portada' },
]

const palettes: Array<{ id: PaletteId; name: string; colors: string[] }> = [
  { id: 'intap', name: 'Kawvo', colors: ['#071F5F', '#0B61C9', '#10B981'] },
  { id: 'oceano', name: 'Océano', colors: ['#0C4A6E', '#0284C7', '#0891B2'] },
  { id: 'esmeralda', name: 'Esmeralda', colors: ['#064E3B', '#047857', '#10B981'] },
  { id: 'violeta', name: 'Violeta', colors: ['#4C1D95', '#7C3AED', '#A855F7'] },
  { id: 'coral', name: 'Coral', colors: ['#9F1239', '#E11D48', '#FB7185'] },
  { id: 'grafito', name: 'Grafito', colors: ['#111827', '#374151', '#64748B'] },
  { id: 'arena', name: 'Arena', colors: ['#5C4033', '#8B6F47', '#B08968'] },
]

const sectionLinks = [
  { title: 'Foto y portada', text: 'Cambia tu foto de perfil y, en Impacto, la imagen Hero.', to: '/admin/free/onboarding/identity', icon: '◉' },
  { title: 'Contacto', text: 'WhatsApp, teléfono y correo.', to: '/admin/free/onboarding/contact', icon: '☎' },
  { title: 'Botones rápidos', text: 'Llamar, Instagram, ubicación, email o TikTok.', to: '/admin/free/quick-actions', icon: '↗' },
  { title: 'Portafolio', text: 'Agrega o reemplaza imágenes de tus trabajos.', to: '/admin/free/portfolio', icon: '▧' },
  { title: 'Servicios', text: 'Edita tus servicios, imágenes y descripciones.', to: '/admin/free/services', icon: '◇' },
  { title: 'Enlaces', text: 'Catálogo, formularios u otros enlaces importantes.', to: '/admin/free/links', icon: '⌁' },
  { title: 'Cuentas bancarias', text: 'Agrega tus datos bancarios para que tus clientes los copien fácilmente al hacer una transferencia.', to: '/admin/free/bank-accounts', icon: '$' },
]

export default function FreeVisualEditor() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [bio, setBio] = useState('')
  const [templateData, setTemplateData] = useState<Record<string, unknown>>({})
  const [layout, setLayout] = useState<LayoutId>('esencial')
  const [palette, setPalette] = useState<PaletteId>('intap')
  const [previewVersion, setPreviewVersion] = useState(1)
  const [mobileMode, setMobileMode] = useState<'edit' | 'preview'>('edit')

  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  const previewUrl = useMemo(
    () => slug ? `${webUrl}/${encodeURIComponent(slug)}?preview=1&embed=1&v=${previewVersion}` : '',
    [slug, webUrl, previewVersion],
  )

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (!json?.ok) return
      const data = (json.data || {}) as MeData
      const td = data.templateData && typeof data.templateData === 'object' ? data.templateData : {}
      setSlug(String(data.slug || ''))
      setName(String(data.name || ''))
      setBio(String(data.bio || ''))
      setTemplateData(td)
      setRole(String(td.role || td.title || ''))
      if (data.layout_id === 'impacto' || data.layout_id === 'personal' || data.layout_id === 'esencial') setLayout(data.layout_id)
      if (data.free_palette_id && palettes.some((item) => item.id === data.free_palette_id)) setPalette(data.free_palette_id)
    }).finally(() => setLoading(false))
  }, [])

  const refreshPreview = () => setPreviewVersion((value) => value + 1)

  async function saveIdentity() {
    if (!name.trim() || !role.trim()) {
      setMessage('Completa tu nombre o marca y a qué te dedicas.')
      return false
    }
    setSaving(true)
    setMessage('')
    try {
      const nextTemplateData = { ...templateData, role: role.trim(), free_identity_confirmed: true }
      const json: any = await apiPut('/me/profile', {
        name: name.trim(),
        bio: bio.trim(),
        template_data: nextTemplateData,
      })
      if (!json?.ok) {
        setMessage(json?.error || 'No se pudieron guardar los cambios.')
        return false
      }
      setTemplateData(nextTemplateData)
      setMessage('✓ Cambios guardados')
      refreshPreview()
      return true
    } catch {
      setMessage('No se pudieron guardar los cambios.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveAndRefreshPreview() {
    if (saving) return
    const saved = await saveIdentity()
    if (saved) setMessage('✓ Guardado y vista previa actualizada')
  }

  async function chooseLayout(nextLayout: LayoutId) {
    if (saving || nextLayout === layout) return
    setSaving(true)
    setMessage('')
    try {
      const json: any = await apiPut('/me/profile', { layout_id: nextLayout })
      if (!json?.ok) return setMessage(json?.error || 'No se pudo cambiar la plantilla.')
      setLayout(nextLayout)
      setMessage('✓ Plantilla actualizada')
      refreshPreview()
    } catch {
      setMessage('No se pudo cambiar la plantilla.')
    } finally {
      setSaving(false)
    }
  }

  async function choosePalette(nextPalette: PaletteId) {
    if (saving || nextPalette === palette) return
    setSaving(true)
    setMessage('')
    try {
      const json: any = await apiPatch('/me/profile/free-appearance', { palette_id: nextPalette })
      if (!json?.ok) return setMessage(json?.error || 'No se pudieron cambiar los colores.')
      setPalette(nextPalette)
      setMessage('✓ Colores actualizados')
      refreshPreview()
    } catch {
      setMessage('No se pudieron cambiar los colores.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] grid place-items-center font-['Inter']"><div className="loading-spinner" /></main>

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[520px] gap-2 rounded-2xl bg-slate-100 p-1">
          <button type="button" onClick={() => setMobileMode('edit')} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'edit' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Editar</button>
          <button type="button" onClick={() => setMobileMode('preview')} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'preview' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Vista previa</button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-5">
        <div className="mb-5"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,58%)_minmax(360px,42%)] lg:items-start">
          <div className={`${mobileMode === 'preview' ? 'hidden' : 'block'} space-y-5 lg:block`}>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">KAWVO LINK</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Edita tu perfil como lo ves</h1>
              <p className="mt-2 max-w-2xl text-base font-medium leading-7 text-slate-600">Haz cambios aquí y comprueba el resultado en la vista previa. La experiencia se parece a la Demo, pero tus cambios se guardan en tu perfil real.</p>
            </div>

            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">1. Identidad</p><h2 className="mt-1 text-xl font-black">Lo primero que verá tu cliente</h2></div>
                {message && <span className="text-xs font-black text-emerald-700">{message}</span>}
              </div>
              <div className="mt-5 space-y-4">
                <label className="block"><span className="text-sm font-black text-slate-700">Nombre o marca</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                <label className="block"><span className="text-sm font-black text-slate-700">A qué te dedicas</span><input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                <label className="block"><span className="text-sm font-black text-slate-700">Descripción breve</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={4} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base leading-6 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /><span className="mt-1 block text-right text-xs font-semibold text-slate-400">{bio.length}/300</span></label>
              </div>
              <button type="button" onClick={() => void saveIdentity()} disabled={saving} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-black text-white disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">2. Apariencia</p>
              <h2 className="mt-1 text-xl font-black">Plantilla y colores</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {layouts.map((item) => <button key={item.id} type="button" disabled={saving} onClick={() => void chooseLayout(item.id)} className={`rounded-2xl border p-4 text-left transition ${layout === item.id ? 'border-cyan-500 bg-cyan-50 ring-4 ring-cyan-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}><span className="block text-base font-black">{item.name}</span><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{item.text}</span></button>)}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {palettes.map((item) => <button key={item.id} type="button" disabled={saving} onClick={() => void choosePalette(item.id)} className={`rounded-2xl border p-3 text-left ${palette === item.id ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200'}`}><span className="flex h-7 overflow-hidden rounded-lg">{item.colors.map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}</span><span className="mt-2 block text-xs font-black">{item.name}</span></button>)}
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">3. Completa tu perfil</p>
              <h2 className="mt-1 text-xl font-black">Edita cada bloque</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Los bloques especializados siguen separados para que puedas editarlos con comodidad sin perder la vista previa como referencia.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {sectionLinks.map((item) => <button key={item.to} type="button" onClick={() => navigate(item.to)} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-cyan-200 hover:bg-cyan-50/40"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-lg font-black text-cyan-700 shadow-sm">{item.icon}</span><span><span className="block text-sm font-black text-slate-900">{item.title}</span><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{item.text}</span></span></button>)}
              </div>
            </section>
          </div>

          <aside className={`${mobileMode === 'edit' ? 'hidden' : 'block'} lg:sticky lg:top-5 lg:block`}>
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Vista previa en vivo</p><p className="mt-1 text-sm font-bold text-slate-700">Así lo verá tu cliente</p></div>
                <button type="button" onClick={() => void saveAndRefreshPreview()} disabled={saving} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar y actualizar'}</button>
              </div>
              {slug ? (
                <div className="mx-auto overflow-hidden rounded-[24px] border border-slate-200 bg-[#eef3f8]">
                  <iframe key={previewVersion} src={previewUrl} title="Vista previa del perfil" className="h-[760px] w-full bg-white" />
                </div>
              ) : (
                <div className="grid h-[520px] place-items-center rounded-[24px] bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">Reserva tu identificador para ver la vista previa.</div>
              )}
              {slug && <a href={`${webUrl}/${encodeURIComponent(slug)}?preview=1`} target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white">Abrir perfil completo</a>}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}