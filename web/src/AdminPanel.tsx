import { Link } from 'react-router-dom'

export default function AdminPanel() {
    return (
        <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center justify-center py-10 px-4">
            <div className="w-full max-w-lg glass-card p-8 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-3">
                    Panel legacy
                </p>

                <h1 className="text-2xl font-black mb-4">
                    Panel legacy deshabilitado
                </h1>

                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    Este panel anterior ya no debe usarse para administrar módulos o suscriptores.
                    Usa el panel Super Admin con autenticación y auditoría RBAC.
                </p>

                <Link
                    to="/"
                    className="inline-flex items-center justify-center rounded-full bg-intap-mint px-5 py-3 text-xs font-black uppercase tracking-wide text-black hover:opacity-90 transition-opacity"
                >
                    Volver
                </Link>
            </div>
        </div>
    )
}
