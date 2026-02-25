import { useState } from 'react'

const SECTORS = [
  'Salud y Bienestar',
  'Educación',
  'Tecnología',
  'Finanzas y Contabilidad',
  'Marketing y Publicidad',
  'Bienes Raíces',
  'Construcción',
  'Restaurantes y Gastronomía',
  'Comercio Minorista',
  'Transporte y Logística',
  'Turismo y Hospitalidad',
  'Consultoría y Servicios Profesionales',
  'Arte y Entretenimiento',
  'Belleza y Estética',
  'Derecho y Asesoría Legal',
  'Otros',
]

const MODES = ['Virtual', 'Fisica', 'Mixta'] as const
type Mode = typeof MODES[number]

function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [sector, setSector] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [status, setStatus] = useState<string | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setStatus(null)
    if (!name.trim() || name.trim().length < 2) { setStatus('Por favor escribe tu nombre.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setStatus('Por favor escribe un correo válido.'); return }
    if (!sector) { setStatus('Selecciona tu sector.'); return }
    if (!mode) { setStatus('Selecciona la modalidad.'); return }

    setLoading(true)
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
      const res = await fetch(`${apiUrl}/api/v1/public/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), whatsapp: whatsapp.trim(), sector, mode }),
      })
      const json = await res.json().catch(() => ({})) as any
      if (json.ok) {
        setPosition(json.position)
      } else {
        setStatus(json.error || 'Error al registrarse. Intenta de nuevo.')
      }
    } catch {
      setStatus('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>

        {position !== null ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>¡Estás en la lista!</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Eres el <strong style={{ color: '#0df2c9', fontSize: '1.5rem' }}>#{position}</strong> en la lista de espera.
            </p>
            {position <= 100 && (
              <div style={{ background: 'rgba(13,242,201,0.1)', border: '1px solid rgba(13,242,201,0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#0df2c9', fontWeight: 700 }}>
                🏆 Eres uno de los primeros 100 — obtendrás 1 mes Premium gratis al lanzar.
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.25rem' }}>Únete a la lista de espera</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Los primeros 100 inscritos reciben <strong style={{ color: '#0df2c9' }}>1 mes Premium gratis</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Tu nombre *"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
              />
              <input
                type="email"
                placeholder="Correo electrónico *"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
              />
              <input
                type="tel"
                placeholder="WhatsApp (opcional)"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
              />
              <select
                value={sector}
                onChange={e => setSector(e.target.value)}
                style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: sector ? '#fff' : '#64748b', fontSize: '0.9rem', outline: 'none' }}
              >
                <option value="" disabled>Sector *</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as Mode)}
                style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: mode ? '#fff' : '#64748b', fontSize: '0.9rem', outline: 'none' }}
              >
                <option value="" disabled>Modalidad de trabajo *</option>
                <option value="Virtual">Virtual</option>
                <option value="Fisica">Física</option>
                <option value="Mixta">Mixta</option>
              </select>
            </div>

            {status && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.75rem', textAlign: 'center' }}>{status}</p>
            )}

            <button
              onClick={submit}
              disabled={loading}
              style={{ marginTop: '1.25rem', width: '100%', background: 'linear-gradient(135deg, #0df2c9, #3b82f6)', border: 'none', borderRadius: '999px', padding: '0.875rem', color: '#030712', fontWeight: 800, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Registrando...' : 'Reservar mi lugar ✨'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function HomeLanding() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center justify-center px-4 overflow-x-hidden">
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(3,7,18,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 100 }}>
        <span style={{ fontWeight: 900, fontSize: '1.1rem', background: 'linear-gradient(135deg, #0df2c9, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          INTAP LINK
        </span>
        <button
          onClick={() => setModalOpen(true)}
          style={{ background: 'rgba(13,242,201,0.1)', border: '1px solid rgba(13,242,201,0.3)', color: '#0df2c9', borderRadius: '999px', padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >
          Unirse a la lista
        </button>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: '640px', paddingTop: '6rem', paddingBottom: '4rem' }}>
        <div style={{ display: 'inline-block', background: 'rgba(13,242,201,0.1)', border: '1px solid rgba(13,242,201,0.3)', borderRadius: '999px', padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#0df2c9', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>
          🚀 PRÓXIMAMENTE · EARLY ACCESS
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.25rem' }}>
          Tu perfil digital<br />
          <span style={{ background: 'linear-gradient(135deg, #0df2c9, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            todo en uno
          </span>
        </h1>

        <p style={{ color: '#94a3b8', fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Una sola URL para compartir tus links, productos, contacto y mucho más.
          Diseñado para profesionales y negocios en Latinoamérica.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setModalOpen(true)}
            style={{ background: 'linear-gradient(135deg, #0df2c9, #3b82f6)', border: 'none', borderRadius: '999px', padding: '1rem 2rem', color: '#030712', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 0 30px rgba(13,242,201,0.3)' }}
          >
            Reservar mi lugar gratis ✨
          </button>
          <a
            href="/juan"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', padding: '1rem 2rem', color: '#fff', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}
          >
            Ver demo →
          </a>
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          🏆 Los primeros <strong style={{ color: '#0df2c9' }}>100 inscritos</strong> reciben 1 mes Premium gratis
        </p>
      </div>

      {/* Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', maxWidth: '800px', width: '100%', paddingBottom: '4rem' }}>
        {[
          { icon: '🔗', title: 'Links Ilimitados', desc: 'Comparte todos tus enlaces en un solo lugar' },
          { icon: '📇', title: 'vCard Digital', desc: 'Tus contactos pueden guardarte con un tap' },
          { icon: '📦', title: 'Catálogo de Productos', desc: 'Muestra y vende directamente desde tu perfil' },
          { icon: '📊', title: 'Analytics Real', desc: 'Conoce cuántas personas visitan tu perfil' },
        ].map(f => (
          <div key={f.title} className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{f.icon}</div>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{f.title}</h3>
            <p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {modalOpen && <WaitlistModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
