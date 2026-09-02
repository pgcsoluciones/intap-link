import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'

const PENDING_PUBLIC_CODE = 'intap_activation_public_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

const PRODUCT_LABELS: Record<string, string> = {
  card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Pulsera NFC',
  keychain: 'Llavero NFC', stand: 'Estación de Contacto', qr: 'Código QR', other: 'Producto Kawvo',
}

function readScanCode(): string {
  const raw = sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || ''
  const code = raw.trim().toUpperCase()
  return /^[A-Z2-9]{8,24}$/.test(code) ? code : ''
}

function clearLegacyContinuity() {
  sessionStorage.removeItem(PENDING_PUBLIC_CODE)
}

export default function FreeArtifactActivation() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(null)
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [noPendingProduct, setNoPendingProduct] = useState(false)

  useEffect(() => {
    let active = true

    const prepare = async () => {
      let scanPending: any = await apiGet('/me/artifacts/scan/pending')
        .catch(() => ({ ok: false }))

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

      if (scanPending.ok && scanPending.data?.public_code) {
        setMe({ email: scanPending.data?.email })
        setProduct(scanPending.data)
        setLoading(false)
        return
      }

      // La activación para clientes se inicia escaneando el artículo Kawvo.
      // Los códigos internos/legacy no se solicitan ni se muestran en la interfaz.
      clearLegacyContinuity()
      sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      setNoPendingProduct(true)
      setLoading(false)
    }

    void prepare()
    return () => { active = false }
  }, [])

  const routeAfterActivation = async () => {
    await apiPost('/me/notifications/welcome', {}).catch(() => undefined)
    const meAfterActivation: any = await apiGet('/me').catch(() => ({ ok: false }))
    const hasActivity = Boolean(
      meAfterActivation?.ok &&
      String(meAfterActivation.data?.category || '').trim() &&
      String(meAfterActivation.data?.subcategory || '').trim()
    )
    navigate(hasActivity ? '/admin/free' : '/admin/free/onboarding/intro', { replace: true })
  }

  const activate = async () => {
    if (saving || !product) return
    setSaving(true)
    setError('')

    const result: any = await apiPost('/me/artifacts/scan/confirm', {})
      .catch(() => ({ ok: false, error: 'No se pudo completar la activación.' }))

    if (!result.ok) {
      setSaving(false)
      setError(result.error || 'No se pudo completar la activación.')
      return
    }

    const activatedCode = result.data?.public_code || product?.public_code || ''
    clearLegacyContinuity()
    sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
    localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
    sessionStorage.setItem('kawvo_free_artifact_activated', activatedCode)
    setSaving(false)
    await routeAfterActivation()
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>
  }

  if (noPendingProduct) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
            <h1 className="mt-3 text-2xl font-black">¿Qué deseas hacer?</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Para registrar un producto, escanea el QR de tu artículo Kawvo o acércalo por NFC y sigue las instrucciones que aparecerán en pantalla.</p>
            <button type="button" onClick={() => navigate('/admin/free', { replace: true })} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Ir a mi perfil</button>
            <button type="button" onClick={() => navigate('/admin/login', { replace: true })} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700">Iniciar sesión</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          <h1 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.04em]">Producto confirmado</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Todo está listo. Confirma para vincular este producto a tu cuenta.</p>

          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-base font-extrabold text-slate-900">{product?.label || PRODUCT_LABELS[product?.product_type] || PRODUCT_LABELS.other}</p>
            <p className="mt-3 text-sm font-bold text-emerald-800">✓ Producto listo para activar</p>
            {(me?.email || product?.email) && <p className="mt-3 text-xs text-slate-500">Cuenta: {me?.email || product?.email}</p>}
          </div>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-xs font-semibold leading-5 text-rose-700">{error}</p>}
          <button type="button" onClick={() => void activate()} disabled={saving} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">
            {saving ? 'Activando…' : 'Confirmar y empezar'}
          </button>
        </div>
      </section>
    </main>
  )
}
