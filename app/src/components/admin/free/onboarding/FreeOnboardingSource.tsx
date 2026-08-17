import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SOURCES = [
  'Recomendación',
  'Instagram',
  'WhatsApp',
  'Tienda o punto de venta',
  'Evento',
  'Cliente o amigo',
  'Otro',
] as const

export default function FreeOnboardingSource() {
  const navigate = useNavigate()
  const [source, setSource] = useState(() => sessionStorage.getItem('kawvo_free_lead_source') || '')

  const continueFlow = () => {
    if (!source) return
    sessionStorage.setItem('kawvo_free_lead_source', source)
    navigate('/admin/free/onboarding/builder')
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[430px] py-4">
        <div className="mb-8 flex gap-2" aria-label="Paso 2 de 2">
          <span className="h-1.5 flex-1 rounded-full bg-cyan-500" />
          <span className="h-1.5 flex-1 rounded-full bg-cyan-500" />
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-600">Última pregunta</p>
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">¿Cómo supiste de nosotros?</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Esto nos ayuda a entender cómo llegan nuestros clientes a Kawvo.</p>

        <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <div className="grid gap-2.5">
            {SOURCES.map((item) => (
              <button key={item} type="button" onClick={() => setSource(item)} className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${source === item ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                {item}
              </button>
            ))}
          </div>

          <button type="button" onClick={continueFlow} disabled={!source} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition disabled:opacity-35">
            Preparar mi perfil base
          </button>
        </div>
      </section>
    </main>
  )
}
