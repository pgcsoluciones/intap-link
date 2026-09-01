import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'

const NFC_INTEREST_URL = 'https://nfc.kawvoia.com'

type AccessState = 'checking' | 'guest' | 'account-without-profile'

export default function FreeOnboardingWelcome() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accessState, setAccessState] = useState<AccessState>('checking')
  const [showProductHelp, setShowProductHelp] = useState(false)
  const profileDeleted = searchParams.get('profile_deleted') === '1'

  useEffect(() => {
    let active = true

    const resolveEntry = async () => {
      const me: any = await apiGet('/me').catch(() => ({ ok: false }))
      if (!active) return

      if (profileDeleted && me.ok) {
        await apiPost('/auth/logout', {}).catch(() => undefined)
        if (!active) return
        setAccessState('guest')
        return
      }

      if (!me.ok) {
        setAccessState('guest')
        return
      }

      if (me.data?.profile_id) {
        const planId = me.data?.plan_id || me.data?.plan_code || 'free'
        navigate(planId === 'free' ? '/admin/free' : '/admin', { replace: true })
        return
      }

      setAccessState('account-without-profile')
    }

    void resolveEntry()
    return () => { active = false }
  }, [navigate, profileDeleted])

  const goToAuth = (mode: 'login' | 'register') => {
    navigate(`/admin/login?mode=${mode}`)
  }

  const switchAccount = async (mode: 'login' | 'register') => {
    await apiPost('/auth/logout', {}).catch(() => undefined)
    window.location.replace(`/admin/login?mode=${mode}`)
  }

  if (accessState === 'checking') {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] items-center justify-center">
          <div className="loading-spinner" />
        </section>
      </main>
    )
  }

  const isGuest = accessState === 'guest'

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Bienvenido de nuevo</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">¿Qué deseas hacer?</p>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => setShowProductHelp((value) => !value)}
              className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800"
            >
              Registrar un producto
            </button>

            {showProductHelp && (
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <p className="text-sm font-extrabold text-slate-900">Para registrar tu producto:</p>
                <ol className="mt-3 space-y-2 text-sm leading-5 text-slate-600">
                  <li>1. Escanea el QR de tu artículo Kawvo o acerca tu celular al NFC.</li>
                  <li>2. Toca <strong>Activarlo ahora</strong>.</li>
                  <li>3. Si se solicita, inicia sesión o crea tu cuenta.</li>
                </ol>
                <p className="mt-3 text-xs leading-5 text-slate-500">Luego continúa siguiendo las indicaciones en pantalla.</p>
              </div>
            )}

            {isGuest ? (
              <>
                <button type="button" onClick={() => goToAuth('login')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                  Iniciar sesión
                </button>
                <button type="button" onClick={() => goToAuth('register')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                  Crear una cuenta
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/admin/artifacts')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                  Ver mis productos
                </button>
                <button type="button" onClick={() => void switchAccount('login')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                  Iniciar sesión con otra cuenta
                </button>
              </>
            )}
          </div>

          <a href={NFC_INTEREST_URL} target="_blank" rel="noopener noreferrer" className="mt-5 flex w-full items-center justify-center px-4 py-2 text-sm font-extrabold text-cyan-700">
            Conocer productos Kawvo
          </a>
        </div>
      </section>
    </main>
  )
}
