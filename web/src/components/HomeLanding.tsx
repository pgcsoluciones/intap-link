import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// ─── Waitlist Modal ───────────────────────────────────────────────────────────

function WaitlistModal({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [email, setEmail]       = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [status, setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [position, setPosition] = useState<number | null>(null)
  const [errMsg, setErrMsg]     = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'Ingresa un email válido.'
    const wa = whatsapp.trim().replace(/\s/g, '')
    if (!/^\+?\d{7,15}$/.test(wa))
      return 'Ingresa tu WhatsApp (solo números, + opcional).'
    return null
  }

  const submit = async () => {
    const err = validate()
    if (err) { setErrMsg(err); return }
    setErrMsg('')
    setStatus('loading')

    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
      const res = await fetch(`${apiUrl}/api/v1/public/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim().replace(/\s/g, ''),
        }),
      })
      const json = await res.json() as { ok: boolean; position?: number; error?: string }
      if (json.ok) {
        setPosition(json.position ?? null)
        setStatus('success')
      } else {
        setErrMsg(json.error || 'Intenta de nuevo.')
        setStatus('error')
      }
    } catch {
      setErrMsg('Error de red. Intenta de nuevo.')
      setStatus('error')
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={handleOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Lista de espera"
    >
      <div className="bg-intap-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-white font-bold text-xl leading-tight">
              Únete a la lista de espera
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors shrink-0"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <p className="text-slate-400 text-sm mb-5">
            Te avisamos cuando tu perfil esté listo para activar.
          </p>

          {status === 'success' ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-white font-bold text-lg mb-1">
                ¡Listo! Te avisaremos cuando abras tu perfil.
              </p>
              {position !== null && (
                <p className="text-intap-mint font-semibold text-sm mt-2">
                  Eres el #{position} en la lista de espera.
                </p>
              )}
              <p className="text-slate-400 text-xs mt-4 leading-relaxed border border-intap-mint/20 bg-intap-mint/5 rounded-xl px-4 py-3">
                🏆 Si eres de los primeros 100, tendrás <strong className="text-intap-mint">1 mes Premium gratis</strong> al momento de activar tu cuenta.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setStatus('idle') }}
                className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-intap-mint/50"
              />
              <input
                type="tel"
                placeholder="+1 809 000 0000"
                value={whatsapp}
                onChange={e => { setWhatsapp(e.target.value); setStatus('idle') }}
                className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-intap-mint/50"
              />

              {errMsg && (
                <p className="text-sm text-red-400 px-1">{errMsg}</p>
              )}

              <button
                type="button"
                disabled={status === 'loading'}
                onClick={submit}
                className="w-full py-3.5 rounded-2xl bg-intap-mint text-black font-extrabold hover:brightness-110 transition-all active:scale-95 disabled:opacity-60"
              >
                {status === 'loading' ? 'Enviando...' : 'Unirme'}
              </button>

              <p className="text-slate-500 text-xs text-center leading-relaxed px-2">
                🏆 Si eres de los primeros 100, tendrás{' '}
                <span className="text-intap-mint font-semibold">1 mes Premium gratis</span>{' '}
                al activar tu cuenta.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Home Landing ─────────────────────────────────────────────────────────────

export default function HomeLanding() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-intap-dark text-white flex flex-col">

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto w-full">
        <span className="font-black text-lg tracking-tight text-intap-mint">INTAP LINK</span>
        <Link
          to="/juan"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Ver demo →
        </Link>
      </nav>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-2xl mx-auto w-full">

        <div className="inline-flex items-center gap-2 bg-intap-mint/10 border border-intap-mint/20 rounded-full px-4 py-1.5 text-xs font-semibold text-intap-mint mb-8 tracking-wide">
          🚀 Lanzamiento próximo — Lista de espera abierta
        </div>

        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
          Tu mini-web profesional.<br />
          <span className="text-intap-mint">Hecha para convertir</span><br />
          por WhatsApp.
        </h1>

        <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg">
          No es otro link-in-bio. Muestra tus servicios, recibe solicitudes y cierra ventas en minutos.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-8 py-4 rounded-2xl bg-intap-mint text-black font-extrabold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-intap-mint/20"
          >
            Únete a la lista de espera
          </button>
          <Link
            to="/juan"
            className="px-8 py-4 rounded-2xl border border-white/15 text-white/80 font-semibold text-base hover:bg-white/5 transition-colors text-center"
          >
            Ver demo
          </Link>
        </div>
      </main>

      {/* ── Benefits ── */}
      <section className="px-6 py-16 max-w-4xl mx-auto w-full">
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { icon: '⚡', title: 'Lista en minutos', body: 'Sin código, sin diseñador. Tu perfil listo para compartir en WhatsApp.' },
            { icon: '📦', title: 'Servicios y precios', body: 'Muestra lo que ofreces con precio, descripción e imagen.' },
            { icon: '💬', title: 'Convierte en WhatsApp', body: 'Cada botón lleva al cliente directo a tu WhatsApp con el mensaje correcto.' },
          ].map(({ icon, title, body }) => (
            <div key={title} className="bg-intap-card border border-white/5 rounded-2xl p-6">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="text-white font-bold text-base mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="px-6 pb-16 max-w-2xl mx-auto w-full text-center">
        <p className="text-slate-500 text-sm mb-6">Diseñado para freelancers, coaches, consultores y negocios locales</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-400">
          {['🧑‍💻 Desarrolladores', '📸 Fotógrafos', '🏋️ Entrenadores', '🍽️ Restaurantes', '🎨 Diseñadores', '🛒 Tiendas'].map(tag => (
            <span key={tag} className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5">{tag}</span>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 pb-20 text-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-10 py-4 rounded-2xl bg-intap-mint text-black font-extrabold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-intap-mint/20"
        >
          Únete a la lista de espera
        </button>
        <p className="text-slate-500 text-xs mt-3">
          🏆 Los primeros 100 → 1 mes Premium gratis
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Intap Link — Todos los derechos reservados
      </footer>

      {/* ── Modal ── */}
      {modalOpen && <WaitlistModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
