import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'

const NFC_INTEREST_URL = 'https://nfc.kawvoia.com'

type AccessState = 'checking' | 'guest' | 'account-without-profile'

export default function FreeOnboardingWelcome() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accessState, setAccessState] = useState<AccessState>('checking')
  const [email, setEmail] = useState('')
  const profileDeleted = searchParams.get('profile_deleted') === '1'

  useEffect(() => {
    let active = true

    const resolveEntry = async () => {
      const me: any = await apiGet('/me').catch(() => ({ ok: false }))
      if (!active) return

      // Después de eliminar un perfil cerramos la sesión antes de volver a la
      // puerta de entrada. Así el usuario ve claramente Crear cuenta / Iniciar sesión
      // y nunca cae otra vez en el onboarding legacy de códigos manuales.
      if (profileDeleted && me.ok) {
        await apiPost('/auth/logout', {}).catch(() => undefined)
        if (!active) return
        setEmail('')
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

      setEmail(String(me.data?.email || ''))
      setAccessState('account-without-profile')
    }

    void resolveEntry()
    return () => { active = false }
  }, [navigate, profileDeleted])

  const goToAuth = (mode: 'login' | 'register') => {
    navigate(`/admin/login?mode=${mode}`)
  }

  const useAnotherAccount = async () => {
    await apiPost('/auth/logout', {}).catch(() => undefined)
    window.location.replace('/admin/login?mode=login')
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

  if (accessState === 'account-without-profile') {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
            <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Tu acceso está listo</h1>
            <p className="mt-3 text-[15px] leading-6 text-slate-500">
              Para crear un Perfil Digital nuevo, inicia desde un artículo Kawvo válido. Escanea su QR o acerca su NFC y retomaremos el proceso automáticamente.
            </p>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-extrabold text-slate-900">Sin códigos manuales</p>
              <p className="mt-2 text-sm leading-5 text-slate-600">Kawvo valida internamente el producto y su activación. No necesitas escribir código de compra ni código de activación.</p>
              {email && <p className="mt-3 text-xs font-semibold text-slate-500">Acceso actual: {email}</p>}
            </div>

            <div className="mt-6 grid gap-3">
              <button type="button" onClick={() => navigate('/admin/artifacts')} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800">
                Ver mis productos
              </button>
              <button type="button" onClick={() => void useAnotherAccount()} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                Usar otra cuenta
              </button>
              <a href={NFC_INTEREST_URL} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center px-4 py-2 text-sm font-extrabold text-cyan-700">
                Conocer artículos Kawvo
              </a>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">¿Cómo quieres continuar?</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">
            Crea tu acceso si eres nuevo o inicia sesión si ya tienes una cuenta Kawvo.
          </p>

          <div className="mt-6 grid gap-3">
            <button type="button" onClick={() => goToAuth('register')} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800">
              Crear una cuenta
            </button>
            <button type="button" onClick={() => goToAuth('login')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
              Iniciar sesión
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-center">
            <p className="text-sm font-extrabold text-slate-900">¿Tienes un artículo Kawvo?</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Escanea su QR o acerca su NFC. La activación moderna reconoce el producto y no te pedirá códigos manuales.</p>
          </div>

          <a href={NFC_INTEREST_URL} target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full items-center justify-center px-4 py-2 text-sm font-extrabold text-cyan-700">
            No tengo uno, quiero conocerlos
          </a>
        </div>
      </section>
    </main>
  )
}
