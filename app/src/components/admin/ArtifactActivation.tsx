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
  profile_is_active?: number | boolean | null
  profile_is_published?: number | boolean | null
  public_url: string
}

const PENDING_PUBLIC_CODE = 'intap_activation_public_code'

function ProductLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Brazalete NFC',
    keychain: 'Llavero NFC', stand: 'Stand NFC', qr: 'Código QR', other: 'Producto INTAP',
  }
  return <>{labels[type] || labels.other}</>
}

export function ArtifactActivation() {
  const navigate = useNavigate()
  const [publicCode, setPublicCode] = useState(() => sessionStorage.getItem(PENDING_PUBLIC_CODE) || '')
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const identify = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setError('')
    setPreview(null)
    setLoading(true)
    const normalized = publicCode.trim().toUpperCase()
    const result: any = await apiPost('/public/artifacts/identify', { public_code: normalized })
      .catch(() => ({ ok: false, error: 'No se pudo identificar el producto.' }))
    setLoading(false)
    if (!result.ok) {
      sessionStorage.removeItem(PENDING_PUBLIC_CODE)
      setError(result.error || 'Producto no disponible.')
      return
    }
    sessionStorage.setItem(PENDING_PUBLIC_CODE, result.data.public_code)
    setPublicCode(result.data.public_code)
    setPreview(result.data)
  }

  const continueToAccount = async () => {
    const me: any = await apiGet('/me').catch(() => ({ ok: false }))
    if (me.ok) {
      navigate('/admin/artifacts/activate')
    } else {
      navigate('/admin/login?activation=1')
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <Link to="/admin/login" className="mb-7 text-xs font-bold text-slate-500">← Volver</Link>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">INTAP LINK</p>
        <h1 className="mt-2 text-[30px] font-black leading-tight tracking-[-0.04em]">Vincula tu producto</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Primero identifica el producto con el código público impreso o programado. El código secreto se pedirá solamente al final.</p>

        <form onSubmit={identify} className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Código público del producto
            <input value={publicCode} onChange={event => setPublicCode(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="TJ6RLWSWXJ" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black tracking-[0.14em] uppercase outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
          </label>
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
          {preview && <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm"><p className="font-black text-cyan-700">Producto disponible</p><p className="mt-1 font-extrabold text-slate-900"><ProductLabel type={preview.product_type} /></p><p className="mt-1 font-mono text-xs font-bold text-slate-500">{preview.public_code}</p><p className="mt-2 text-xs leading-5 text-slate-500">Ahora identifica tu cuenta. Todavía no se ha consumido ningún código secreto.</p></div>}
          {!preview ? <button disabled={loading || !publicCode.trim()} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-35">{loading ? 'Identificando…' : 'Identificar producto'}</button> : <button type="button" onClick={continueToAccount} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Continuar con mi cuenta</button>}
        </form>
      </section>
    </main>
  )
}

export function ArtifactActivationAuthenticated() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(null)
  const [product, setProduct] = useState<any>(null)
  const [secret, setSecret] = useState('')
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const pendingCode = sessionStorage.getItem(PENDING_PUBLIC_CODE)
    if (!pendingCode) { navigate('/activate', { replace: true }); return }
    Promise.all([apiGet('/me'), apiPost('/public/artifacts/identify', { public_code: pendingCode })])
      .then(([meResult, productResult]: any[]) => {
        if (!meResult.ok) { navigate('/admin/login?activation=1', { replace: true }); return }
        if (!productResult.ok) { setError(productResult.error || 'Este producto ya no está disponible.'); return }
        setMe(meResult.data)
        setProduct(productResult.data)
      })
      .catch(() => setError('No se pudo preparar la activación.'))
      .finally(() => setLoading(false))
  }, [navigate])

  const activate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!me?.profile_id || !product?.public_code || !secret.trim()) return
    setSaving(true)
    setError('')
    const result: any = await apiPost('/me/artifacts/activate-direct', {
      public_code: product.public_code,
      activation_code: secret,
      profile_id: me.profile_id,
    }).catch(() => ({ ok: false, error: 'No se pudo completar la activación.' }))
    setSaving(false)
    if (!result.ok) { setError(result.error || 'No se pudo completar la activación.'); return }
    sessionStorage.removeItem(PENDING_PUBLIC_CODE)
    setSecret('')
    setArtifact(result.data)
  }

  if (loading) return <CenteredMessage text="Preparando la vinculación…" />
  if (error && !product) return <CenteredMessage text={error} action={<Link to="/activate" className="font-black text-cyan-700">Volver a identificar el producto</Link>} />
  if (!me?.profile_id) return <CenteredMessage text="Primero necesitamos crear tu perfil para saber dónde debe apuntar el producto." action={<Link to="/admin/free/onboarding/slug" className="font-black text-cyan-700">Crear mi perfil y continuar →</Link>} />
  if (artifact) {
    const published = Number(artifact.profile_is_active) === 1 && Number(artifact.profile_is_published) === 1
    return <CenteredMessage text={`Producto vinculado: ${artifact.public_code}`} action={<div className="space-y-3"><p className="text-sm text-slate-500">Destino: /{artifact.profile_slug}</p>{published ? <a href={artifact.public_url} className="font-black text-cyan-700">Abrir mi enlace público →</a> : <><p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">El producto ya está vinculado, pero tu perfil todavía no está publicado. El enlace físico comenzará a redirigir cuando publiques el perfil.</p><Link to="/admin/free" className="font-black text-cyan-700">Ir a mi perfil →</Link></>}</div>} />
  }

  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center"><div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">Paso final</p><h1 className="mt-2 text-2xl font-black">Confirma la activación</h1><div className="mt-4 rounded-2xl bg-cyan-50 p-4"><p className="text-sm font-black"><ProductLabel type={product?.product_type || 'other'} /></p><p className="mt-1 font-mono text-xs font-bold text-slate-500">{product?.public_code}</p><p className="mt-2 text-xs text-slate-500">Cuenta: {me?.email}</p><p className="mt-1 text-xs text-slate-500">Perfil: /{me?.slug}</p></div><form onSubmit={activate}><label className="mt-5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Código secreto de activación<input value={secret} onChange={event => setSecret(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="ABCD2345…" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black tracking-[0.12em] uppercase outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>{error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}<button disabled={saving || !secret.trim()} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-35">{saving ? 'Vinculando…' : 'Activar y vincular producto'}</button></form></div></section></main>
}

export function ArtifactManager() {
  const navigate = useNavigate()
  const fromAccount = new URLSearchParams(window.location.search).get('from') === 'account'
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const refresh = () => Promise.all([apiGet('/me'), apiGet('/me/artifacts')]).then(([meResult, artifactsResult]: any[]) => { if (meResult.ok) setMe(meResult.data); if (artifactsResult.ok) setArtifacts(artifactsResult.data || []) }).finally(() => setLoading(false))
  useEffect(() => { refresh() }, [])
  const linkProfile = async (item: Artifact) => { if (!me?.profile_id) return; const result: any = await apiPatch(`/me/artifacts/${item.id}/profile`, { profile_id: me.profile_id }); setMessage(result.ok ? 'Perfil vinculado correctamente.' : (result.error || 'No se pudo vincular.')); if (result.ok) refresh() }
  const productCta = loading ? 'Cargando…' : artifacts.length > 0 ? 'Agregar un producto' : 'Activar un producto'
  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto mb-4 w-full max-w-[760px]">{fromAccount && <button type="button" onClick={() => navigate('/admin/free/account')} className="text-sm font-black text-slate-600">← Regresar a Mi cuenta</button>}</section><section className="mx-auto w-full max-w-3xl"><Link to="/admin" className="text-xs font-bold text-slate-500">← Volver al panel</Link><div className="mt-5 mb-7 flex items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">INTAP LINK</p><h1 className="mt-2 text-3xl font-black">Mis productos físicos</h1></div><Link to="/activate" className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white">{productCta}</Link></div>{message && <p className="mb-4 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-700">{message}</p>}{loading ? <p className="text-slate-400">Cargando…</p> : <div className="grid gap-4 sm:grid-cols-2">{artifacts.map(item => <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-slate-400"><ProductLabel type={item.product_type} /></p><p className="mt-2 font-mono text-lg font-bold">{item.public_code}</p><p className="mt-2 text-sm text-slate-500">{item.profile_slug ? `Vinculado a /${item.profile_slug}` : 'Sin perfil vinculado'}</p>{!item.profile_id && me?.profile_id && <button onClick={() => linkProfile(item)} className="mt-4 text-sm font-black text-cyan-700">Vincular a mi perfil →</button>}{item.profile_slug && (Number(me?.is_published) === 1
                  ? <a href={item.public_url} className="mt-4 block text-sm font-black text-cyan-700">Abrir enlace público →</a>
                  : <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3"><p className="text-xs font-bold text-amber-800">Perfil vinculado · pendiente de publicar</p><Link to="/admin/free" className="mt-2 inline-flex text-sm font-black text-cyan-700">Publicar mi perfil →</Link></div>)}</div>)}</div>}</section></main>
}

function CenteredMessage({ text, action }: { text: string; action?: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center"><div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"><p className="text-lg font-black">{text}</p>{action && <div className="mt-4 text-sm">{action}</div>}</div></section></main>
}
