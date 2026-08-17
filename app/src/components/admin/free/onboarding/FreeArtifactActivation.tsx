import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'

const PENDING_PUBLIC_CODE = 'intap_activation_public_code'

const PRODUCT_LABELS: Record<string, string> = {
  card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Brazalete NFC',
  keychain: 'Llavero NFC', stand: 'Stand NFC', qr: 'Código QR', other: 'Producto Kawvo',
}

export default function FreeArtifactActivation() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(null)
  const [product, setProduct] = useState<any>(null)
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const pendingCode = sessionStorage.getItem(PENDING_PUBLIC_CODE)
    if (!pendingCode) {
      navigate('/admin/free/onboarding/welcome', { replace: true })
      return
    }

    Promise.all([apiGet('/me'), apiPost('/public/artifacts/identify', { public_code: pendingCode })])
      .then(([meResult, productResult]: any[]) => {
        if (!meResult.ok) {
          navigate('/admin/login', { replace: true })
          return
        }
        if (!productResult.ok) {
          setError(productResult.error || 'Este producto ya no está disponible.')
          return
        }
        if (!meResult.data?.profile_id) {
          navigate('/admin/free/onboarding/bootstrap', { replace: true })
          return
        }
        setMe(meResult.data)
        setProduct(productResult.data)
      })
      .catch(() => setError('No se pudo preparar la activación.'))
      .finally(() => setLoading(false))
  }, [navigate])

  const activate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!me?.profile_id || !product?.public_code || !secret.trim() || saving) return
    setSaving(true)
    setError('')

    const result: any = await apiPost('/me/artifacts/activate-direct', {
      public_code: product.public_code,
      activation_code: secret,
      profile_id: me.profile_id,
    }).catch(() => ({ ok: false, error: 'No se pudo completar la activación.' }))

    setSaving(false)
    if (!result.ok) {
      setError(result.error || 'No se pudo completar la activación.')
      return
    }

    sessionStorage.removeItem(PENDING_PUBLIC_CODE)
    sessionStorage.setItem('kawvo_free_artifact_activated', result.data?.public_code || product.public_code)
    navigate('/admin/free/onboarding/intro', { replace: true })
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>
  }

  if (error && !product) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
          <div className="w-full rounded-[28px] border border-slate-200 bg-white p-6">
            <p className="text-lg font-black">{error}</p>
            <Link to="/activate" className="mt-4 inline-flex font-black text-cyan-700">Volver a identificar el producto</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK · Activación</p>
          <h1 className="mt-2 text-2xl font-black">Confirma tu artículo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Ya identificamos tu producto. Ingresa el código secreto para vincularlo a tu cuenta.</p>

          <div className="mt-4 rounded-2xl bg-cyan-50 p-4">
            <p className="text-sm font-black">{PRODUCT_LABELS[product?.product_type] || PRODUCT_LABELS.other}</p>
            <p className="mt-1 font-mono text-xs font-bold text-slate-500">{product?.public_code}</p>
            <p className="mt-2 text-xs text-slate-500">Cuenta: {me?.email}</p>
          </div>

          <form onSubmit={activate}>
            <label className="mt-5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
              Código secreto de activación
              <input value={secret} onChange={(event) => setSecret(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="ABCD2345…" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black tracking-[0.12em] uppercase outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
            </label>
            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
            <button disabled={saving || !secret.trim()} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-35">
              {saving ? 'Activando…' : 'Activar mi producto'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
