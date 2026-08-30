import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'

const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

type Phase = 'loading' | 'verified' | 'activated' | 'blocked' | 'error'

type ProductInfo = {
  public_code?: string
  product_type?: string
  label?: string
  email?: string
}

export default function ScanActivationEntry() {
  const { publicCode = '' } = useParams()
  const navigate = useNavigate()

  const code = useMemo(() => publicCode.trim().toUpperCase(), [publicCode])
  const [phase, setPhase] = useState<Phase>('loading')
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [profileUrl, setProfileUrl] = useState('')
  const [message, setMessage] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const validCode = /^[A-Z2-9]{8,24}$/.test(code)

  const rememberCode = () => {
    sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, code)
    localStorage.setItem(SCAN_PUBLIC_CODE_KEY, code)
  }

  const clearCode = () => {
    sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
    localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
  }

  const loadPending = async () => {
    const pending: any = await apiGet('/me/artifacts/scan/pending').catch(() => ({ ok: false }))
    if (!pending.ok) return false
    if (String(pending.data?.public_code || '').toUpperCase() !== code) return false

    setProduct(pending.data)
    setAccountEmail(String(pending.data?.email || ''))
    setPhase('verified')
    return true
  }

  const startOrResume = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')

    try {
      if (await loadPending()) return

      const start: any = await apiPost('/public/artifacts/scan/start', { public_code: code })
        .catch(() => ({ ok: false, error: 'No pudimos preparar la activación.' }))

      if (!start.ok) {
        setMessage(start.error || 'No pudimos preparar la activación.')
        setPhase('error')
        return
      }

      const loaded = await loadPending()
      if (!loaded) {
        setMessage('La activación fue preparada, pero no pudimos recuperar su confirmación. Intenta nuevamente.')
        setPhase('error')
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let active = true

    const inspect = async () => {
      if (!validCode) {
        setMessage('Este producto no tiene un identificador válido.')
        setPhase('error')
        return
      }

      rememberCode()

      const status: any = await apiPost('/public/artifacts/scan/status', { public_code: code })
        .catch(() => ({ ok: false, error: 'No pudimos comprobar este producto.' }))

      if (!active) return
      if (!status.ok) {
        setMessage(status.error || 'No pudimos comprobar este producto.')
        setPhase('error')
        return
      }

      setProduct(status.artifact || null)
      setProfileUrl(String(status.next_url || ''))

      if (status.state === 'activated') {
        setPhase('activated')
        return
      }

      if (status.state === 'blocked' || status.state === 'unavailable' || status.state === 'not_ready') {
        setMessage(status.message || 'Este producto no está disponible para activación.')
        setPhase('blocked')
        return
      }

      if (status.state !== 'pending_activation') {
        setMessage('No pudimos determinar el estado de este producto.')
        setPhase('error')
        return
      }

      // The public /l/:code screen already asked “¿Deseas activarlo ahora?”.
      // Do not repeat that decision in the APP. From this point the APP only
      // authenticates (when needed), prepares the one-time intent and shows
      // the final verification/confirmation screen.
      const me: any = await apiGet('/me').catch(() => ({ ok: false }))
      if (!active) return

      if (!me.ok) {
        navigate(`/admin/login?activation=scan&public_code=${encodeURIComponent(code)}`, { replace: true })
        return
      }

      setAccountEmail(String(me.data?.email || ''))
      await startOrResume()
    }

    void inspect()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, validCode, navigate])

  const confirmActivation = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')

    const result: any = await apiPost('/me/artifacts/scan/confirm', {})
      .catch(() => ({ ok: false, error: 'No se pudo completar la activación.' }))

    setBusy(false)
    if (!result.ok) {
      setMessage(result.error || 'No se pudo completar la activación.')
      return
    }

    clearCode()
    await apiPost('/me/notifications/welcome', {}).catch(() => undefined)

    const meAfterActivation: any = await apiGet('/me').catch(() => ({ ok: false }))
    const hasActivity = Boolean(
      meAfterActivation?.ok &&
      String(meAfterActivation.data?.category || '').trim() &&
      String(meAfterActivation.data?.subcategory || '').trim()
    )

    // En la primera activación el perfil base recién creado todavía no tiene
    // actividad/subcategoría. Ese caso debe entrar al onboarding guiado.
    if (!hasActivity) {
      navigate('/admin/free/onboarding/intro', { replace: true })
      return
    }

    // Si el usuario ya tenía un perfil configurado y solo agregó otro producto,
    // respetamos el destino normal sin obligarlo a repetir onboarding.
    const nextUrl = String(result.data?.next_url || '')
    if (nextUrl) {
      window.location.assign(nextUrl)
      return
    }
    navigate('/admin/free', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>

          {phase === 'loading' && (
            <div className="py-8 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
              <h1 className="mt-4 text-xl font-black">Preparando tu activación…</h1>
              <p className="mt-2 text-sm text-slate-500">Estamos verificando de forma segura tu producto y tu cuenta.</p>
            </div>
          )}

          {phase === 'verified' && (
            <>
              <h1 className="mt-3 text-[28px] font-black leading-tight">Producto confirmado</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">Kawvo validó automáticamente los datos asociados a este artículo. No necesitas escribir ningún código.</p>
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-base font-extrabold text-slate-900">{product?.label || 'Producto Kawvo'}</p>
                <div className="mt-3 space-y-2 text-sm font-bold text-emerald-800">
                  <p>✓ Producto confirmado</p>
                  <p>✓ Código de compra verificado</p>
                  <p>✓ Código de activación verificado</p>
                </div>
                {accountEmail && <p className="mt-3 text-xs text-slate-500">Cuenta: {accountEmail}</p>}
              </div>
              {message && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-xs font-semibold leading-5 text-rose-700">{message}</p>}
              <button type="button" onClick={confirmActivation} disabled={busy} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">
                {busy ? 'Activando…' : 'Confirmar y empezar'}
              </button>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">Al confirmar, este producto quedará vinculado a tu cuenta y Kawvo conservará el comprobante interno de activación.</p>
            </>
          )}

          {phase === 'activated' && (
            <div className="py-4 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl font-black text-emerald-700">✓</div>
              <h1 className="mt-4 text-2xl font-black">Este producto ya está activo</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">{product?.label || 'Tu producto Kawvo'} ya está conectado a un Perfil Digital.</p>
              {profileUrl && <button type="button" onClick={() => window.location.assign(profileUrl)} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Abrir Perfil Digital</button>}
            </div>
          )}

          {(phase === 'blocked' || phase === 'error') && (
            <div className="py-4 text-center">
              <h1 className="text-2xl font-black">{phase === 'blocked' ? 'Producto no disponible' : 'No pudimos continuar'}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">{message || 'No pudimos comprobar este producto.'}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
