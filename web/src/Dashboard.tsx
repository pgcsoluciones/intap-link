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
    const [settings, setSettings] = useState<ProfileSettings>({ themeId: 'classic', isPublished: true })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

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

    const saveSettings = async (newSettings: Partial<ProfileSettings>) => {
        setSaving(true)
        const updated = { ...settings, ...newSettings }
        try {
            const res = await fetch('/api/v1/profile/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId, ...updated })
            })
            if (res.ok) setSettings(updated)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner"></div>
            </div>
        )
    }

    if (error) {
        return <div className="dashboard-container"><p style={{ color: 'var(--danger)' }}>{error}</p></div>
    }

    const limits = data?.finalEntitlements

    return (
        <div className="dashboard-container">
            <header className="header">
                <div className="logo">INTAP LINK</div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Perfil: <strong>{data?.profileId}</strong></div>
                    <Link to="/admin" style={{ fontSize: '0.7rem', color: 'var(--accent)', textDecoration: 'none' }}>Super Admin</Link>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
                <div>
                    <section className="stats-grid">
                        <StatCard
                            label="Enlaces Permitidos"
                            current={0}
                            max={limits?.maxLinks || 0}
                            color="#6366f1"
                        />
                        <StatCard
                            label="vCard"
                            current={limits?.canUseVCard ? 1 : 0}
                            max={1}
                            color={limits?.canUseVCard ? "#10b981" : "var(--locked)"}
                            isPro={true}
                            isActive={limits?.canUseVCard}
                        />
                        <StatCard
                            label="Galería Pro"
                            current={0}
                            max={Number(limits?.maxPhotos || 0)}
                            color={Number(limits?.maxPhotos || 0) > 0 ? "var(--accent)" : "var(--locked)"}
                            isPro={true}
                            isActive={Number(limits?.maxPhotos || 0) > 0}
                        />
                    </section>

                    <main className="content-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>Gestión de Enlaces</h2>
                            <span className="badge-pro">
                                PLAN: {data?.basePlan.toUpperCase()}
                            </span>
                        </div>

                        <div style={{ padding: '3rem', border: '2px dashed #334155', borderRadius: '1rem', textAlign: 'center' }}>
                            <p>Links creados: <strong>0 / {limits?.maxLinks}</strong></p>
                            <button className="btn-primary" disabled>+ Crear Nuevo Link</button>
                        </div>

                        <AnalyticsPanel profileId={profileId} />
                    </main>
                </div>

                <aside className="content-section" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Personalización</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Tema Visual</label>
                        <select
                            value={settings.themeId}
                            onChange={(e) => saveSettings({ themeId: e.target.value })}
                            style={{ width: '100%', background: '#0f172a', color: 'white', border: '1px solid #334155', padding: '0.5rem', borderRadius: '0.4rem' }}
                        >
                            <option value="classic">Classic Blue</option>
                            <option value="dark">Total Black</option>
                            <option value="modern">Modern Mint</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem' }}>Publicado</span>
                        <input
                            type="checkbox"
                            checked={settings.isPublished}
                            onChange={(e) => saveSettings({ isPublished: e.target.checked })}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                    </div>

                    <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '0.5rem', fontSize: '0.75rem', border: '1px solid #1e293b' }}>
                        <div style={{ color: settings.isPublished ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                            {settings.isPublished ? '● Perfil Online' : '○ Perfil Privado'}
                        </div>
                        {saving && <span style={{ color: 'var(--accent)' }}>Guardando...</span>}
                    </div>
                </aside>
            </div>

            <footer style={{ marginTop: '3rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                ID de Base de Datos: 3a2d724d-5938-4777-a63e-423bb41862c0
            </footer>
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
