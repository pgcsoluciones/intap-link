import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface Entitlements {
    maxLinks: number
    maxPhotos: number
    maxFaqs: number
    canUseVCard: boolean
}

interface ProfileData {
    id: string
    slug: string
    name: string
    bio: string
    theme_id: string
    avatar_url: string | null
    is_published: boolean
    links: any[]
    faqs: any[]
    gallery: any[]
    entitlements: Entitlements
}

interface UserSession {
    name: string
    slug: string
    avatarUrl: string | null
    plan: string
    status: 'active' | 'trial' | 'expired'
    daysLeft: number
    entitlements: Entitlements
}

const THEMES = [
    { id: 'classic', name: 'Classic Dark', preview: 'bg-intap-dark' },
    { id: 'mint', name: 'Modern Mint', preview: 'bg-[#0d1a15]' },
    { id: 'light', name: 'Clean Light', preview: 'bg-slate-100' }
]

export default function Dashboard() {
    const [session, setSession] = useState<UserSession | null>(null)
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const apiUrl = import.meta.env.VITE_API_URL || ''

    const [showLoginModal, setShowLoginModal] = useState(false)
    const [loginEmail, setLoginEmail] = useState('fliaprince@gmail.com')
    const [authenticating, setAuthenticating] = useState(false)

    useEffect(() => {
        initDashboard()
    }, [])

    const initDashboard = async () => {
        setLoading(true)
        try {
            // Paso 1: Obtener identidad y plan basada en Cookie HttpOnly
            const resMe = await fetch(`${apiUrl}/api/v1/me`, {
                credentials: 'include'
            })
            const jsonMe = await resMe.json()
            if (jsonMe.ok) {
                setSession(jsonMe.data)

                // Extraer el profileId si es posible (en v1/me no viene el profileId, necesitamos agregarlo o usar profile/me/slug)
                // Por ahora, como el API /me no devuelve el id explícito del perfil, ajustaremos ambos: el frontend para esperar el profileId y el backend para enviarlo.
                // Usaremos session.id (que agregaremos al backend) para consultar las cosas de profile
                const pId = jsonMe.data.profileId || 'profile_debug'

                // Paso 2: Obtener datos de edición (Contextual)
                const resProfile = await fetch(`${apiUrl}/api/v1/profile/me/${pId}`, { credentials: 'include' })
                const jsonProfile = await resProfile.json()
                if (jsonProfile.ok) setProfile(jsonProfile.data)

                setShowLoginModal(false)
            } else if (resMe.status === 401) {
                // No autorizado, requiere trigger de cookie manual
                setShowLoginModal(true)
                setError(null)
            } else {
                setError(jsonMe.error || 'No autorizado o sesión expirada.')
            }
        } catch (e) {
            setError('Error de conexión con INTAP Node.')
        } finally {
            setLoading(false)
        }
    }

    const handleMockLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setAuthenticating(true)
        try {
            const res = await fetch(`${apiUrl}/api/v1/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: loginEmail, code: '123456' })
            })
            const data = await res.json()
            if (data.ok) {
                // Ya la cookie HttpOnly debe estar seteada, recargamos UI
                await initDashboard()
            } else {
                alert('Error al iniciar: ' + data.error)
            }
        } catch (err) {
            console.error('Login error', err)
        } finally {
            setAuthenticating(false)
        }
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !profile) return

        setAvatarPreview(URL.createObjectURL(file))
        setUploadingAvatar(true)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('profileId', profile.id)

        try {
            const res = await fetch(`${apiUrl}/api/v1/profile/avatar/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            })
            const json = await res.json()
            if (json.ok) {
                setProfile(prev => prev ? { ...prev, avatar_url: json.url } : null)
                setMessage('✓ Avatar actualizado')
            }
        } finally {
            setUploadingAvatar(false)
        }
    }

    const saveSettings = async () => {
        if (!profile) return
        setSaving(true)
        setMessage('')
        try {
            const res = await fetch(`${apiUrl}/api/v1/profile/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    profileId: profile.id,
                    name: profile.name,
                    bio: profile.bio,
                    themeId: profile.theme_id,
                    isPublished: profile.is_published,
                    avatarUrl: profile.avatar_url
                })
            })
            if (res.ok) {
                setMessage('✓ Configuración guardada correctamente')
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (e) {
            setMessage('⚠ Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    // --- Modal Login de Prueba (Placeholder hasta que haya App UI Completa) ---
    if (showLoginModal) {
        return (
            <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex items-center justify-center p-6">
                <form onSubmit={handleMockLogin} className="bg-white/5 border border-white/10 p-8 rounded-3xl w-full max-w-sm backdrop-blur-xl flex flex-col gap-6 animate-fade-in">
                    <div className="text-center">
                        <h2 className="text-2xl font-black italic mb-2 tracking-tighter bg-gradient-to-r from-intap-mint to-intap-blue bg-clip-text text-transparent">SESIÓN REQUERIDA</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Etapa 4.5 HttpOnly Test</p>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2 block">Email Real (Test DB)</label>
                        <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-sm font-bold outline-none focus:border-intap-mint transition-colors" />
                    </div>
                    <button type="submit" disabled={authenticating} className="bg-intap-mint text-intap-dark font-black py-4 rounded-xl shadow-[0_4px_20px_rgba(13,242,201,0.2)] disabled:opacity-50 mt-2 uppercase text-xs tracking-widest hover:scale-[1.02] transition-transform">
                        {authenticating ? 'Autenticando...' : 'Obtener Cookie de Sesión'}
                    </button>
                    <p className="text-[10px] text-center text-slate-500 font-bold italic">Se usará PIN quemado '123456'</p>
                </form>
            </div>
        )
    }

    // --- Modal Login de Prueba (Placeholder hasta que haya App UI Completa) ---
    if (showLoginModal) {
        return (
            <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex items-center justify-center p-6">
                <form onSubmit={handleMockLogin} className="bg-white/5 border border-white/10 p-8 rounded-3xl w-full max-w-sm backdrop-blur-xl flex flex-col gap-6 animate-fade-in">
                    <div className="text-center">
                        <h2 className="text-2xl font-black italic mb-2 tracking-tighter bg-gradient-to-r from-intap-mint to-intap-blue bg-clip-text text-transparent">SESIÓN REQUERIDA</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Etapa 4.5 HttpOnly Test</p>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2 block">Email Real (Test DB)</label>
                        <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-sm font-bold outline-none focus:border-intap-mint transition-colors" />
                    </div>
                    <button type="submit" disabled={authenticating} className="bg-intap-mint text-intap-dark font-black py-4 rounded-xl shadow-[0_4px_20px_rgba(13,242,201,0.2)] disabled:opacity-50 mt-2 uppercase text-xs tracking-widest hover:scale-[1.02] transition-transform">
                        {authenticating ? 'Autenticando...' : 'Obtener Cookie de Sesión'}
                    </button>
                    <p className="text-[10px] text-center text-slate-500 font-bold italic">Se usará PIN quemado '123456'</p>
                </form>
            </div>
        )
    }

    if (loading) return <div className="flex items-center justify-center h-screen bg-intap-dark text-intap-mint font-black italic animate-pulse tracking-widest text-center px-6">CARGANDO INTAP ENGINE...</div>
    if (error) return <div className="p-10 text-red-400 bg-intap-dark min-h-screen text-center flex flex-col items-center justify-center gap-4 px-6"><h2 className="text-2xl font-black italic">CONEXIÓN PERDIDA</h2><p className="opacity-60 text-sm">{error}</p><button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase">Reintentar</button></div>

    return (
        <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col lg:flex-row overflow-x-hidden">
            <aside className="!hidden lg:!flex w-72 bg-white/5 backdrop-blur-2xl border-r border-white/5 p-8 flex-col gap-3 shrink-0">
                <div className="text-2xl font-black mb-12 tracking-tighter bg-gradient-to-r from-intap-mint to-intap-blue bg-clip-text text-transparent">
                    INTAP LINK
                </div>
                <div className="nav-item bg-white/10 text-white font-bold cursor-pointer flex items-center gap-3 p-4 rounded-xl border border-white/5">
                    <svg className="w-5 h-5 text-intap-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Dashboard
                </div>
                <div className="mt-auto pt-4 border-t border-white/5">
                    <Link to="/admin" className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-black">Super Admin Access</Link>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-gradient-to-br from-intap-dark to-[#080c18] flex flex-col relative">
                <header className="sticky top-0 z-50 bg-intap-dark/80 backdrop-blur-xl border-b border-white/5 px-3 py-3 lg:px-12 lg:py-6">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 lg:gap-4">
                        <div className="flex items-center gap-2 lg:gap-4 truncate">
                            {/* Botón Hamburguesa */}
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="lg:hidden p-2 bg-white/5 border border-white/10 rounded-xl text-intap-mint"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                            </button>

                            <div className="lg:hidden shrink-0 text-lg font-black tracking-tighter bg-gradient-to-r from-intap-mint to-intap-blue bg-clip-text text-transparent">
                                INTAP
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h1 className="text-base lg:text-3xl font-black italic tracking-tight leading-none truncate mb-1">
                                    {session?.name || 'Usuario'}
                                </h1>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`shrink-0 px-2 py-0.5 rounded-full text-[7px] lg:text-[10px] font-black uppercase tracking-widest ${session?.status === 'active' ? 'bg-intap-mint/10 text-intap-mint border border-intap-mint/20' :
                                        session?.status === 'trial' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/20' :
                                            'bg-red-500/10 text-red-500 border border-red-500/20'
                                        }`}>
                                        {session?.plan} • {session?.status}
                                    </div>
                                    {session?.status === 'trial' && (
                                        <span className="shrink-0 text-[7px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                                            {session.daysLeft}d restantes
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            {session && (
                                <a href={`/${session.slug}`} target="_blank" className="bg-white/5 border border-white/10 p-2 lg:px-6 lg:py-3 rounded-full text-[10px] lg:text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                                    <span className="hidden lg:inline">Ver Perfil Público</span>
                                    <svg className="w-4 h-4 lg:w-3 lg:h-3 text-intap-mint lg:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                            )}
                        </div>
                    </div>
                </header>

                <div className="p-3 md:p-6 lg:p-12 max-w-4xl mx-auto w-full">
                    {message && (
                        <div className="mb-6 bg-intap-mint/10 text-intap-mint p-4 rounded-2xl border border-intap-mint/20 text-sm font-bold animate-fade-in text-center backdrop-blur-md">
                            {message}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 mb-12">
                        <section className="bg-white/5 backdrop-blur-md border border-white/10 p-5 md:p-8 rounded-[32px] relative overflow-hidden">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 lg:mb-8 flex items-center gap-2">
                                <span className="w-2 h-2 bg-intap-mint rounded-full"></span> Información General
                            </h3>
                            <div className="flex flex-col gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="relative group">
                                        <div className="w-24 h-24 rounded-full border-2 border-white/10 overflow-hidden bg-white/5 flex items-center justify-center">
                                            {avatarPreview || profile?.avatar_url ? (
                                                <img src={avatarPreview || profile?.avatar_url || ''} className="w-full h-full object-cover" alt="Avatar" />
                                            ) : (
                                                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            )}
                                        </div>
                                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                                            <input type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" />
                                            <span className="text-[10px] font-bold text-white uppercase">{uploadingAvatar ? '...' : 'Subir'}</span>
                                        </label>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold">Tu Imagen de Perfil</h4>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-widest">Avatar Público</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 block tracking-widest">Nombre Público</label>
                                    <input
                                        type="text"
                                        value={profile?.name || ''}
                                        onChange={e => setProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-intap-mint/50 outline-none transition-all font-bold placeholder:text-slate-700"
                                        placeholder="Ej: Juan Luis Pérez"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 block tracking-widest">Biografía Profesional</label>
                                    <textarea
                                        value={profile?.bio || ''}
                                        onChange={e => setProfile(prev => prev ? { ...prev, bio: e.target.value } : null)}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-intap-mint/50 outline-none transition-all h-32 resize-none placeholder:text-slate-700"
                                        placeholder="Cuéntale al mundo qué haces..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-4 block tracking-widest">Selector de Tema</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-3 lg:gap-4 overflow-x-hidden md:overflow-x-auto pb-2 custom-scrollbar">
                                        {THEMES.map(theme => (
                                            <button
                                                key={theme.id}
                                                onClick={() => setProfile(prev => prev ? { ...prev, theme_id: theme.id } : null)}
                                                className={`p-2 rounded-2xl border transition-all ${profile?.theme_id === theme.id ? 'border-intap-mint bg-intap-mint/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                                            >
                                                <div className={`w-full aspect-video rounded-lg mb-2 ${theme.preview}`}></div>
                                                <p className="text-[9px] font-black uppercase text-center">{theme.name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={saveSettings}
                                    disabled={saving}
                                    className="bg-gradient-to-r from-intap-mint to-intap-blue text-intap-dark font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_30px_rgba(13,242,201,0.15)] disabled:opacity-50 mt-4 uppercase text-xs tracking-[0.1em]"
                                >
                                    {saving ? 'PROCESANDO...' : 'GUARDAR CAMBIOS'}
                                </button>
                            </div>
                        </section>

                        <div className="flex flex-col gap-8">
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 md:p-8 rounded-[32px] bg-gradient-to-br from-white/5 to-intap-blue/5 border-l-4 border-intap-mint">
                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-[0.2em]">Estado del Perfil</p>
                                <div className="flex justify-between items-center gap-2 lg:gap-4">
                                    <div className="inline-flex items-center gap-1 lg:gap-2 bg-intap-mint/10 text-intap-mint text-[8px] lg:text-[9px] font-black px-2 lg:px-3 py-1.5 lg:py-2 rounded-full border border-intap-mint/20 uppercase whitespace-nowrap">
                                        Perfeccionado <span>✨</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-2xl lg:text-3xl font-black italic tracking-tighter">4.8K</p>
                                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Visitas</p>
                                    </div>
                                </div>
                            </div>
                            {profile && <GalleryManager profileId={profile.id} initialPhotos={profile.gallery || []} />}
                        </div>
                    </div>

                    <div className="mb-8">
                        {profile && <LinkManager profileId={profile.id} initialLinks={profile.links || []} />}
                    </div>

                    <div className="mb-20">
                        {profile && <LeadsManager profileId={profile.id} />}
                    </div>
                </div>
            </main>

            {/* OVERLAY MENÚ MÓVIL (Opción A) */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[60] lg:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
                    <nav className="absolute left-0 top-0 bottom-0 w-80 bg-intap-dark/95 backdrop-blur-3xl border-r border-white/10 p-8 flex flex-col gap-4 animate-slide-in-left shadow-2xl">
                        <div className="flex items-center justify-between mb-12">
                            <div className="text-xl font-black tracking-tighter bg-gradient-to-r from-intap-mint to-intap-blue bg-clip-text text-transparent">
                                INTAP LINK
                            </div>
                            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-white/5 rounded-full border border-white/10">
                                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="bg-white/10 text-white font-bold flex items-center gap-3 p-4 rounded-xl border border-white/10">
                            <svg className="w-5 h-5 text-intap-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Dashboard
                        </div>
                        <div className="text-slate-500 font-bold flex items-center gap-3 p-4 rounded-xl border border-transparent opacity-50">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Próximamente
                        </div>
                        <div className="mt-auto pt-4 border-t border-white/5">
                            <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-black">Super Admin Access</Link>
                        </div>
                    </nav>
                </div>
            )}
        </div>
    )
}

function LinkManager({ profileId, initialLinks }: { profileId: string, initialLinks: any[] }) {
    const [links, setLinks] = useState(initialLinks || [])
    const [newLabel, setNewLabel] = useState('')
    const [newUrl, setNewUrl] = useState('')
    const [adding, setAdding] = useState(false)
    const apiUrl = import.meta.env.VITE_API_URL || ''

    useEffect(() => { setLinks(initialLinks || []) }, [initialLinks])

    const addLink = async () => {
        if (!newLabel || !newUrl) return
        setAdding(true)
        try {
            const res = await fetch(`${apiUrl}/api/v1/profile/links`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ profileId, label: newLabel, url: newUrl })
            })
            const json = await res.json()
            if (json.ok) {
                setLinks([...links, { id: json.id, label: newLabel, url: newUrl }])
                setNewLabel(''); setNewUrl('')
            }
        } finally {
            setAdding(false)
        }
    }

    const deleteLink = async (id: string) => {
        try {
            const res = await fetch(`${apiUrl}/api/v1/profile/links/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            if (res.ok) setLinks(links.filter(l => l.id !== id))
        } catch (e) {
            console.error('Error al eliminar link')
        }
    }

    return (
        <section className="bg-white/5 backdrop-blur-md border border-white/10 p-5 md:p-8 rounded-[32px]">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                <span className="w-2 h-2 bg-intap-blue rounded-full"></span> Mis Enlaces
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {links.map(l => (
                    <div key={l.id} className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5 group hover:border-white/10 transition-all hover:bg-white/[0.07]">
                        <div className="truncate px-2">
                            <p className="text-sm font-bold text-white truncate">{l.label}</p>
                            <p className="text-[9px] text-slate-500 truncate mt-1">{l.url}</p>
                        </div>
                        <button onClick={() => deleteLink(l.id)} className="text-red-500/30 hover:text-red-500 transition-colors p-2 bg-red-500/5 rounded-xl lg:opacity-0 group-hover:opacity-100">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                ))}
                {links.length === 0 && <p className="text-xs text-slate-500 text-center py-10 col-span-2 italic">Aún no has definido tus puntos de contacto.</p>}
            </div>

            <div className="bg-white/5 p-6 lg:p-8 rounded-[32px] border border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-[0.2em]">Añadir Puntos de Contacto</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        className="bg-intap-dark/50 border border-white/10 p-4 rounded-2xl text-[11px] outline-none focus:border-intap-blue/50 font-bold"
                        placeholder="Nombre (ej: Instagram)"
                    />
                    <input
                        type="text"
                        value={newUrl}
                        onChange={e => setNewUrl(e.target.value)}
                        className="bg-intap-dark/50 border border-white/10 p-4 rounded-2xl text-[11px] outline-none focus:border-intap-blue/50 font-bold"
                        placeholder="https://..."
                    />
                </div>
                <button
                    onClick={addLink}
                    disabled={adding}
                    className="w-full mt-4 bg-white/5 border border-white/10 text-white font-black py-4 rounded-2xl text-xs hover:bg-white/10 transition-all uppercase tracking-widest"
                >
                    {adding ? '...' : '+ REGISTRAR ENLACE'}
                </button>
            </div>
        </section>
    )
}

function GalleryManager({ profileId, initialPhotos }: { profileId: string, initialPhotos: any[] }) {
    const [photos, setPhotos] = useState(initialPhotos || [])
    const [uploading, setUploading] = useState(false)
    const apiUrl = import.meta.env.VITE_API_URL || ''
    const r2PublicUrl = 'https://pub-2e9e6b5e0c6e4e8e8e8e8e8e8e8e8e8e.r2.dev'

    useEffect(() => { setPhotos(initialPhotos || []) }, [initialPhotos])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('profileId', profileId)

        try {
            const res = await fetch(`${apiUrl}/api/v1/profile/gallery/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            })
            const json = await res.json()
            if (json.ok) {
                setPhotos([...photos, { image_key: json.key }])
            }
        } finally {
            setUploading(false)
        }
    }

    return (
        <section className="bg-white/5 backdrop-blur-md border border-white/10 p-5 md:p-8 rounded-[32px]">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span> Galería Visual
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4 mb-8">
                {photos.map((p, i) => (
                    <div key={i} className="aspect-square bg-white/5 rounded-xl lg:rounded-2xl overflow-hidden border border-white/10 group relative shadow-2xl">
                        <img
                            src={`${r2PublicUrl}/${p.image_key}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            alt="Gallery"
                        />
                    </div>
                ))}
            </div>
            <label className="flex flex-col items-center justify-center bg-white/5 border-2 border-dashed border-white/10 p-6 lg:p-10 rounded-3xl cursor-pointer hover:bg-white/10 transition-all hover:border-white/20">
                <input type="file" className="hidden" onChange={handleUpload} accept="image/*" disabled={uploading} />
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-4 h-4 lg:w-5 lg:h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{uploading ? 'PROCESANDO...' : 'AÑADIR FOTO'}</p>
            </label>
        </section>
    )
}

function LeadsManager({ profileId }: { profileId: string }) {
    const [leads, setLeads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const apiUrl = import.meta.env.VITE_API_URL || ''

    useEffect(() => {
        fetchLeads()
    }, [profileId])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${apiUrl}/api/v1/profile/me/${profileId}/leads`, { credentials: 'include' })
            const json = await res.json()
            if (json.ok) setLeads(json.data)
        } catch (e) {
            console.error('Error fetching leads:', e)
        } finally {
            setLoading(false)
        }
    }

    const updateLeadStatus = async (leadId: string, newStatus: string) => {
        setUpdating(leadId)
        try {
            const res = await fetch(`${apiUrl}/api/v1/profile/me/${profileId}/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) {
                setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
            }
        } finally {
            setUpdating(null)
        }
    }

    const exportCsvUrl = `${apiUrl}/api/v1/profile/me/${profileId}/leads/export`

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-intap-blue/10 text-intap-blue border-intap-blue/20'
            case 'contacted': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            case 'closed': return 'bg-intap-mint/10 text-intap-mint border-intap-mint/20'
            case 'discarded': return 'bg-red-500/10 text-red-500 border-red-500/20'
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
        }
    }

    return (
        <section className="bg-white/5 backdrop-blur-md border border-white/10 p-5 md:p-8 rounded-[32px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span> Mis Contactos Recibidos
                </h3>

                <a
                    href={exportCsvUrl}
                    target="_blank"
                    className="shrink-0 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold text-white uppercase tracking-widest hover:bg-white/10 transition flex items-center gap-2"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Exportar CSV
                </a>
            </div>

            {loading ? (
                <div className="text-center py-10 text-xs font-black uppercase tracking-widest text-slate-500 animate-pulse">Cargando leads...</div>
            ) : leads.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 italic">No tienes contactos registrados todavía.</div>
            ) : (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Contacto</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Métricas</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map(lead => (
                                <tr key={lead.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4">
                                        <p className="text-sm font-bold text-white mb-1">{lead.name}</p>
                                        <p className="text-[10px] text-slate-400">{lead.email}</p>
                                        {lead.phone && <p className="text-[10px] text-slate-500 mt-1">{lead.phone}</p>}
                                    </td>
                                    <td className="p-4">
                                        <p className="text-[10px] text-slate-400 max-w-[200px] truncate mb-2" title={lead.message}>
                                            "{lead.message}"
                                        </p>
                                        <div className="flex gap-2">
                                            <span className="text-[8px] uppercase tracking-widest px-2 py-0.5 rounded border border-white/10 text-slate-500 bg-white/5">{lead.origin || 'Web'}</span>
                                            <span className="text-[8px] uppercase tracking-widest px-2 py-0.5 rounded text-slate-600">
                                                {new Date(lead.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <select
                                            value={lead.status}
                                            onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                                            disabled={updating === lead.id}
                                            className={`text-[9px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 border appearance-none text-center cursor-pointer outline-none transition-colors ${getStatusColor(lead.status)}`}
                                        >
                                            <option value="new">Nuevo</option>
                                            <option value="contacted">En Proceso</option>
                                            <option value="closed">Cerrado</option>
                                            <option value="discarded">Descartado</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
