import { useNavigate } from 'react-router-dom'

const NFC_INTEREST_URL = 'https://nfc.kawvoia.com'

export default function FreeOnboardingWelcome() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">Bienvenido a tu Perfil Digital Gratis</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">Por el momento estamos creando perfiles digitales Gratis para clientes que adquieren un artículo NFC o QR de Kawvo.</p>

          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <p className="text-sm font-extrabold text-slate-900">Para continuar necesitarás:</p>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600">
              <li>✓ Tu artículo NFC o QR.</li>
              <li>✓ Tu código de compra.</li>
              <li>✓ Tu código de activación.</li>
            </ul>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-400">No te preocupes: después de validar tu producto te guiaremos paso a paso para preparar tu perfil.</p>

          <div className="mt-6 grid gap-3">
            <button type="button" onClick={() => navigate('/activate')} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800">
              Tengo mi artículo y mis códigos
            </button>
            <a href={NFC_INTEREST_URL} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
              No tengo, pero me interesa
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
