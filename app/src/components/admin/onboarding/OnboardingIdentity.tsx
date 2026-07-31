import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut, apiUpload } from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'

export default function OnboardingIdentity() {
  const navigate   = useNavigate()
  const fileRef    = useRef<HTMLInputElement>(null)
  const [name, setName]           = useState('')
  const [role, setRole]           = useState('')
  const [bio, setBio]             = useState('')
  const [templateData, setTemplateData] =
    useState<Record<string, unknown>>({})
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [cropFile, setCropFile]   = useState<File | null>(null)

  const isOnboarding = window.location.pathname.includes('onboarding')

  // Load existing profile data
  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (json.ok && json.data) {
        const d = json.data

        const currentTemplateData =
          d.templateData &&
          typeof d.templateData === 'object'
            ? d.templateData
            : {}

        setName(d.name || '')
        setRole(
          currentTemplateData.role ||
          currentTemplateData.title ||
          '',
        )
        setBio(d.bio || '')
        setTemplateData(currentTemplateData)
        setAvatarUrl(d.avatar_url || '')
        setProfileId(d.profile_id || null)
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profileId) return
    if (fileRef.current) fileRef.current.value = ''
    setCropFile(file)
  }

  const uploadCroppedAvatar = async (blob: Blob) => {
    setCropFile(null)
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', blob, 'avatar.jpg')
      const res: any = await apiUpload('/me/profile/avatar', fd)
      if (res.ok && res.avatar_url) {
        setAvatarUrl(res.avatar_url)
      } else {
        setError(res.error || 'Error al subir imagen')
      }
    } catch {
      setError('Error de conexión al subir imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim() || !role.trim()) {
      setError(
        'Completa tu nombre y tu cargo, profesión o función.',
      )
      return
    }

    setSaving(true)

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        bio: bio.trim(),
        template_data: {
          ...templateData,
          role: role.trim(),
        },
      }

      if (avatarUrl.trim()) {
        body.avatar_url = avatarUrl.trim()
      }

      const json: any = await apiPut('/me/profile', body)
      if (json.ok) {
        navigate(isOnboarding ? '/admin/onboarding/contact' : '/admin')
      } else {
        setError(json.error || 'Error al guardar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  return (
    <>
    {cropFile && (
      <ImageCropModal
        file={cropFile}
        aspectRatio={1}
        outputWidth={400}
        onSave={uploadCroppedAvatar}
        onCancel={() => setCropFile(null)}
      />
    )}
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-sm">
        {isOnboarding && (
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={`h-1 flex-1 rounded-full ${step <= 3 ? 'bg-intap-mint' : 'bg-slate-200'}`} />
            ))}
          </div>
        )}

        <div className="mb-6">
          {isOnboarding && <p className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-2">Paso 3 de 4</p>}
          <h1 className="text-2xl font-black mb-1">Tu identidad</h1>
          <p className="text-sm text-slate-400">Cómo apareces en tu perfil público</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">

          {/* Avatar preview + upload */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Foto de perfil</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-intap-mint/10 border border-intap-mint/20 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setAvatarUrl('')} />
                  : '👤'}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || !profileId}
                  className="text-xs bg-intap-mint/10 border border-intap-mint/20 text-intap-mint px-3 py-2 rounded-xl hover:bg-intap-mint/20 transition-colors disabled:opacity-40"
                >
                  {uploading ? 'Subiendo…' : 'Subir foto'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                {!profileId && (
                  <p className="text-[10px] text-slate-500">Completa el paso anterior primero</p>
                )}
              </div>
            </div>
            {/* Also allow URL input as fallback */}
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="O pega una URL de imagen (https://...)"
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-intap-mint/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre o marca"
              maxLength={80}
              required
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-intap-mint/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Cargo, profesión o función
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ej: Asesor inmobiliario"
              maxLength={80}
              required
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-intap-mint/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Descripción corta de lo que haces…"
              maxLength={300}
              rows={3}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-intap-mint/50 transition-colors resize-none"
            />
            <p className="text-[10px] text-slate-600 text-right">{bio.length}/300</p>
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Guardando…' : isOnboarding ? 'Continuar →' : 'Guardar cambios'}
          </button>

          {isOnboarding && (
            <button
              type="button"
              onClick={() => navigate('/admin/onboarding/contact')}
              className="text-xs text-slate-500 hover:text-slate-900 text-center transition-colors"
            >
              Completar después — el perfil quedará como borrador
            </button>
          )}
        </form>
      </div>
    </div>
    </>
  )
}
