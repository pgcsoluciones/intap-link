import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiUpload } from '../../../lib/api'
import ImageCropModal from '../ImageCropModal'
import { FreeBackButton } from './FreePanelUi'

const TEAM_CODE_KEY = 'kawvo_team_join_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

const PERMISSION_LABELS: Record<string, string> = {
  name: 'Nombre', role: 'Cargo', photo: 'Foto', phone: 'Teléfono', email: 'Correo', whatsapp: 'WhatsApp',
  portfolio: 'Portafolio', services: 'Servicios', links: 'Enlaces', quick_actions: 'Botones directos', location: 'Ubicación', design: 'Diseño',
}

function clearTeamActivationContext() {
  sessionStorage.removeItem(TEAM_CODE_KEY)
  localStorage.removeItem(TEAM_CODE_KEY)
  sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
  localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
  sessionStorage.removeItem('kawvo_team_resume_url')
  localStorage.removeItem('kawvo_team_resume_url')
}

export default function FreeTeamAssign() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const params = new URLSearchParams(window.location.search)
  const publicCode = String(params.get('public_code') || sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || '').trim().toUpperCase()
  const teamCode = String(params.get('team_code') || sessionStorage.getItem(TEAM_CODE_KEY) || localStorage.getItem(TEAM_CODE_KEY) || '').trim().toUpperCase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [error, setError] = useState('')
  const [masterRequired, setMasterRequired] = useState(false)
  const [context, setContext] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [accessRole, setAccessRole] = useState<'member' | 'editor' | 'subadmin'>('member')
  const [publishNow, setPublishNow] = useState(true)

  const allowed = useMemo(() => new Set<string>(Array.isArray(context?.permissions) ? context.permissions.map(String) : []), [context])
  const canPhoto = allowed.has('photo')
  const canPhone = allowed.has('phone')
  const canWhatsapp = allowed.has('whatsapp')
  const canEmail = allowed.has('email')
  const permissionSummary = useMemo(() => {
    const ordered = ['name','role','photo','phone','email','whatsapp','portfolio','services','links','quick_actions','location','design']
    return ordered.filter((key) => allowed.has(key) || key === 'name' || key === 'role').map((key) => PERMISSION_LABELS[key]).filter(Boolean)
  }, [allowed])

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  useEffect(() => {
    if (!publicCode || !teamCode) {
      clearTeamActivationContext()
      setError('No encontramos el dispositivo o el código Team que estabas preparando.')
      setLoading(false)
      return
    }
    sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, publicCode)
    localStorage.setItem(SCAN_PUBLIC_CODE_KEY, publicCode)
    sessionStorage.setItem(TEAM_CODE_KEY, teamCode)
    localStorage.setItem(TEAM_CODE_KEY, teamCode)

    apiGet(`/me/team/corporate/prepare?public_code=${encodeURIComponent(publicCode)}&team_code=${encodeURIComponent(teamCode)}`)
      .then((json: any) => {
        if (!json?.ok) {
          const message = json?.error || 'No pudimos preparar este dispositivo.'
          const requiresMaster = json?.code === 'TEAM_MASTER_REQUIRED' || message.includes('Administrador Master')
          setError(message)
          setMasterRequired(requiresMaster)
          if (!requiresMaster) clearTeamActivationContext()
        } else {
          setContext(json.data)
          setMasterRequired(false)
        }
      })
      .catch(() => setError('No pudimos validar tu acceso al Team.'))
      .finally(() => setLoading(false))
  }, [publicCode, teamCode])

  const choosePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setCropFile(file)
  }

  const saveCroppedPhoto = async (blob: Blob) => {
    setCropFile(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(blob)
    setPhotoPreview(URL.createObjectURL(blob))
  }

  const cancelPreparation = () => {
    clearTeamActivationContext()
    navigate('/admin/free/account')
  }

  const accessAsCorrectMaster = async () => {
    if (switchingAccount || !publicCode || !teamCode) return
    setSwitchingAccount(true)
    setError('')
    sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, publicCode)
    localStorage.setItem(SCAN_PUBLIC_CODE_KEY, publicCode)
    sessionStorage.setItem(TEAM_CODE_KEY, teamCode)
    localStorage.setItem(TEAM_CODE_KEY, teamCode)
    await apiPost('/auth/logout', {}).catch(() => undefined)
    window.location.assign(`/admin/login?activation=team&public_code=${encodeURIComponent(publicCode)}&team_code=${encodeURIComponent(teamCode)}`)
  }

  const submit = async () => {
    if (saving) return
    if (!name.trim() || !roleTitle.trim()) { setError('Completa nombre y cargo del colaborador.'); return }
    setSaving(true); setError('')
    const payload: any = {
      public_code: publicCode,
      team_code: teamCode,
      name: name.trim(),
      role_title: roleTitle.trim(),
      access_role: accessRole,
      publish_now: publishNow,
    }
    if (canPhone) payload.phone = phone.trim()
    if (canWhatsapp) payload.whatsapp = whatsapp.trim()
    if (canEmail) payload.email = email.trim()

    const json: any = await apiPost('/me/team/corporate/assign', payload).catch(() => ({ ok: false }))
    if (!json?.ok) {
      setSaving(false)
      setError(json?.error || 'No pudimos asignar el dispositivo.')
      return
    }

    let photoWarning = ''
    if (canPhoto && photo && json.data?.member_id) {
      const form = new FormData()
      form.append('file', photo, 'avatar.jpg')
      const uploaded: any = await apiUpload(`/me/team/members/${encodeURIComponent(String(json.data.member_id))}/avatar`, form).catch(() => ({ ok: false }))
      if (!uploaded?.ok) photoWarning = uploaded?.error || 'El perfil fue creado, pero no pudimos guardar la foto. Puedes agregarla luego desde Editar perfil.'
    }
    clearTeamActivationContext()
    setSaving(false)
    setResult({ ...json.data, photo_warning: photoWarning })
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  if (result) return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[520px] rounded-[28px] border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">DISPOSITIVO TEAM PREPARADO</p>
        <h1 className="mt-2 text-2xl font-black">{name}</h1>
        <p className="mt-1 text-sm text-slate-500">{roleTitle}</p>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p><strong>Team:</strong> {result.team_name}</p>
          <p><strong>Estado:</strong> {result.status === 'published' ? 'Publicado' : 'Perfil pendiente'}</p>
          <p><strong>Rol:</strong> {result.access_role === 'member' ? 'Miembro' : result.access_role === 'editor' ? 'Editor' : 'Subadministrador'}</p>
        </div>
        {result.photo_warning && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">{result.photo_warning}</p>}
        {result.temporary_password && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Contraseña temporal</p><p className="mt-2 font-mono text-lg font-black text-slate-950">{result.temporary_password}</p><p className="mt-2 text-xs leading-5 text-amber-800">Entrégala únicamente al colaborador con rol. Deberá cambiarla en su primer acceso.</p></div>}
        <button type="button" onClick={() => navigate('/admin/free/team')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Volver al Team</button>
      </section>
    </main>
  )

  return <>
    {cropFile && <ImageCropModal file={cropFile} aspectRatio={1} outputWidth={400} onSave={saveCroppedPhoto} onCancel={() => setCropFile(null)} />}
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[620px] px-5 pb-24 pt-5">
        <FreeBackButton onClick={cancelPreparation} />
        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">KAWVO LINK · TEAM</p>
        <h1 className="mt-1 text-3xl font-black">Preparar dispositivo</h1>
        {context && <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black uppercase text-cyan-700">Team confirmado</p><p className="mt-1 text-lg font-black">{context.team_name}</p></div>}
        {error && <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"><p>{error}</p>{masterRequired && <button type="button" onClick={() => void accessAsCorrectMaster()} disabled={switchingAccount} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{switchingAccount ? 'Cambiando cuenta…' : 'Acceder con la cuenta Master correcta'}</button>}</div>}

        {context && <>
          <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Datos del colaborador</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Completa los datos autorizados para este miembro.</p>
            {permissionSummary.length > 0 && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-600">Puedes editar: {permissionSummary.join(' · ')}</p>}
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-black text-slate-600">Nombre *<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>
              <label className="text-xs font-black text-slate-600">Cargo *<input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>
              {canPhoto && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-600">Foto</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-white">{photoPreview ? <img src={photoPreview} alt="Vista previa" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl text-slate-300">👤</div>}</div>
                  <div className="flex-1"><button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-800">{photo ? 'Cambiar foto' : 'Subir y ajustar foto'}</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="hidden" /><p className="mt-1 text-[11px] leading-4 text-slate-400">Podrás mover, ampliar y recortar antes de guardar.</p></div>
                </div>
              </div>}
              {canPhone && <label className="text-xs font-black text-slate-600">Teléfono<input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>}
              {canWhatsapp && <label className="text-xs font-black text-slate-600">WhatsApp<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>}
              {canEmail && <label className="text-xs font-black text-slate-600">Correo de contacto<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label>}
            </div>
          </section>

          <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Rol de acceso</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Elige qué nivel de acceso tendrá este colaborador.</p>
            <div className="mt-4 grid gap-2">
              {([['member','Miembro','Sin acceso al panel.'],['editor','Editor','Puede editar campos habilitados de miembros.'],['subadmin','Subadministrador','Puede editar y activar/desactivar miembros.']] as const).map(([value,label,detail]) => <button key={value} type="button" onClick={() => setAccessRole(value)} className={`rounded-2xl border p-4 text-left ${accessRole === value ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white'}`}><span className="block text-sm font-black">{label}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></button>)}
            </div>
            <label className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold"><span>Publicar al terminar</span><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /></label>
          </section>

          <button type="button" onClick={() => void submit()} disabled={saving || !context} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{saving ? 'Preparando…' : 'Preparar dispositivo'}</button>
        </>}
      </div>
    </main>
  </>
}
