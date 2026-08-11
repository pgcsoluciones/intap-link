import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiPatch, apiPost } from '../../lib/api'

type Artifact = {
  id: string
  public_code: string
  product_type: string
  status: string
  profile_id: string | null
  profile_slug: string | null
  profile_name: string | null
  public_url: string
}

const CODE_KEY = 'intap_activation_code'

function ProductLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Brazalete NFC',
    keychain: 'Llavero NFC', stand: 'Stand NFC', qr: 'Código QR', other: 'Producto INTAP',
  }
  return <>{labels[type] || labels.other}</>
}

export function ArtifactActivation() {
  const navigate = useNavigate()
  const [code, setCode] = useState(() => sessionStorage.getItem(CODE_KEY) || '')
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inspect = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setError('')
    setLoading(true)
    const result: any = await apiPost('/public/artifacts/activation/inspect', { activation_code: code })
      .catch(() => ({ ok: false, error: 'No se pudo validar el código.' }))
    setLoading(false)
    if (!result.ok) {
      setPreview(null)
      setError(result.error || 'Código inválido.')
      return
    }
    sessionStorage.setItem(CODE_KEY, code.trim().toUpperCase())
    setPreview(result.data)
  }

  const continueToAccount = async () => {
    const me: any = await apiGet('/me').catch(() => ({ ok: false }))
    if (me.ok) navigate('/admin/artifacts/activate')
    else navigate('/admin/login?activation=1')
  }

  return (
    <div className="min-h-screen bg-intap-dark text-white flex items-center justify-center px-4 font-['Inter']">
      <div className="w-full max-w-md">
        <Link to="/admin/login" className="text-xs text-slate-400 hover:text-white">← Ya tengo una cuenta</Link>
        <div className="mt-5 mb-7">
          <p className="text-xs uppercase tracking-[0.25em] text-intap-mint font-bold">INTAP LINK</p>
          <h1 className="text-3xl font-black mt-2">Activa tu producto</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">Usa el código privado que recibiste con tu tarjeta, ping, brazalete o QR.</p>
        </div>
        <form onSubmit={inspect} className="glass-card p-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-300">
            Código de activación
            <input value={code} onChange={event => setCode(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="ABCD2345…" className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white tracking-[0.16em] uppercase outline-none focus:border-intap-mint/60" />
          </label>
          {error && <p className="rounded-lg bg-red-400/10 border border-red-400/20 px-3 py-2 text-sm text-red-300">{error}</p>}
          {preview && <div className="rounded-xl bg-intap-mint/10 border border-intap-mint/20 p-4 text-sm"><p className="text-intap-mint font-bold">Código válido</p><p className="text-slate-200 mt-1"><ProductLabel type={preview.product_type} /></p><p className="text-xs text-slate-400 mt-1">Producto listo para asociarse a tu cuenta.</p></div>}
          {!preview ? <button disabled={loading || !code.trim()} className="w-full rounded-xl bg-intap-blue py-3 font-bold disabled:opacity-50">{loading ? 'Validando…' : 'Validar código'}</button> : <button type="button" onClick={continueToAccount} className="w-full rounded-xl bg-intap-blue py-3 font-bold">Continuar con mi cuenta →</button>}
        </form>
      </div>
    </div>
  )
}

export function ArtifactActivationAuthenticated() {
  const navigate = useNavigate()
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const storedCode = sessionStorage.getItem(CODE_KEY)
    if (!storedCode) { navigate('/activate', { replace: true }); return }
    Promise.all([apiGet('/me'), apiPost('/me/artifacts/activate', { activation_code: storedCode })])
      .then(([me, result]: any[]) => {
        if (!result.ok) { setError(result.error || 'No se pudo activar el producto.'); return }
        setArtifact(result.data)
        sessionStorage.removeItem(CODE_KEY)
        if (me.ok && me.data?.profile_id && result.data?.profile_id == null) {
          return apiPatch(`/me/artifacts/${result.data.id}/profile`, { profile_id: me.data.profile_id }).then((linked: any) => { if (linked.ok) setArtifact(linked.data) })
        }
      })
      .catch(() => setError('No se pudo completar la activación.'))
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) return <CenteredMessage text="Activando tu producto…" />
  if (error) return <CenteredMessage text={error} action={<Link to="/activate" className="text-intap-mint">Volver a intentar</Link>} />
  if (!artifact) return null
  return <CenteredMessage text={`Producto activado: ${artifact.public_code}`} action={artifact.profile_slug ? <a href={artifact.public_url} className="text-intap-mint">Abrir mi enlace público →</a> : <Link to="/admin/onboarding/slug" className="text-intap-mint">Crear mi perfil para vincularlo →</Link>} />
}

