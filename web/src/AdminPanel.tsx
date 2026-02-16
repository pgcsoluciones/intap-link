import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface Profile {
    id: string
    slug: string
    email: string
    plan_id: string
    is_published: boolean
}

export default function AdminPanel() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')

    const adminEmail = 'juanluis@intaprd.com'

    useEffect(() => {
        fetch('/api/v1/admin/profiles', {
            headers: { 'X-User-Email': adminEmail }
        })
            .then(res => res.json())
            .then(json => {
                if (json.ok) setProfiles(json.data)
            })
            .finally(() => setLoading(false))
    }, [])

    const activateModule = async (profileId: string, moduleCode: string) => {
        const res = await fetch('/api/v1/admin/activate-module', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profileId,
                moduleCode,
                secret: 'intap_master_key'
            })
        })
        const json = await res.json()
        setMessage(json.ok ? `Módulo ${moduleCode} activado correctamente` : json.error)
    }

    if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>

    return (
        <div className="dashboard-container">
            <header className="header">
                <div className="logo">INTAP ADMIN</div>
                <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Volver al Dashboard</Link>
            </header>

            <main className="content-section">
                <h2>Gestión de Suscriptores</h2>
                {message && <p style={{ color: 'var(--success)', marginBottom: '1rem' }}>{message}</p>}

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #334155', textAlign: 'left' }}>
                                <th style={{ padding: '1rem' }}>Email / Slug</th>
                                <th style={{ padding: '1rem' }}>Plan</th>
                                <th style={{ padding: '1rem' }}>Estado</th>
                                <th style={{ padding: '1rem' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profiles.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #1e293b' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 'bold' }}>{p.email}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{p.slug}</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{p.plan_id.toUpperCase()}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ color: p.is_published ? 'var(--success)' : 'var(--danger)' }}>
                                            {p.is_published ? 'Publicado' : 'Privado'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn-primary" onClick={() => activateModule(p.id, 'vcard')} style={{ fontSize: '0.7rem', padding: '0.4rem' }}>
                                            + vCard
                                        </button>
                                        <button className="btn-primary" onClick={() => activateModule(p.id, 'extra_links')} style={{ fontSize: '0.7rem', padding: '0.4rem', background: 'var(--accent)' }}>
                                            + Links
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    )
}
