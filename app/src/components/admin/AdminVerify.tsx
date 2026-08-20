import { useNavigate } from 'react-router-dom'

export default function AdminCheckEmail() {
  const navigate = useNavigate()
  const email = sessionStorage.getItem('magic_link_email') || ''

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">INTAP LINK</p>
          <div className="mt-5 text-4xl">✉️</div>
          <h1 className="mt-4 text-[28px] font-black tracking-[-0.04em]">Revisa tu correo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Enviamos un enlace de acceso a <span className="font-extrabold text-slate-900">{email || 'tu correo'}</span>.</p>
        </div>
        <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-xs leading-5 text-slate-500">El enlace expira en <strong className="text-slate-900">10 minutos</strong> y solo puede usarse una vez. Revisa también tu carpeta de spam.</p>
          <button type="button" onClick={() => navigate('/admin/login')} className="mt-5 text-xs font-black text-cyan-700">Volver e ingresar otro correo</button>
        </div>
      </section>
    </main>
  )
}