export function ArtifactManager() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const refresh = () => Promise.all([apiGet('/me'), apiGet('/me/artifacts')]).then(([meResult, artifactsResult]: any[]) => { if (meResult.ok) setMe(meResult.data); if (artifactsResult.ok) setArtifacts(artifactsResult.data || []) }).finally(() => setLoading(false))
  useEffect(() => { refresh() }, [])
  const linkProfile = async (artifact: Artifact) => {
    if (!me?.profile_id) return
    const result: any = await apiPatch(`/me/artifacts/${artifact.id}/profile`, { profile_id: me.profile_id })
    setMessage(result.ok ? 'Perfil vinculado correctamente.' : (result.error || 'No se pudo vincular.'))
    if (result.ok) refresh()
  }
  return (
    <div className="min-h-screen bg-intap-dark text-white px-4 py-8 font-['Inter']"><div className="max-w-3xl mx-auto"><Link to="/admin" className="text-xs text-slate-400 hover:text-white">← Volver al dashboard</Link><div className="flex items-end justify-between gap-4 mt-5 mb-7"><div><p className="text-xs uppercase tracking-[0.25em] text-intap-mint font-bold">INTAP LINK</p><h1 className="text-3xl font-black mt-2">Mis productos físicos</h1></div><Link to="/activate" className="rounded-xl bg-intap-blue px-4 py-2 text-sm font-bold">Activar otro</Link></div>{message && <p className="mb-4 text-sm text-intap-mint">{message}</p>}{loading ? <p className="text-slate-400">Cargando…</p> : artifacts.length === 0 ? <div className="glass-card p-6 text-slate-400">Todavía no tienes productos activados.</div> : <div className="grid gap-4 sm:grid-cols-2">{artifacts.map(artifact => <div key={artifact.id} className="glass-card p-5"><p className="text-xs uppercase tracking-widest text-slate-500"><ProductLabel type={artifact.product_type} /></p><p className="font-mono text-lg mt-2">{artifact.public_code}</p><p className="text-sm text-slate-400 mt-2">{artifact.profile_slug ? `Vinculado a /${artifact.profile_slug}` : 'Sin perfil vinculado'}</p>{!artifact.profile_id && me?.profile_id && <button onClick={() => linkProfile(artifact)} className="mt-4 text-sm text-intap-mint font-bold">Vincular a mi perfil →</button>}{artifact.profile_slug && <a href={artifact.public_url} className="block mt-4 text-sm text-intap-mint font-bold">Abrir enlace público →</a>}</div>)}</div>}{!loading && !me?.profile_id && artifacts.length > 0 && <p className="mt-6 text-sm text-slate-400">Crea tu perfil para poder vincular tu producto: <Link to="/admin/onboarding/slug" className="text-intap-mint">comenzar onboarding</Link>.</p>}</div></div>
  )
}

function CenteredMessage({ text, action }: { text: string; action?: React.ReactNode }) {
  return <div className="min-h-screen bg-intap-dark text-white flex flex-col items-center justify-center px-4 text-center font-['Inter']"><p className="text-lg font-bold">{text}</p>{action && <div className="mt-4 text-sm">{action}</div>}</div>
}
