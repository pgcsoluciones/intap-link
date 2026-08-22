import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch, apiPut, apiUpload } from '../../../../lib/api'
import ImageCropModal from '../../ImageCropModal'
import { FreeBackButton, FreeUpgradeCard } from '../FreePanelUi'

const ABOUT_TITLES = ['Sobre mí', 'Quién soy', 'Conóceme'] as const
type LayoutId = 'impacto' | 'personal' | 'esencial'
type CropTarget = 'avatar' | 'hero'

export default function FreeOnboardingIdentity() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const heroFileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [bio, setBio] = useState('')
  const [templateData, setTemplateData] = useState<Record<string, unknown>>({})
  const [aboutTitle, setAboutTitle] = useState<(typeof ABOUT_TITLES)[number]>('Sobre mí')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [heroUrl, setHeroUrl] = useState('')
  const [pendingHeroBlob, setPendingHeroBlob] = useState<Blob | null>(null)
  const [pendingHeroPreview, setPendingHeroPreview] = useState('')
  const [layoutId, setLayoutId] = useState<LayoutId>('esencial')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [heroSaved, setHeroSaved] = useState(false)
  const [error, setError] = useState('')
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropTarget, setCropTarget] = useState<CropTarget>('avatar')

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (!json.ok || !json.data) return
      const d = json.data
      const currentTemplateData = d.templateData && typeof d.templateData === 'object' ? d.templateData : {}
      setName(d.name || '')
      setRole(currentTemplateData.role || currentTemplateData.title || '')
      setBio(d.bio || '')
      setTemplateData(currentTemplateData)
      const saved = String(currentTemplateData.about_section_title || 'Sobre mí') as (typeof ABOUT_TITLES)[number]
      setAboutTitle(ABOUT_TITLES.includes(saved) ? saved : 'Sobre mí')
      setAvatarUrl(d.avatar_url || '')
      setHeroUrl(d.hero_url || currentTemplateData.hero_url || '')
      if (d.layout_id === 'impacto' || d.layout_id === 'personal' || d.layout_id === 'esencial') setLayoutId(d.layout_id)
      setProfileId(d.profile_id || null)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => () => {
    if (pendingHeroPreview) URL.revokeObjectURL(pendingHeroPreview)
  }, [pendingHeroPreview])

  const chooseAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profileId) return
    if (fileRef.current) fileRef.current.value = ''
    setCropTarget('avatar')
    setCropFile(file)
  }

  const chooseHero = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profileId) return
    if (heroFileRef.current) heroFileRef.current.value = ''
    setHeroSaved(false)
    setCropTarget('hero')
    setCropFile(file)
  }

  const uploadAvatar = async (blob: Blob) => {
    setCropFile(null)
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', blob, 'avatar.jpg')
      const result: any = await apiUpload('/me/profile/avatar', form)
      if (result.ok && result.avatar_url) setAvatarUrl(result.avatar_url)
      else setError(result.error || 'No pudimos subir la foto.')
    } catch {
      setError('No pudimos subir la foto.')
    } finally {
      setUploading(false)
    }
  }

  const prepareHero = async (blob: Blob) => {
    setCropFile(null)
    setError('')
    setHeroSaved(false)
    setPendingHeroBlob(blob)
    setPendingHeroPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(blob)
    })
  }

  const saveHero = async () => {
    if (!pendingHeroBlob || !profileId || uploading) return
    setUploading(true)
    setError('')
    setHeroSaved(false)
    try {
      const form = new FormData()
      form.append('file', pendingHeroBlob, 'hero.jpg')

      // Reutilizamos el uploader propietario para almacenar el asset y, acto seguido,
      // guardamos la URL en el endpoint de apariencia, que es el que persiste hero_url.
      const uploadResult: any = await apiUpload('/me/profile/avatar', form)
      if (!uploadResult.ok || !uploadResult.avatar_url) {
        setError(uploadResult.error || 'No pudimos subir la imagen de portada.')
        return
      }

      const uploadedHeroUrl = String(uploadResult.avatar_url)
      const heroResult: any = await apiPatch('/me/profile/free-appearance', {
        hero_url: uploadedHeroUrl,
      })

      // El uploader anterior actualiza temporalmente avatar_url. Lo restauramos para
      // mantener foto de perfil y portada como imágenes completamente independientes.
      const restoreAvatarResult: any = await apiPut('/me/profile', {
        avatar_url: avatarUrl,
      })

      if (!heroResult.ok) {
        setError(heroResult.error || 'No pudimos guardar la imagen de portada.')
        return
      }
      if (!restoreAvatarResult.ok) {
        setError(restoreAvatarResult.error || 'La portada se guardó, pero no pudimos restaurar la foto de perfil.')
        return
      }

      setHeroUrl(uploadedHeroUrl)
      setPendingHeroBlob(null)
      setPendingHeroPreview((current) => {
        if (current) URL.revokeObjectURL(current)
        return ''
      })
      setHeroSaved(true)
    } catch {
      await apiPut('/me/profile', { avatar_url: avatarUrl }).catch(() => undefined)
      setError('No pudimos guardar la imagen de portada.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !role.trim()) {
      setError('Completa tu nombre y a qué te dedicas.')
      return
    }
    if (layoutId === 'impacto' && pendingHeroBlob) {
      setError('Guarda la nueva portada antes de continuar.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        bio: bio.trim(),
        template_data: { ...templateData, role: role.trim(), about_section_title: aboutTitle, free_identity_confirmed: true },
      }
      if (avatarUrl.trim()) body.avatar_url = avatarUrl.trim()
      const result: any = await apiPut('/me/profile', body)
      if (result.ok) navigate('/admin/free/onboarding/contact')
      else setError(result.error || 'No pudimos guardar tus datos.')
    } catch {
      setError('No pudimos conectar. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  return (
    <>
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={cropTarget === 'hero' ? 16 / 9 : 1}
          outputWidth={cropTarget === 'hero' ? 1200 : 400}
          onSave={cropTarget === 'hero' ? prepareHero : uploadAvatar}
          onCancel={() => setCropFile(null)}
        />
      )}
      <main className="min-h-screen bg-[#f7f9fc] px-4 py-5 font-['Inter'] text-slate-950 sm:px-5">
        <section className="mx-auto w-full max-w-[430px] py-1">
          <FreeBackButton onClick={() => navigate('/admin/free')} />
          <div className="mb-8 flex gap-2" aria-label="Paso 3 de 4">
            {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}
          </div>
          <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700">Paso 3 de 4</p>
          <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">Tu identidad</h1>
          <p className="mt-3 text-base font-medium leading-7 text-slate-700">Agrega lo esencial para que te encuentren y sepan quién eres.</p>

          <form onSubmit={handleSubmit} className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">👤</div>}</div>
              <div className="flex-1">
                <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-700">Foto de perfil</p>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || !profileId} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40">{uploading && cropTarget === 'avatar' ? 'Subiendo…' : avatarUrl ? 'Cambiar foto' : 'Subir foto'}</button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseAvatar} />
              </div>
            </div>

            {layoutId === 'impacto' && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-700">Imagen de portada / Hero</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Esta imagen aparece detrás de tu identidad en la plantilla Impacto.</p>
                  </div>
                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-700">Impacto</span>
                </div>
                <div className="mt-3 aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {(pendingHeroPreview || heroUrl) ? <img src={pendingHeroPreview || heroUrl} alt="Vista previa de portada" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400">Agrega una imagen de portada para completar el diseño Impacto.</div>}
                </div>
                <button type="button" onClick={() => heroFileRef.current?.click()} disabled={uploading || !profileId} className="mt-3 w-full rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2.5 text-sm font-black text-cyan-700 hover:bg-cyan-100 disabled:opacity-40">{pendingHeroBlob ? 'Elegir otra imagen' : heroUrl ? 'Cambiar imagen de portada' : 'Subir imagen de portada'}</button>
                <input ref={heroFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseHero} />

                {pendingHeroBlob && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold leading-5 text-amber-800">La nueva portada está lista para guardar.</p>
                    <button type="button" onClick={() => void saveHero()} disabled={uploading} className="mt-2 w-full rounded-xl bg-slate-950 px-3.5 py-3 text-sm font-black text-white disabled:opacity-40">{uploading ? 'Guardando portada…' : 'Guardar portada'}</button>
                  </div>
                )}

                {heroSaved && !pendingHeroBlob && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">✓ Portada guardada correctamente.</p>}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <label className="block"><span className="text-sm font-bold uppercase tracking-[0.08em] text-slate-700">Nombre o marca</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Tu nombre o marca" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
              <label className="block"><span className="text-sm font-bold uppercase tracking-[0.08em] text-slate-700">A qué te dedicas (Puesto / Cargo)</span><input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="Ej. Asesor inmobiliario" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
              <label className="block"><span className="text-sm font-bold uppercase tracking-[0.08em] text-slate-700">Descripción breve</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={4} placeholder="Cuéntales brevemente lo que haces…" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /><span className="mt-1 block text-right text-sm text-slate-600">{bio.length}/300</span></label>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="text-sm font-black text-slate-800">Título visible de esta sección</p>
              <div className="mt-3 grid grid-cols-3 gap-2">{ABOUT_TITLES.map((option) => <button key={option} type="button" onClick={() => setAboutTitle(option)} className={`rounded-xl px-2 py-3 text-sm font-black ${aboutTitle === option ? 'bg-cyan-600 text-white' : 'bg-slate-50 text-slate-700'}`}>{option}</button>)}</div>
            </div>

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700">{error}</p>}
            <button type="submit" disabled={saving || uploading} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35">{saving ? 'Guardando…' : 'Continuar'}</button>
          </form>
          <div className="mt-5"><FreeUpgradeCard compact /></div>
        </section>
      </main>
    </>
  )
}
