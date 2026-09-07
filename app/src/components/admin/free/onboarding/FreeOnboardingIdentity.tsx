import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut, apiUpload } from '../../../../lib/api'
import ImageCropModal from '../../ImageCropModal'
import { FreeBackButton } from '../FreePanelUi'

export default function FreeOnboardingIdentity() {
  const navigate = useNavigate()
  const editingFromPanel = new URLSearchParams(window.location.search).get('from') === 'panel'
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [bio, setBio] = useState('')
  const [templateData, setTemplateData] = useState<Record<string, any>>({})
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [teamMember, setTeamMember] = useState(false)
  const [teamPermissions, setTeamPermissions] = useState<string[]>([])
  const [masterName, setMasterName] = useState('')

  useEffect(() => {
    Promise.all([
      apiGet('/me'),
      apiGet('/me/team/context').catch(() => ({ ok: false })),
    ]).then(([json, teamJson]: any[]) => {
      if (json?.ok && json.data) {
        const d = json.data
        const currentTemplateData = d.templateData && typeof d.templateData === 'object' ? d.templateData : {}
        setName(d.name || '')
        setRole(currentTemplateData.role || currentTemplateData.title || '')
        setBio(d.bio || '')
        setTemplateData(currentTemplateData)
        setAvatarUrl(d.avatar_url || '')
        setProfileId(d.profile_id || null)
      }
      if (teamJson?.ok && teamJson.data?.role === 'member') {
        setTeamMember(true)
        setTeamPermissions(teamJson.data?.member?.permissions || [])
        setMasterName(String(teamJson.data?.member?.master_name || 'perfil master'))
      }
    }).finally(() => setLoading(false))
  }, [])

  const canEditPhoto = !teamMember || teamPermissions.includes('photo')

  const chooseAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file || !profileId || !canEditPhoto) return
    setCropFile(file)
  }

  const uploadAvatar = async (blob: Blob) => {
    if (!canEditPhoto) return
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
      setError('Completa tu nombre y tu cargo.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const nextTemplate = { ...templateData, role: role.trim(), free_identity_confirmed: true }
      const body: Record<string, unknown> = { name: name.trim(), template_data: nextTemplate }
      if (!teamMember) body.bio = bio.trim()
      if (canEditPhoto && avatarUrl.trim()) body.avatar_url = avatarUrl.trim()
      const result: any = await apiPut('/me/profile', body)
      if (result.ok) navigate(teamMember || editingFromPanel ? '/admin/free' : '/admin/free/onboarding/contact', { replace: true })
      else setError(result.error || 'No pudimos guardar tus datos.')
    } catch {
      setError('No pudimos conectar. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  return <>
    {cropFile && <ImageCropModal file={cropFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setCropFile(null)} />}
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-5 font-['Inter'] text-slate-950 sm:px-5">
      <section className="mx-auto w-full max-w-[430px] py-1">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">{teamMember ? 'Completa tu perfil Team' : editingFromPanel ? 'Edita tu presentación' : 'Tu identidad'}</h1>
        <p className="mt-3 text-base font-medium leading-7 text-slate-700">{teamMember ? `Nombre y cargo son esenciales. Las demás opciones dependen de lo autorizado por ${masterName}.` : 'Actualiza tu foto, nombre, cargo y descripción.'}</p>

        {teamMember && <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">Amarillo: editable · Gris: administrado por Team.</div>}

        <form onSubmit={handleSubmit} className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <div className={`flex items-center gap-4 rounded-2xl p-3 ${teamMember && !canEditPhoto ? 'bg-slate-100' : 'bg-amber-50/50'}`}>
            <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">👤</div>}</div>
            <div className="flex-1">
              <p className="text-sm font-bold">Foto de perfil</p>
              {canEditPhoto ? <><button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || !profileId} className="mt-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold">{uploading ? 'Subiendo…' : avatarUrl ? 'Cambiar foto' : 'Subir foto'}</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseAvatar} /></> : <p className="mt-1 text-xs font-semibold text-slate-400">Administrada por el Team</p>}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block rounded-2xl bg-amber-50/60 p-3"><span className="text-sm font-bold">Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Tu nombre" className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3.5 text-base font-semibold outline-none focus:border-cyan-400" /></label>
            <label className="block rounded-2xl bg-amber-50/60 p-3"><span className="text-sm font-bold">Cargo</span><input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="Ej. Asesor de ventas" className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3.5 text-base font-semibold outline-none focus:border-cyan-400" /></label>
            <label className={`block rounded-2xl p-3 ${teamMember ? 'bg-slate-100' : 'bg-white'}`}><span className="text-sm font-bold">Sobre mí</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} disabled={teamMember} maxLength={300} rows={4} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base outline-none disabled:text-slate-400" />{teamMember && <span className="mt-1 block text-xs font-semibold text-slate-400">Información heredada del perfil master</span>}</label>
          </div>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
          <button type="submit" disabled={saving || uploading} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </form>
      </section>
    </main>
  </>
}
