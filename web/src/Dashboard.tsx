import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface Entitlements {
    maxLinks: number
    maxPhotos: number
    maxFaqs: number
    canUseVCard: boolean
}

interface DebugResponse {
    ok: boolean
    profileId: string
    basePlan: string
    finalEntitlements: Entitlements
}

interface ProfileSettings {
    themeId: string
    isPublished: boolean
}

function Dashboard() {
    const [data, setData] = useState<DebugResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const profileId = 'profile_debug'

    useEffect(() => {
        fetch(`/api/debug/entitlements/${profileId}`)
            .then(res => res.json())
            .then((json: DebugResponse) => {
                if (json.ok) {
                    setData(json)
                } else {
                    setError('No se pudo cargar la configuración')
                }
            })
            .catch(() => setError('Error de conexión con la API'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex items-center justify-center h-screen bg-intap-dark"><div className="loading-spinner"></div></div>
    if (error) return <div className="p-10 text-red-400 bg-intap-dark min-h-screen">{error}</div>

    const limits = data?.finalEntitlements

    return (
        <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex overflow-hidden">
            {/* Sidebar Mockup Style */}
            <aside className="w-64 bg-white/5 backdrop-blur-2xl border-r border-white/5 p-6 flex flex-col gap-2">
                <div className="text-xl font-extrabold mb-10 tracking-tighter bg-gradient-to-r from-intap-mint to-intap-blue bg-clip-text text-transparent">
                    INTAP LINK
                </div>
                <div className="nav-item bg-white/10 text-white font-bold">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Perfil
                </div>
                <div className="nav-item">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 002-2v-3a2 2 0 00-2-2h-3" /></svg>
                    Estadísticas
                </div>
                <div className="nav-item">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Módulos PRO
                </div>
                <div className="mt-auto opacity-50 text-[10px] text-center">v1.2.5 Final Build</div>
            </aside>

            {/* Main Content Dashboard */}
            <main className="flex-1 overflow-y-auto p-10">
                <header className="flex justify-between items-center mb-10">
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <div className="flex gap-4">
                        <Link to="/admin" className="text-xs bg-intap-mint/10 text-intap-mint px-4 py-2 rounded-full font-bold hover:bg-intap-mint/20 transition-all">Super Admin</Link>
                    </div>
                </header>

                <div className="max-w-4xl">
                    {/* Gráfica Visitas Mockup */}
                    <div className="glass-card p-8 mb-8">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h3 className="text-slate-400 text-sm font-medium mb-1">Visitas Últimos 7 Días</h3>
                                <div className="text-3xl font-bold">4.8K</div>
                            </div>
                            <div className="flex gap-1 items-end h-16">
                                {[40, 60, 45, 90, 65, 80, 100].map((h, i) => (
                                    <div key={i} className="w-2 bg-intap-mint rounded-full opacity-20 hover:opacity-100 transition-all cursor-help" style={{ height: `${h}%` }} title={`Día ${i + 1}: ${h * 10} visitas`}></div>
                                ))}
                            </div>
                        </div>
                        {/* Mockup Line Graph SVG */}
                        <svg className="w-full h-24 text-intap-mint" viewBox="0 0 400 100" preserveAspectRatio="none">
                            <path d="M0,80 Q50,70 100,50 T200,40 T300,20 T400,10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="400" cy="10" r="4" fill="currentColor" />
                        </svg>
                        <div className="flex justify-between mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            <span>Lun</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span><span>Dom</span>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="glass-card p-6 border-b-4 border-intap-blue/30">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">Total de Clicks</p>
                            <p className="text-2xl font-black italic">1.2K</p>
                        </div>
                        <div className="glass-card p-6 border-b-4 border-purple-500/30">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">Tasa Conv.</p>
                            <p className="text-2xl font-black italic">15%</p>
                        </div>
                        <div className="glass-card p-6 border-b-4 border-intap-mint/30">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">Modulo vCard</p>
                            <div className="inline-flex items-center gap-2 bg-intap-mint/20 text-intap-mint text-[10px] font-black px-3 py-1 rounded-full border border-intap-mint/30 uppercase">
                                Activo <span className="text-sm">✓</span>
                            </div>
                        </div>
                    </div>

                    <button className="bg-intap-mint text-intap-dark font-black py-4 px-8 rounded-full flex items-center gap-3 mb-10 hover:shadow-[0_0_30px_rgba(13,242,201,0.3)] transition-all transform hover:-translate-y-1">
                        Desbloquear PRO <span className="text-xl">✨</span>
                    </button>

                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        Tus Módulos PRO <span className="w-2 h-2 bg-intap-mint rounded-full animate-pulse"></span>
                    </h2>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="glass-card p-8 flex flex-col items-center text-center opacity-60 group cursor-not-allowed">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center mb-4 relative">
                                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <div className="absolute -top-2 -right-2 bg-intap-dark p-1 rounded-full border border-white/10"><svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg></div>
                            </div>
                            <h4 className="font-bold text-sm mb-1">Analytics Avanzada</h4>
                            <p className="text-[10px] text-slate-500">Métricas en tiempo real</p>
                        </div>
                        <div className="glass-card p-8 flex flex-col items-center text-center opacity-60 group cursor-not-allowed">
                            <div className="w-16 h-16 bg-purple-500/20 rounded-3xl flex items-center justify-center mb-4 relative">
                                <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                <div className="absolute -top-2 -right-2 bg-intap-dark p-1 rounded-full border border-white/10"><svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg></div>
                            </div>
                            <h4 className="font-bold text-sm mb-1">Integraciones</h4>
                            <p className="text-[10px] text-slate-500">Facebook & Google Ads</p>
                        </div>
                    </div>

                    <GalleryPanel profileId={profileId} />
                </div>
            </main>
        </div>
    )
}

function GalleryPanel({ profileId }: { profileId: string }) {
    const [photos, setPhotos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/v1/profile/gallery/${profileId}`)
            .then(res => res.json())
            .then(json => {
                if (json.ok) setPhotos(json.photos)
            })
            .finally(() => setLoading(false))
    }, [profileId])

    return (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>Galería de Imágenes Pro</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {photos.map((p, i) => (
                    <div key={i} style={{ aspectRatio: '1', background: '#1e293b', borderRadius: '0.4rem', position: 'relative', overflow: 'hidden' }}>
                        <img
                            src={`https://pub-2e9e6b5e0c6e4e8e8e8e8e8e8e8e8e8e.r2.dev/${p.image_key}`}
                            alt="Gallery"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                ))}
                {photos.length === 0 && !loading && (
                    <div style={{ aspectRatio: '1', border: '1px dashed #334155', borderRadius: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Vacío
                    </div>
                )}
            </div>

            <div style={{ padding: '1.5rem', border: '2px dashed #334155', borderRadius: '0.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)' }}>Sube tus fotos para mostrarlas en tu perfil público.</p>
                <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => alert('Función de subida disponible en producción')}>
                    Seleccionar archivos
                </button>
            </div>
        </div>
    )
}

function AnalyticsPanel({ profileId }: { profileId: string }) {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/v1/profile/stats/${profileId}`)
            .then(res => res.json())
            .then(json => {
                if (json.ok) setStats(json.stats)
            })
            .finally(() => setLoading(false))
    }, [profileId])

    if (loading) return <div style={{ marginTop: '2rem', height: '100px', background: '#0f172a', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando estadísticas...</div>

    return (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>Estadísticas de Rendimiento</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Visitas Reales (7 días)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                        {stats?.totalViews || 0}
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '4px', alignItems: 'flex-end', height: '40px' }}>
                        {stats?.dailyViews.map((v: any, i: number) => (
                            <div
                                key={i}
                                title={`${v.day}: ${v.count}`}
                                style={{
                                    flex: 1,
                                    background: 'var(--primary)',
                                    height: `${Math.min((v.count / (stats.totalViews || 1)) * 100 + 10, 100)}%`,
                                    borderRadius: '2px'
                                }}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Enlaces más Clicados</div>
                    {stats?.topLinks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {stats.topLinks.map((link: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{link.label}</span>
                                    <span style={{ fontWeight: 'bold' }}>{link.clics} clics</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Sin clics registrados.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, current, max, color, isPro, isActive }: { label: string, current: number, max: number, color: string, isPro?: boolean, isActive?: boolean }) {
    const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0

    return (
        <div className={`stat-card ${isPro ? 'pro' : ''}`}>
            <div className="stat-label">
                {label} {isPro && (isActive ? <span className="badge-pro" style={{ background: 'var(--success)', color: 'white' }}>✅</span> : <span className="badge-pro">PRO 🔒</span>)}
            </div>
            <div className="stat-value">{current} / {max}</div>
            <div className="stat-progress-bg">
                <div
                    className="stat-progress-bar"
                    style={{ width: `${percentage}%`, backgroundColor: color.startsWith('#') ? color : `var(--${color})` }}
                ></div>
            </div>
        </div>
    )
}

export default Dashboard
