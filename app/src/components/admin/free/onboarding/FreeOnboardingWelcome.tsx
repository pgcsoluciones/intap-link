import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../../../lib/api'

const NFC_INTEREST_URL = 'https://nfc.kawvoia.com'

export default function FreeOnboardingWelcome() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('profile_deleted') === '1') {
      navigate('/admin/free/onboarding/welcome', { replace: true })
    }
  }, [navigate])

  const logout = async () => {
    if (leaving) return
    setLeaving(true)
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    window.location.replace('/admin/login')
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Bienvenido a Kawlink</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">Tu cuenta está activa, pero todavía no tiene una presentación vinculada. Elige cómo quieres continuar.</p>

          <div className="mt-6 grid gap-3">
            <button type="button" onClick={() => navigate('/admin/artifacts/activate?start=1')} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-left text-white transition hover:bg-slate-800">
              <span className="block text-sm font-extrabold">Ya tengo un dispositivo Kawvo</span>
              <span className="mt-1 block text-xs font-medium leading-5 text-slate-300">Quiero activarlo y vincularlo a esta cuenta.</span>
            </button>

            <a href={NFC_INTEREST_URL} target="_blank" rel="noopener noreferrer" className="block w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-left transition hover:bg-cyan-100/70">
              <span className="block text-sm font-extrabold text-slate-900">No tengo dispositivo, pero me interesa</span>
              <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">Conoce los dispositivos Kawvo y cómo adquirir uno.</span>
            </a>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => void logout()} disabled={leaving} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
              {leaving ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
