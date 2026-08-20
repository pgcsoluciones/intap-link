import { useNavigate } from 'react-router-dom'

export default function FreeOnboardingDone() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-7 text-center shadow-[0_22px_65px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50 text-4xl text-cyan-600">✓</div>
          <h1 className="mt-6 text-[30px] font-black tracking-[-0.03em]">¡Listo!</h1>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-6 text-slate-500">Tu perfil ya tiene lo esencial. Ahora puedes completarlo o conectar tu producto INTAP.</p>

          <button onClick={() => navigate(sessionStorage.getItem('intap_activation_public_code') ? '/admin/artifacts/activate' : '/admin/free')} className="mt-7 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white hover:bg-slate-800">{sessionStorage.getItem('intap_activation_public_code') ? 'Continuar activación' : 'Ir a mi panel'}</button>
          <button onClick={() => navigate('/activate')} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Activar mi producto</button>
        </div>
      </section>
    </main>
  )
}
