import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'

const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

export default function ScanActivationEntry() {
  const { publicCode = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const code = publicCode.trim().toUpperCase()

    const run = async () => {
      if (!/^[A-Z2-9]{8,24}$/.test(code)) {
        setError('Este producto no tiene un identificador válido.')
        return
      }

      // Public code is not an activation secret. Keep it only as continuity
      // data so login/callback can resume the product the customer scanned.
      sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, code)
      localStorage.setItem(SCAN_PUBLIC_CODE_KEY, code)

      const me: any = await apiGet('/me').catch(() => ({ ok: false }))
      if (!active) return

      if (!me.ok) {
        navigate(`/admin/login?activation=scan&public_code=${encodeURIComponent(code)}`, { replace: true })
        return
      }

      // Create the one-time intent from the APP origin, after the customer
      // explicitly chose “Activarlo ahora”. This avoids cross-subdomain cookie
      // handoff and keeps the activation secret server-side.
      const start: any = await apiPost('/public/artifacts/scan/start', { public_code: code })
        .catch(() => ({ ok: false, error: 'No pudimos preparar la activación.' }))

      if (!active) return
      if (!start.ok) {
        setError(start.error || 'No pudimos preparar la activación.')
        return
      }

      navigate('/admin/artifacts/activate?scan=1', { replace: true })
    }

    void run()
    return () => { active = false }
  }, [navigate, publicCode])

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          {error ? (
            <>
              <h1 className="mt-3 text-xl font-black">No pudimos continuar</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
            </>
          ) : (
            <>
              <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
              <h1 className="mt-4 text-xl font-black">Preparando tu activación…</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Estamos conectando de forma segura el producto que acabas de confirmar.</p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
