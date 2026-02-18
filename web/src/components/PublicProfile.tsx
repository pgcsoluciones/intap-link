import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

interface GalleryItem {
    image_key: string
    image_url: string
}

interface ProfileLink {
    id: string
    label: string
    url: string
}

interface PublicData {
    profileId: string
    slug: string
    themeId: string
    name: string | null
    bio: string | null
    links: ProfileLink[]
    gallery: GalleryItem[]
    faqs: { question: string; answer: string }[] | null
    entitlements: { canUseVCard: boolean; maxLinks: number; maxPhotos: number; maxFaqs: number }
}

export default function PublicProfile() {
    const { slug } = useParams()
    const [data, setData] = useState<PublicData | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorStatus, setErrorStatus] = useState<number | null>(null)

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || ''
        fetch(`${apiUrl}/api/v1/public/profiles/${slug}`)
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
        const apiUrl = import.meta.env.VITE_API_URL || ''
        fetch(`${apiUrl}/api/v1/public/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, eventType, targetId }),
        })
    }

    if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>
    if (errorStatus === 403) return <PrivateBlock slug={slug || ''} />
    if (errorStatus || !data) return <NotFound />

    return (
        <div className="min-h-screen bg-intap-dark flex justify-center items-start pt-12 pb-20 px-4">
            <div className="w-full max-width-mobile text-center animate-fade-in">

                {/* Header: Foto, Nombre, Bio */}
                <div className="mb-8">
                    <div className="w-24 h-24 rounded-full mx-auto mb-6 border-2 border-intap-mint p-1 shadow-[0_0_20px_rgba(13,242,201,0.3)] bg-intap-card flex items-center justify-center overflow-hidden">
                        {data.gallery && data.gallery.length > 0 ? (
                            <img src={data.gallery[0].image_url} alt={data.name || ''} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <span className="text-3xl font-bold text-intap-mint">
                                {data.name?.charAt(0).toUpperCase() || slug?.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{data.name || `@${slug}`}</h1>
                    <p className="text-sm text-slate-400 font-medium px-4 leading-relaxed">
                        {data.bio || 'Bienvenido a mi perfil digital profesional.'}
                    </p>
                </div>

                {/* Botón Destacado: Guardar Contacto (vCard) */}
                {data.entitlements?.canUseVCard && (
                    <a
                        href={`${import.meta.env.VITE_API_URL || ''}/api/v1/public/vcard/${data.profileId}`}
                        className="btn-gradient w-full mb-6 transform hover:scale-[1.02] active:scale-95 transition-all"
                        onClick={() => trackEvent(data.profileId, 'click', 'vcard')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Guardar Contacto (vCard)
                    </a>
                )}

                {/* Enlaces Secundarios */}
                <div className="grid grid-cols-1 gap-3 mb-8">
                    {/* Botón WhatsApp prioritario si existe */}
                    {data.links.some(l => l.label.toLowerCase().includes('whatsapp')) && (
                        data.links.filter(l => l.label.toLowerCase().includes('whatsapp')).map(link => (
                            <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-3 bg-[#25D366] text-white font-bold py-4 rounded-3xl transition-transform hover:scale-[1.01]"
                                onClick={() => trackEvent(data.profileId, 'click', link.id)}
                            >
                                Enviar WhatsApp
                            </a>
                        ))
                    )}

                    {/* Otros enlaces en grid de 2 columnas */}
                    <div className="grid grid-cols-2 gap-3">
                        {data.links.filter(l => !l.label.toLowerCase().includes('whatsapp')).map((link) => (
                            <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 px-2 rounded-2xl glass-card text-sm font-semibold text-white/90 hover:bg-white/10"
                                onClick={() => trackEvent(data.profileId, 'click', link.id)}
                            >
                                <span className="truncate">{link.label}</span>
                            </a>
                        ))}
                    </div>
                </div>

                {/* FAQs Accordion */}
                {data.faqs && data.faqs.length > 0 && (
                    <div className="text-left mb-8">
                        <div className="flex flex-col gap-3">
                            {data.faqs.map((faq, i) => (
                                <details key={i} className="group glass-card overflow-hidden">
                                    <summary className="flex items-center justify-between p-4 cursor-pointer list-none font-bold text-sm">
                                        {faq.question}
                                        <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </summary>
                                    <div className="px-4 pb-4 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                                        {faq.answer}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                )}

                {/* Galería Pro */}
                {data.gallery && data.gallery.length > 1 && (
                    <div className="grid grid-cols-3 gap-2 mb-10">
                        {data.gallery.slice(1).map((img, i) => (
                            <div key={i} className="aspect-square rounded-xl overflow-hidden glass-card">
                                <img src={img.image_url} className="w-full h-full object-cover" alt="Pro" />
                            </div>
                        ))}
                    </div>
                )}

                <footer className="mt-12 opacity-40 text-xs font-medium tracking-tight">
                    <Link to="/">Crea tu propio perfil en <span className="font-bold">INTAP LINK</span></Link>
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
