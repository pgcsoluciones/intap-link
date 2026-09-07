import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'

const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

type Phase = 'loading' | 'verified' | 'activated' | 'profile_draft' | 'profile_draft_owner' | 'blocked' | 'error'
type OwnershipChoice = 'self' | 'different' | null

type ProductInfo = {
  public_code?: string
  product_type?: string
  label?: string
  email?: string
  has_profile?: boolean
  profile_slug?: string | null
}

export default function ScanActivationEntry() {
  const { publicCode = '' } = useParams()
  const navigate = useNavigate()

  const code = useMemo(() => publicCode.trim().toUpperCase(), [publicCode])
  const [phase, setPhase] = useState<Phase>('loading')
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [profileUrl, setProfileUrl] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [message, setMessage] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [ownershipChoice, setOwnershipChoice] = useState<OwnershipChoice>(null)
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
    setOwnershipChoice(null)
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
        setMessage('No pudimos continuar con la activación. Intenta nuevamente.')
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
      setLoginUrl(String(status.login_url || ''))

      if (status.state === 'activated') {
        const nextUrl = String(status.next_url || '')
        if (nextUrl) {
          clearCode()
          window.location.replace(nextUrl)
          return
        }
        setMessage('No pudimos abrir el perfil asociado a este producto.')
        setPhase('error')
        return
      }

      if (status.state === 'profile_draft_owner') {
        setMessage(status.message || 'Tu Perfil Digital todavía está en construcción.')
        setPhase('profile_draft_owner')
        return
      }

      if (status.state === 'profile_draft') {
        setMessage(status.message || 'Este Perfil Digital todavía está en construcción.')
        setPhase('profile_draft')
        return
      }

      if (status.state === 'blocked' || status.state === 'unavailable' || status.state === 'not_ready') {
        setMessage(status.message || 'Este producto no está disponible para activación.')
        setPhase('blocked')
        return
      }

      if (status.state !== 'pending_activation') {
        setMessage('No pudimos abrir este producto.')
        setPhase('error')
        return
      }

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

  const continueWithDifferentUser = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    rememberCode()

    try {
      const logout: any = await apiPost('/auth/logout', {}).catch(() => ({ ok: false }))
      if (!logout?.ok) {
        setMessage('No pudimos cerrar la sesión actual. Intenta nuevamente.')
        return
      }

      const meAfterLogout: any = await apiGet('/me').catch(() => ({ ok: false }))
      if (meAfterLogout?.ok) {
        setMessage('La sesión actual sigue abierta. Intenta nuevamente.')
        return
      }

      rememberCode()
      window.location.replace(`/admin/login?activation=scan&public_code=${encodeURIComponent(code)}&switch_user=1`)
    } finally {
      setBusy(false)
    }
  }

  const confirmActivation = async () => {
    if (busy || ownershipChoice !== 'self') return
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

    if (!hasActivity) {
      navigate('/admin/free/onboarding/intro', { replace: true })
      return
    }

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
              <h1 className="mt-4 text-xl font-black">Abriendo tu producto…</h1>
            </div>
          )}

          {phase === 'verified' && (
            <>
              <h1 className="mt-3 text-[28px] font-black leading-tight">Producto confirmado</h1>
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-base font-extrabold text-slate-900">{product?.label || 'Producto Kawvo'}</p>
                <p className="mt-2 text-sm font-bold text-emerald-800">✓ Listo para vincular</p>
                {accountEmail && <p className="mt-3 text-xs text-slate-500">Sesión actual: {accountEmail}</p>}
              </div>

              {!ownershipChoice && (
                <div className="mt-5">
                  <h2 className="text-lg font-black">¿Para quién es este producto?</h2>
                  <button
                    type="button"
                    onClick={() => setOwnershipChoice('self')}
                    disabled={busy}
                    className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40"
                  >
                    Es para mí
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnershipChoice('different')}
                    disabled={busy}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 disabled:opacity-40"
                  >
                    Es para otra persona
                  </button>
                </div>
              )}

              {ownershipChoice === 'self' && (
                <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-sm font-black text-cyan-900">Vincular a mi cuenta</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {product?.has_profile
                      ? `Se vinculará a tu perfil${product?.profile_slug ? ` /${product.profile_slug}` : ''}.`
                      : 'Se vinculará a tu cuenta y al perfil que crearás a continuación.'}
                  </p>
                  {accountEmail && <p className="mt-2 text-xs font-bold text-slate-500">{accountEmail}</p>}
                </div>
              )}

              {ownershipChoice === 'different' && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-900">Usar otra cuenta</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {accountEmail ? `Cerraremos la sesión de ${accountEmail}.` : 'Cerraremos la sesión actual.'} Luego la otra persona podrá acceder o crear su cuenta.
                  </p>
                </div>
              )}

              {message && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-xs font-semibold leading-5 text-rose-700">{message}</p>}

              {ownershipChoice === 'self' && (
                <>
                  <button type="button" onClick={confirmActivation} disabled={busy} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">
                    {busy ? 'Activando…' : 'Vincular a mi perfil'}
                  </button>
                  <button type="button" onClick={() => setOwnershipChoice(null)} disabled={busy} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-600 disabled:opacity-40">
                    Volver
                  </button>
                </>
              )}

              {ownershipChoice === 'different' && (
                <>
                  <button type="button" onClick={() => void continueWithDifferentUser()} disabled={busy} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">
                    {busy ? 'Cerrando sesión…' : 'Cerrar sesión y continuar'}
                  </button>
                  <button type="button" onClick={() => setOwnershipChoice(null)} disabled={busy} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-600 disabled:opacity-40">
                    Volver
                  </button>
                </>
              )}
            </>
          )}

          {(phase === 'profile_draft' || phase === 'profile_draft_owner') && (
            <div className="py-4 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-xl font-black text-amber-700">…</div>
              <h1 className="mt-4 text-2xl font-black">Perfil en construcción</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {message || 'Este Perfil Digital todavía está en construcción.'}
              </p>

              {phase === 'profile_draft_owner' && (
                <button
                  type="button"
                  onClick={() => window.location.assign(profileUrl || '/admin/free')}
                  className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white"
                >
                  Continuar configurando mi perfil
                </button>
              )}

              {phase === 'profile_draft' && loginUrl && (
                <button
                  type="button"
                  onClick={() => window.location.assign(loginUrl)}
                  className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white"
                >
                  Soy el dueño · Iniciar sesión
                </button>
              )}
            </div>
          )}

          {phase === 'activated' && (
            <div className="py-4 text-center">
              <h1 className="text-2xl font-black">Abriendo perfil…</h1>
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
