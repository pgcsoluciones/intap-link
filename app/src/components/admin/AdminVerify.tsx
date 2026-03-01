import { useNavigate } from 'react-router-dom'

export default function AdminCheckEmail() {
  const navigate = useNavigate()
  const email = sessionStorage.getItem('magic_link_email') || ''

  return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center px-4 font-['Inter']">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-black mb-2">Revisa tu correo</h1>
          <p className="text-sm text-slate-400">
            Enviamos un enlace de acceso a{' '}
            <span className="text-white font-bold">{email || 'tu correo'}</span>
          </p>
        </div>

        <div className="glass-card p-6 flex flex-col gap-4 text-center">
          <p className="text-xs text-slate-400 leading-relaxed">
            El enlace expira en <strong className="text-white">10 minutos</strong> y solo puede
            usarse una vez. Revisa también tu carpeta de spam.
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin/login')}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Volver e ingresar otro correo
          </button>
        </div>
      </div>
    </div>
  )
}
