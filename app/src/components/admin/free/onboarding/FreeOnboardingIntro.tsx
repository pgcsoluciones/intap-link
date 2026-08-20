import { useNavigate } from 'react-router-dom'

export default function FreeOnboardingIntro() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK · antes INTAP</p>
          <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Vamos a trabajar juntos en tu perfil</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">Para prepararte una base que se parezca más a tu negocio o servicio, primero cuéntanos a qué te dedicas.</p>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-extrabold text-slate-900">Serán solo unos pasos:</p>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p><strong className="text-slate-900">1.</strong> Elige tu actividad comercial y la opción que mejor describe lo que haces.</p>
              <p><strong className="text-slate-900">2.</strong> Cuéntanos cómo conociste Kawvo.</p>
              <p><strong className="text-slate-900">3.</strong> Nuestros asistentes prepararán una propuesta de perfil base para ti.</p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-400">Primero te mostraremos una propuesta. Si quieres otra, podrás pedirla después de verla. Luego te guiaremos para poner tus datos reales y dejar todo listo para publicar.</p>

          <button type="button" onClick={() => navigate('/admin/free/onboarding/category')} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800">
            Empezar
          </button>
        </div>
      </section>
    </main>
  )
}
