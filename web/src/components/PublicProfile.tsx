import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

interface ProfileLink {
    id: string
    label: string
    url: string
    type: string  // 'link' | 'phone' | 'email' | 'whatsapp' | 'social'
}

interface PublicData {
    profileId: string
    slug: string
    themeId: string
    name: string | null
    bio: string | null
    avatar: string | null
    links: ProfileLink[]
    gallery: { image_key: string }[]
    faqs: { question: string; answer: string }[]
    entitlements: {
        canUseVCard: boolean
        maxLinks: number
        maxPhotos: number
        maxFaqs: number
        allowedTemplates: string[]
    }
}

const R2_BASE = 'https://pub-2e9e6b5e0c6e4e8e8e8e8e8e8e8e8e8e.r2.dev'

export default function PublicProfile() {
    const { slug } = useParams()
    const [data, setData] = useState<PublicData | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorStatus, setErrorStatus] = useState<number | null>(null)
    const [shareToast, setShareToast] = useState(false)

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
            body: JSON.stringify({ profileId, eventType, targetId })
        })
    }

    const handleShare = async () => {
        const profileUrl = `${window.location.origin}/${slug}`
        const displayName = data?.name || slug || ''
        const shareText = `Mirá el perfil de ${displayName} en INTAP LINK`

        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: displayName, text: shareText, url: profileUrl })
            } catch {
                // usuario canceló — sin error visible
            }
        } else {
            try {
                await navigator.clipboard.writeText(profileUrl)
            } catch {
                // clipboard no disponible en este contexto
            }
            setShareToast(true)
            setTimeout(() => setShareToast(false), 2000)
            const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${profileUrl}`)}`
            window.open(waUrl, '_blank', 'noopener')
        }
    }

    if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>
    if (errorStatus === 403) return <PrivateBlock slug={slug || ''} />
    if (errorStatus || !data) return <NotFound />

    const whatsappLinks = data.links.filter(l => l.type === 'whatsapp')
    const phoneLinks = data.links.filter(l => l.type === 'phone')
    const otherLinks = data.links.filter(l => l.type !== 'whatsapp' && l.type !== 'phone')

    return (
        <div className="min-h-screen bg-intap-dark flex justify-center items-start pt-12 pb-20 px-4">
            <div className="w-full max-width-mobile text-center animate-fade-in">

                {/* Header: Avatar, Nombre, Bio */}
                <div className="mb-8">
                    <div className="w-24 h-24 rounded-full mx-auto mb-6 border-2 border-intap-mint p-1 shadow-[0_0_20px_rgba(13,242,201,0.3)] bg-intap-card flex items-center justify-center overflow-hidden">
                        {data.avatar ? (
                            <img
                                src={`${R2_BASE}/${data.avatar}`}
                                alt={data.name || ''}
                                className="w-full h-full object-cover rounded-full"
                            />
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

                {/* CTA Principal: Guardar Contacto (vCard) */}
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

                {/* Links por tipo */}
                <div className="grid grid-cols-1 gap-3 mb-8">

                    {/* WhatsApp (tipo whatsapp — verde, ancho completo) */}
                    {whatsappLinks.map(link => (
                        <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 bg-[#25D366] text-white font-bold py-4 rounded-3xl transition-transform hover:scale-[1.01] active:scale-95"
                            onClick={() => trackEvent(data.profileId, 'click', link.id)}
                        >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            {link.label}
                        </a>
                    ))}

                    {/* Teléfono (tipo phone — ancho completo, ícono teléfono) */}
                    {phoneLinks.map(link => (
                        <a
                            key={link.id}
                            href={link.url}
                            className="flex items-center justify-center gap-3 bg-intap-card border border-white/10 text-white font-bold py-4 rounded-3xl transition-transform hover:scale-[1.01] active:scale-95 hover:border-intap-mint/40"
                            onClick={() => trackEvent(data.profileId, 'click', link.id)}
                        >
                            <svg className="h-5 w-5 text-intap-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {link.label}
                        </a>
                    ))}

                    {/* Otros enlaces: social, email, link (grid 2 cols) */}
                    {otherLinks.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {otherLinks.map(link => (
                                <a
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 py-3 px-2 rounded-2xl glass-card text-sm font-semibold text-white/90 hover:bg-white/10 transition-all active:scale-95"
                                    onClick={() => trackEvent(data.profileId, 'click', link.id)}
                                >
                                    {link.type === 'social' && (
                                        <svg className="h-4 w-4 text-intap-mint flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                    )}
                                    {link.type === 'email' && (
                                        <svg className="h-4 w-4 text-intap-mint flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    )}
                                    <span className="truncate">{link.label}</span>
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* Botón Compartir Perfil */}
                <div className="relative mb-8">
                    <button
                        onClick={handleShare}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-all active:scale-95"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Compartir perfil
                    </button>
                    {shareToast && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-intap-mint text-black text-xs font-bold px-4 py-2 rounded-full shadow-lg whitespace-nowrap animate-fade-in">
                            Enlace copiado ✓
                        </div>
                    )}
                </div>

                {/* FAQs Accordion */}
                {data.faqs && data.faqs.length > 0 && (
                    <div className="text-left mb-8">
                        <div className="flex flex-col gap-3">
                            {data.faqs.map((faq, i) => (
                                <details key={i} className="group glass-card overflow-hidden">
                                    <summary className="flex items-center justify-between p-4 cursor-pointer list-none font-bold text-sm">
                                        {faq.question}
                                        <svg className="h-4 w-4 transition-transform group-open:rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                {data.gallery && data.gallery.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-10">
                        {data.gallery.map((img, i) => (
                            <div key={i} className="aspect-square rounded-xl overflow-hidden glass-card">
                                <img src={`${R2_BASE}/${img.image_key}`} className="w-full h-full object-cover" alt="Galería" />
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
