import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'

const PENDING_PUBLIC_CODE = 'intap_activation_public_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

type ActivationMode = 'scan' | 'legacy'

const PRODUCT_LABELS: Record<string, string> = {
  card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Pulsera NFC',
  keychain: 'Llavero NFC', stand: 'Estación de Contacto', qr: 'Código QR', other: 'Producto Kawvo',
}

function readScanCode(): string {
  const raw = sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || ''
  const code = raw.trim().toUpperCase()
  return /^[A-Z2-9]{8,24}$/.test(code) ? code : ''
}

export default function FreeArtifactActivation() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ActivationMode>('scan')
  const [me, setMe] = useState<any>(null)
  const [product, setProduct] = useState<any>(null)
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const prepare = async () => {
      let scanPending: any = await apiGet('/me/artifacts/scan/pending')
        .catch(() => ({ ok: false }))

      // Recover the modern scan flow before considering any legacy route.
      // The public code is continuity data, not the activation secret.
      if (!scanPending.ok) {
        const scanCode = readScanCode()
        if (scanCode) {
          const start: any = await apiPost('/public/artifacts/scan/start', { public_code: scanCode })
            .catch(() => ({ ok: false }))
          if (start.ok) {
            scanPending = await apiGet('/me/artifacts/scan/pending')
              .catch(() => ({ ok: false }))
          }
        }
      }

      if (!active) return

      if (scanPending.ok) {
        setMode('scan')
        setMe({ email: scanPending.data?.email })
        setProduct(scanPending.data)
        setLoading(false)
        return
      }

      // Legacy/manual fallback remains available only for old packaging/support.
      const pendingCode = sessionStorage.getItem(PENDING_PUBLIC_CODE)
      if (!pendingCode) {
        setError('No encontramos una activación pendiente para esta cuenta.')
        setLoading(false)
        return
      }

      const [meResult, productResult]: any[] = await Promise.all([
        apiGet('/me').catch(() => ({ ok: false })),
        apiPost('/public/artifacts/identify', { public_code: pendingCode })
          .catch(() => ({ ok: false, error: 'Este producto ya no está disponible.' })),
      ])

      if (!active) return
      if (!meResult.ok) {
        navigate('/admin/login', { replace: true })
        return
      }
      if (!productResult.ok) {
        setError(productResult.error || 'Este producto ya no está disponible.')
        setLoading(false)
        return
      }
      if (!meResult.data?.profile_id) {
        navigate('/admin/free/onboarding/bootstrap', { replace: true })
        return
      }

      setMode('legacy')
      setMe(meResult.data)
      setProduct(productResult.data)
      setLoading(false)
    }

    void prepare()
    return () => { active = false }
  }, [navigate])

  const activate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError('')

    if (mode === 'scan') {
      const result: any = await apiPost('/me/artifacts/scan/confirm', {})
        .catch(() => ({ ok: false, error: 'No se pudo completar la activación.' }))

      setSaving(false)
      if (!result.ok) {
        setError(result.error || 'No se pudo completar la activación.')
        return
      }

      const activatedCode = result.data?.public_code || product?.public_code || ''
      sessionStorage.removeItem(PENDING_PUBLIC_CODE)
      sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      sessionStorage.setItem('kawvo_free_artifact_activated', activatedCode)
      await apiPost('/me/notifications/welcome', {}).catch(() => undefined)

      const meAfterActivation: any = await apiGet('/me').catch(() => ({ ok: false }))
      const hasActivity = Boolean(
        meAfterActivation?.ok &&
        String(meAfterActivation.data?.category || '').trim() &&
        String(meAfterActivation.data?.subcategory || '').trim()
      )
      navigate(hasActivity ? '/admin/free' : '/admin/free/onboarding/intro', { replace: true })
      return
    }

    if (!me?.profile_id || !product?.public_code || !secret.trim()) {
      setSaving(false)
      return
    }

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
    await apiPost('/me/notifications/welcome', {}).catch(() => undefined)

    const meAfterActivation: any = await apiGet('/me').catch(() => ({ ok: false }))
    const hasActivity = Boolean(
      meAfterActivation?.ok &&
      String(meAfterActivation.data?.category || '').trim() &&
      String(meAfterActivation.data?.subcategory || '').trim()
    )
    navigate(hasActivity ? '/admin/free' : '/admin/free/onboarding/intro', { replace: true })
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
            <Link to="/admin/login" className="mt-4 inline-flex font-black text-cyan-700">Volver al acceso</Link>
          </div>
        </section>
      </main>
    )
  }

  if (mode === 'scan') {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
            <h1 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.04em]">Producto confirmado</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Kawvo encontró y validó automáticamente los datos de activación asociados a este artículo. No necesitas escribir ningún código.</p>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-base font-extrabold text-slate-900">{product?.label || PRODUCT_LABELS[product?.product_type] || PRODUCT_LABELS.other}</p>
              <div className="mt-3 space-y-2 text-sm font-bold text-emerald-800">
                <p>✓ Producto confirmado</p>
                <p>✓ Código de compra verificado</p>
                <p>✓ Código de activación verificado</p>
              </div>
              <p className="mt-3 text-xs text-slate-500">Cuenta: {me?.email || product?.email}</p>
            </div>

            <form onSubmit={activate}>
              {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-xs font-semibold leading-5 text-rose-700">{error}</p>}
              <button disabled={saving} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">
                {saving ? 'Activando…' : 'Confirmar y empezar'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">Al confirmar, Kawvo vinculará este producto a tu cuenta, conservará el comprobante interno y abrirá tu Perfil Digital para comenzar a editarlo.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK · activación manual</p>
          <h1 className="mt-2 text-2xl font-black">Confirma tu artículo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Este es el método de respaldo para productos anteriores. Introduce el código de activación.</p>

          <div className="mt-4 rounded-2xl bg-cyan-50 p-4">
            <p className="text-sm font-black">{PRODUCT_LABELS[product?.product_type] || PRODUCT_LABELS.other}</p>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">Código de compra</p>
            <p className="mt-1 font-mono text-xs font-bold text-slate-500">{product?.public_code}</p>
            <p className="mt-2 text-xs text-slate-500">Cuenta: {me?.email}</p>
          </div>

          <form onSubmit={activate}>
            <label className="mt-5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
              Código de activación
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
