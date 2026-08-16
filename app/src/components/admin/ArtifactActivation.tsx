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

function ProductLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Brazalete NFC',
    keychain: 'Llavero NFC', stand: 'Stand NFC', qr: 'Código QR', other: 'Producto INTAP',
  }
  return <>{labels[type] || labels.other}</>
}

export function ArtifactActivation() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
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
    setCode('')
    setPreview(result.data)
  }

  const continueToAccount = async () => {
    const me: any = await apiGet('/me').catch(() => ({ ok: false }))
    if (me.ok) navigate('/admin/artifacts/activate')
    else navigate('/admin/login?activation=1')
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <Link to="/admin/login" className="mb-7 text-xs font-bold text-slate-500">← Volver</Link>

        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">INTAP LINK</p>
        <h1 className="mt-2 text-[30px] font-black leading-tight tracking-[-0.04em]">Activa tu producto</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Escribe el código que recibiste con tu producto INTAP. Solo necesitas hacerlo una vez.</p>

        <form onSubmit={inspect} className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
            Código de activación
            <input
              value={code}
              onChange={event => setCode(event.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD2345…"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black tracking-[0.14em] text-slate-900 uppercase outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}

          {preview && (
            <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm">
              <p className="font-black text-cyan-700">Código válido</p>
              <p className="mt-1 font-extrabold text-slate-900"><ProductLabel type={preview.product_type} /></p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Este producto está listo para vincularse con tu cuenta.</p>
            </div>
          )}

          {!preview ? (
            <button disabled={loading || !code.trim()} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-35">
              {loading ? 'Validando…' : 'Validar código'}
            </button>
          ) : (
            <button type="button" onClick={continueToAccount} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">
              Continuar con mi cuenta
            </button>
          )}
        </form>

        <div className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4 text-center">
          <p className="text-sm font-extrabold text-slate-900">¿Todavía no tienes código?</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">No necesitas un producto físico para comenzar. Puedes crear tu perfil Gratis ahora y activar tu producto después.</p>
          <Link to="/admin/login" className="mt-3 inline-flex text-xs font-black text-cyan-700">Crear o acceder a mi perfil →</Link>
        </div>
      </section>
    </main>
  )
}

export function ArtifactActivationAuthenticated() {
  const navigate = useNavigate()
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([apiGet('/me'), apiGet('/me/artifacts/activation/intent')])
      .then(async ([me, pending]: any[]) => {
        if (!pending.ok) { navigate('/activate', { replace: true }); return }
        if (!me.ok) { setError('No se pudo identificar tu cuenta.'); return }

        // El perfil se envía dentro del claim atómico. Antes se reclamaba con
        // profile_id=null y luego se hacía un PATCH separado; si ese PATCH
        // fallaba, el código quedaba usado y el producto activado pero sin destino.
        const profileId = me.data?.profile_id || null
        const result: any = await apiPost('/me/artifacts/activate', { profile_id: profileId })
        if (!result.ok) { setError(result.error || 'No se pudo activar el producto.'); return }
        setArtifact(result.data)
      })
      .catch(() => setError('No se pudo completar la activación.'))
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) return <CenteredMessage text="Activando tu producto…" />
  if (error) return <CenteredMessage text={error} action={<Link to="/activate" className="font-black text-cyan-700">Volver a intentar</Link>} />
  if (!artifact) return null
  return <CenteredMessage text={`Producto activado: ${artifact.public_code}`} action={artifact.profile_slug ? <a href={artifact.public_url} className="font-black text-cyan-700">Abrir mi enlace público →</a> : <Link to="/admin/free/onboarding/slug" className="font-black text-cyan-700">Crear mi perfil para vincularlo →</Link>} />
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
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-3xl">
        <Link to="/admin" className="text-xs font-bold text-slate-500">← Volver al panel</Link>
        <div className="mt-5 mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">INTAP LINK</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Mis productos físicos</h1>
            <p className="mt-2 text-sm text-slate-500">Aquí aparecerán los productos INTAP que actives.</p>
          </div>
          <Link to="/activate" className="shrink-0 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white">Activar producto</Link>
        </div>
        {message && <p className="mb-4 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-700">{message}</p>}
        {loading ? (
          <p className="text-slate-400">Cargando…</p>
        ) : artifacts.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
            <p className="text-base font-black text-slate-900">Todavía no tienes productos activados</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Cuando recibas un producto INTAP con su código, podrás activarlo aquí. Tu perfil Gratis funciona aunque todavía no tengas uno.</p>
            <Link to="/admin/free" className="mt-4 inline-flex text-xs font-black text-cyan-700">Volver a mi perfil →</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {artifacts.map(artifact => (
              <div key={artifact.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400"><ProductLabel type={artifact.product_type} /></p>
                <p className="mt-2 font-mono text-lg font-bold text-slate-900">{artifact.public_code}</p>
                <p className="mt-2 text-sm text-slate-500">{artifact.profile_slug ? `Vinculado a /${artifact.profile_slug}` : 'Sin perfil vinculado'}</p>
                {!artifact.profile_id && me?.profile_id && <button onClick={() => linkProfile(artifact)} className="mt-4 text-sm font-black text-cyan-700">Vincular a mi perfil →</button>}
                {artifact.profile_slug && <a href={artifact.public_url} className="mt-4 block text-sm font-black text-cyan-700">Abrir enlace público →</a>}
              </div>
            ))}
          </div>
        )}
        {!loading && !me?.profile_id && artifacts.length > 0 && <p className="mt-6 text-sm text-slate-500">Crea tu perfil para vincular tu producto: <Link to="/admin/free/onboarding/slug" className="font-black text-cyan-700">comenzar</Link>.</p>}
      </section>
    </main>
  )
}

function CenteredMessage({ text, action }: { text: string; action?: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center"><div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"><p className="text-lg font-black">{text}</p>{action && <div className="mt-4 text-sm">{action}</div>}</div></section></main>
}
