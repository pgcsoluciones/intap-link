import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface Profile {
    id: string
    slug: string
    email: string
    plan_id: string
    is_published: boolean
}

function getAuthToken(): string | null {
    return localStorage.getItem('intap_token')
}

export default function AdminPanel() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [unauthorized, setUnauthorized] = useState(false)

    useEffect(() => {
        const token = getAuthToken()
        if (!token) {
            setUnauthorized(true)
            setLoading(false)
            return
        }
        fetch('/api/v1/admin/profiles', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    setUnauthorized(true)
                    return null
                }
                return res.json()
            })
            .then(json => {
                if (json?.ok) setProfiles(json.data)
            })
            .finally(() => setLoading(false))
    }, [])

    const activateModule = async (profileId: string, moduleCode: string) => {
        const token = getAuthToken()
        if (!token) { setMessage('No autenticado'); return }

        const res = await fetch('/api/v1/admin/activate-module', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ profileId, moduleCode }),
        })
        const json = await res.json()
        setMessage(json.ok ? `Módulo ${moduleCode} activado correctamente` : json.error)
    }

    if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>

    if (unauthorized) return (
        <div className="min-h-screen bg-intap-dark text-white flex flex-col items-center justify-center gap-4">
            <p className="text-red-400 font-bold">Acceso denegado. Debes iniciar sesión como administrador.</p>
            <Link to="/" className="text-xs text-intap-mint hover:underline">Volver al inicio</Link>
        </div>
    )

    return (
        <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4 overflow-x-hidden">
            <div className="w-full max-w-lg">
                <header className="flex justify-between items-center mb-10">
                    <h1 className="text-xl font-bold">Super Admin</h1>
                    <Link to="/" className="text-xs text-slate-500 hover:text-white transition-colors">Volver</Link>
                </header>

                {/* Gráfica de Crecimiento Mockup */}
                <div className="glass-card p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-4 right-4 bg-intap-mint/20 text-intap-mint text-[10px] font-bold px-2 py-0.5 rounded-full border border-intap-mint/30">8</div>
                    <svg className="w-full h-32 text-intap-mint opacity-80" viewBox="0 0 400 100" preserveAspectRatio="none">
                        <path d="M0,80 L80,70 L160,55 L240,40 L320,25 L400,10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        {[0, 80, 160, 240, 320, 400].map((x, i) => (
                            <circle key={i} cx={x} cy={80 - i * 14} r="4" fill="currentColor" stroke="#030712" strokeWidth="2" />
                        ))}
                    </svg>
                    <div className="flex justify-between mt-4 text-[10px] text-slate-500 font-bold">
                        <span>121</span><span>211</span><span>201</span><span>101</span><span>10 21</span>
                    </div>
                </div>

                {/* Resumen Métricas Admin */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="glass-card p-4 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total de Clicks</p>
                        <p className="text-xl font-black italic">1.2K</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Tasa Conv.</p>
                        <p className="text-xl font-black italic">10%</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Modulo vCard</p>
                        <div className="bg-intap-mint/20 text-intap-mint text-[8px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-intap-mint/30 uppercase mt-1">
                            Activo <span className="text-[10px]">✓</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold">Gestión de Suscriptores</h2>
                    <button className="bg-gradient-to-r from-intap-blue to-purple-600 text-[10px] font-black px-4 py-2 rounded-full shadow-lg">
                        Crear Nuevo Usuario
                    </button>
                </div>

                {message && <p className="text-center text-xs text-intap-mint mb-4 font-bold">{message}</p>}

                <div className="flex flex-col gap-4">
                    {profiles.map(p => (
                        <div key={p.id} className="glass-card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-bold">@{p.slug}</span>
                                <button className="text-slate-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <div
                                    onClick={() => activateModule(p.id, 'vcard')}
                                    className="flex items-center gap-2 bg-intap-mint/10 border border-intap-mint/30 text-intap-mint text-[10px] font-bold px-3 py-1.5 rounded-full cursor-pointer hover:bg-intap-mint/20 transition-all"
                                >
                                    <svg className="w-3 h-3 text-intap-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    vCard <span className="opacity-60 text-xs">✓</span>
                                </div>
                                <div
                                    onClick={() => activateModule(p.id, 'extra_links')}
                                    className="flex items-center gap-2 bg-intap-mint/10 border border-intap-mint/30 text-intap-mint text-[10px] font-bold px-3 py-1.5 rounded-full cursor-pointer hover:bg-intap-mint/20 transition-all"
                                >
                                    <svg className="w-3 h-3 text-intap-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    Extra Links <span className="opacity-60 text-xs">✓</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-full">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                    Galeria
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Item adicional simulado para coincidir con el mockup */}
                    <div className="glass-card p-6 flex justify-between items-center opacity-40">
                        <span className="text-sm font-bold">@nuevo_cliente</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>

                {/* Footer Mockup */}
                <div className="grid grid-cols-2 gap-4 mt-10">
                    <div className="glass-card p-6 flex flex-col items-center text-center opacity-60">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-3 relative">
                            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <svg className="absolute -top-1 -right-1 w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        </div>
                        <h4 className="text-[10px] font-bold">Analytics Avanzada</h4>
                    </div>
                    <div className="glass-card p-6 flex flex-col items-center text-center opacity-60">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-3 relative">
                            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            <svg className="absolute -top-1 -right-1 w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        </div>
                        <h4 className="text-[10px] font-bold">Integraciones</h4>
                    </div>
                </div>
            </div>
        </div>
    )
}
