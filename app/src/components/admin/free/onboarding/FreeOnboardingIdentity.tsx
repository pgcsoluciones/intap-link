import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut, apiUpload } from '../../../../lib/api'
import ImageCropModal from '../../ImageCropModal'
import { FreeBackButton, FreeUpgradeCard } from '../FreePanelUi'

const ABOUT_TITLES = ['Sobre mí', 'Quién soy', 'Conóceme'] as const

export default function FreeOnboardingIdentity() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [bio, setBio] = useState('')
  const [templateData, setTemplateData] = useState<Record<string, unknown>>({})
  const [aboutTitle, setAboutTitle] = useState<(typeof ABOUT_TITLES)[number]>('Sobre mí')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [cropFile, setCropFile] = useState<File | null>(null)

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
      setProfileId(d.profile_id || null)
    }).finally(() => setLoading(false))
  }, [])

  const chooseAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profileId) return
    if (fileRef.current) fileRef.current.value = ''
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !role.trim()) {
      setError('Completa tu nombre y a qué te dedicas.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        bio: bio.trim(),
        template_data: { ...templateData, role: role.trim(), about_section_title: aboutTitle },
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
      {cropFile && <ImageCropModal file={cropFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setCropFile(null)} />}
      <main className="min-h-screen bg-[#f7f9fc] px-5 py-5 font-['Inter'] text-slate-950">
        <section className="mx-auto w-full max-w-[430px] py-1">
          <FreeBackButton onClick={() => navigate('/admin/free')} />
          <div className="mb-8 flex gap-2" aria-label="Paso 3 de 4">
            {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}
          </div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-600">Paso 3 de 4</p>
          <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">Tu identidad</h1>
          <p className="mt-2 text-[15px] leading-6 text-slate-500">Agrega lo esencial para que te encuentren y sepan quién eres.</p>

          <form onSubmit={handleSubmit} className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">👤</div>}</div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Foto de perfil</p>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || !profileId} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40">{uploading ? 'Subiendo…' : 'Subir foto'}</button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseAvatar} />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Nombre o marca</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Tu nombre o marca" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
              <label className="block"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">A qué te dedicas</span><input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="Ej. Asesor inmobiliario" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
              <label className="block"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Descripción breve</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={4} placeholder="Cuéntales brevemente lo que haces…" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /><span className="mt-1 block text-right text-[11px] text-slate-400">{bio.length}/300</span></label>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="text-xs font-black text-slate-700">Título visible de esta sección</p>
              <div className="mt-3 grid grid-cols-3 gap-2">{ABOUT_TITLES.map((option) => <button key={option} type="button" onClick={() => setAboutTitle(option)} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${aboutTitle === option ? 'bg-cyan-600 text-white' : 'bg-slate-50 text-slate-600'}`}>{option}</button>)}</div>
            </div>

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
            <button type="submit" disabled={saving} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35">{saving ? 'Guardando…' : 'Continuar'}</button>
          </form>
          <div className="mt-5"><FreeUpgradeCard compact /></div>
        </section>
      </main>
    </>
  )
}
