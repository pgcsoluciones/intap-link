import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

interface PublicData {
    profileId: string
    slug: string
    themeId: string
    name: string | null
    bio: string | null
    links: { id: string; label: string; url: string }[]
    gallery: { image_key: string }[]
    faqs: { question: string; answer: string }[] | null
}

export default function PublicProfile() {
    const { slug } = useParams()
    const [data, setData] = useState<PublicData | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorStatus, setErrorStatus] = useState<number | null>(null)

    useEffect(() => {
        fetch(`/api/v1/public/profiles/${slug}`)
            .then(res => {
                if (!res.ok) {
                    setErrorStatus(res.status)
                    throw new Error()
                }
                return res.json()
            })
            .then(json => {
                setData(json.data)
                trackEvent(json.data.profileId, 'view')
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [slug])

    const trackEvent = (profileId: string, eventType: string, targetId?: string) => {
        fetch('/api/v1/public/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, eventType, targetId })
        })
    }

    if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>
    if (errorStatus === 403) return <PrivateBlock slug={slug || ''} />
    if (errorStatus || !data) return <NotFound />

    // Temas visuales dinámicos
    const themeStyles: Record<string, any> = {
        classic: { background: 'var(--bg-dark)', primary: 'var(--primary)', accent: 'var(--accent)' },
        dark: { background: '#000', primary: '#fff', accent: '#fff', text: '#fff' },
        modern: { background: '#f0fdf4', primary: '#059669', accent: '#10b981', text: '#064e3b', card: '#ffffff', border: '#d1fae5' }
    }
    const theme = themeStyles[data.themeId] || themeStyles.classic

    return (
        <div className="public-profile" style={{ background: theme.background }}>
            <div className="profile-card" style={{ color: theme.text }}>
                <div className="profile-header">
                    <div className="profile-avatar" style={{ background: theme.primary }}>
                        {data?.name?.charAt(0).toUpperCase() || slug?.charAt(0).toUpperCase()}
                    </div>
                    <h1 style={{ color: theme.text || 'inherit', margin: '0.5rem 0 0.2rem 0' }}>{data?.name || `@${slug}`}</h1>
                    {data?.bio && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '1rem 0 1.5rem 0', opacity: 0.8, lineHeight: '1.4' }}>
                            {data.bio}
                        </p>
                    )}
                </div>

                <div className="profile-actions">
                    <a
                        href="https://wa.me/?text=Hola!%20Vi%20tu%20perfil"
                        className="btn-whatsapp"
                        style={{ background: theme.primary }}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackEvent(data.profileId, 'click', 'whatsapp')}
                    >
                        Enviar WhatsApp
                    </a>

                    <div className="links-list">
                        {data?.links.map((link, i) => (
                            <a
                                key={i}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link-button"
                                style={{ background: theme.card, color: theme.text, borderColor: theme.border }}
                                onClick={() => trackEvent(data.profileId, 'click', link.id)}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    {data?.faqs && (
                        <div className="faqs-section">
                            <h3 style={{ color: theme.text }}>Preguntas Frecuentes</h3>
                            {data.faqs.map((faq, i) => (
                                <div key={i} className="faq-item" style={{ background: theme.card || '#1e293b', border: theme.border ? `1px solid ${theme.border}` : 'none' }}>
                                    <div className="faq-q" style={{ color: theme.primary }}>{faq.question}</div>
                                    <div className="faq-a" style={{ color: theme.text }}>{faq.answer}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <footer className="public-footer">
                    <Link to="/" style={{ color: theme.text }}>Crea tu propio perfil en INTAP LINK</Link>
                </footer>
            </div>
        </div>
    )
}

function PrivateBlock({ slug }: { slug: string }) {
    return (
        <div className="public-profile error-page">
            <div className="profile-card">
                <h1>Perfil Privado 🔒</h1>
                <p>El perfil de <strong>@{slug}</strong> no está disponible públicamente en este momento.</p>
                <Link to="/" className="btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block', textDecoration: 'none' }}>
                    Volver al Inicio
                </Link>
            </div>
        </div>
    )
}

function NotFound() {
    return (
        <div className="public-profile error-page">
            <div className="profile-card">
                <h1>Slug No Encontrado</h1>
                <p>El perfil que buscas no existe o ha sido movido.</p>
                <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', marginTop: '1.5rem' }}>
                    Crear mi perfil ahora
                </Link>
            </div>
        </div>
    )
}
