import { useState } from 'react'
import { Link } from 'react-router-dom'

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

const TOP100_NOTE = '🏆 Los primeros 100 inscritos reciben 1 mes Premium gratis.'

// ─── Input styles ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '0.6rem',
  padding: '0.75rem 1rem',
  color: '#fff',
  fontSize: '0.9rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle = (hasValue: boolean): React.CSSProperties => ({
  ...inputStyle,
  background: '#131c2e',
  color: hasValue ? '#fff' : '#64748b',
  cursor: 'pointer',
})

// ─── WaitlistModal ────────────────────────────────────────────────────────────
function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError(null)
    if (!name.trim() || name.trim().length < 2) { setError('Por favor escribe tu nombre.'); return }
    if (!sector) { setError('Selecciona tu sector.'); return }
    if (!mode) { setError('Selecciona la modalidad.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Por favor escribe un correo válido.'); return }
    if (!whatsapp.trim()) { setError('Por favor escribe tu número de WhatsApp.'); return }

    setLoading(true)
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
      const res = await fetch(`${apiUrl}/api/v1/public/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sector,
          mode,
          email: email.trim(),
          whatsapp: whatsapp.trim(),
        }),
      })
      const json = await res.json().catch(() => ({})) as any
      if (json.ok) {
        setPosition(json.position)
      } else {
        setError(json.error || 'Error al registrarse. Intenta de nuevo.')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="glass-card"
        style={{ width: '100%', maxWidth: '440px', padding: '2rem 2rem 1.75rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
        >
          ✕
        </button>

        {/* Top100 note — siempre visible */}
        <div style={{ background: 'rgba(13,242,201,0.08)', border: '1px solid rgba(13,242,201,0.25)', borderRadius: '0.6rem', padding: '0.6rem 0.875rem', fontSize: '0.78rem', color: '#0df2c9', fontWeight: 700, marginBottom: '1.25rem' }}>
          {TOP100_NOTE}
        </div>

        {position !== null ? (
          /* ── Success state ── */
          <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
            <div style={{ fontSize: '2.75rem', marginBottom: '0.75rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>¡Estás en la lista!</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Eres el{' '}
              <strong style={{ color: '#0df2c9', fontSize: '1.75rem' }}>#{position}</strong>
              {' '}en la lista de espera.
            </p>
            {position <= 100 && (
              <div style={{ background: 'rgba(13,242,201,0.12)', border: '1px solid rgba(13,242,201,0.35)', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#0df2c9', fontWeight: 700 }}>
                Eres uno de los primeros 100 — recibirás 1 mes Premium gratis al lanzar. 🚀
              </div>
            )}
          </div>
        ) : (
          /* ── Idle / Form state ── */
          <>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.2rem' }}>Crea tu perfil digital</h2>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '1.25rem' }}>Reserva tu lugar ahora. Es gratis.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                type="text"
                placeholder="Nombre *"
                value={name}
                onChange={e => setName(e.target.value)}
                style={inputStyle}
              />
              <select
                value={sector}
                onChange={e => setSector(e.target.value)}
                style={selectStyle(!!sector)}
              >
                <option value="" disabled>Sector *</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as Mode)}
                style={selectStyle(!!mode)}
              >
                <option value="" disabled>Modalidad de trabajo *</option>
                <option value="Virtual">Virtual</option>
                <option value="Fisica">Física</option>
                <option value="Mixta">Mixta</option>
              </select>
              <input
                type="email"
                placeholder="Correo electrónico *"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
              />
              <input
                type="tel"
                placeholder="WhatsApp *"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.75rem', textAlign: 'center' }}>{error}</p>
            )}

            <button
              onClick={submit}
              disabled={loading}
              style={{
                marginTop: '1.1rem', width: '100%',
                background: loading ? 'rgba(13,242,201,0.3)' : 'linear-gradient(135deg, #0df2c9, #3b82f6)',
                border: 'none', borderRadius: '999px', padding: '0.875rem',
                color: '#030712', fontWeight: 800, fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Registrando…' : 'Reservar mi lugar gratis ✨'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── HomeLanding ──────────────────────────────────────────────────────────────
export default function HomeLanding() {
  const [modalOpen, setModalOpen] = useState(false)
  const openModal = () => setModalOpen(true)

  return (
    <div
      className="min-h-screen bg-intap-dark text-white font-['Inter'] overflow-x-hidden"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        padding: '1rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(3,7,18,0.85)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        zIndex: 200,
      }}>
        <span style={{
          fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #0df2c9, #3b82f6)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          INTAP LINK
        </span>
        <Link
          to="/juan"
          style={{
            color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600,
            textDecoration: 'none', letterSpacing: '0.01em',
          }}
        >
          Ver demo →
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={{
        width: '100%', maxWidth: '680px',
        textAlign: 'center',
        padding: 'clamp(5.5rem, 12vw, 8rem) 1.5rem clamp(3rem, 8vw, 5rem)',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(13,242,201,0.1)', border: '1px solid rgba(13,242,201,0.3)',
          borderRadius: '999px', padding: '0.35rem 0.9rem',
          fontSize: '0.72rem', fontWeight: 700, color: '#0df2c9',
          marginBottom: '1.5rem', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          🚀 Early access — cupos limitados
        </div>

        {/* H1 */}
        <h1 style={{
          fontSize: 'clamp(2.1rem, 6vw, 3.5rem)',
          fontWeight: 900, lineHeight: 1.08,
          letterSpacing: '-0.03em',
          marginBottom: '1.25rem',
        }}>
          Tu mini-web de Link-in-Bio,{' '}
          <span style={{
            background: 'linear-gradient(135deg, #0df2c9 20%, #3b82f6 80%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            reimaginada.
          </span>
        </h1>

        {/* Sub */}
        <p style={{
          color: '#94a3b8',
          fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
          lineHeight: 1.7,
          marginBottom: '2.5rem',
          maxWidth: '560px',
          margin: '0 auto 2.5rem',
        }}>
          No es otro link-in-bio. Muestra tus servicios, recibe solicitudes y cierra ventas en minutos.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={openModal}
            style={{
              background: 'linear-gradient(135deg, #0df2c9, #3b82f6)',
              border: 'none', borderRadius: '999px',
              padding: '0.9rem 1.75rem',
              color: '#030712', fontWeight: 800, fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 0 32px rgba(13,242,201,0.25)',
              letterSpacing: '-0.01em',
            }}
          >
            Crea tu perfil digital ✨
          </button>
          <Link
            to="/juan"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '999px',
              padding: '0.9rem 1.75rem',
              color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
            }}
          >
            Ver demo →
          </Link>
        </div>

        {/* Top100 note under hero */}
        <p style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: '#475569' }}>
          🏆 Los primeros <strong style={{ color: '#0df2c9' }}>100 inscritos</strong> reciben 1 mes Premium gratis
        </p>
      </section>

      {/* ── Benefits ───────────────────────────────────────────────────── */}
      <section style={{ width: '100%', maxWidth: '800px', padding: '0 1.5rem 5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}>
          {[
            {
              icon: '⚡',
              title: 'Lista en minutos',
              desc: 'Crea tu mini-web en menos de 5 minutos. Sin código, sin complicaciones.',
            },
            {
              icon: '📦',
              title: 'Servicios y catálogo',
              desc: 'Muestra lo que ofreces, con precios y fotos. Tu catálogo siempre a mano.',
            },
            {
              icon: '💬',
              title: 'Convierte en WhatsApp',
              desc: 'Cada visita puede convertirse en una consulta directo a tu WhatsApp.',
            },
          ].map(b => (
            <div
              key={b.title}
              className="glass-card"
              style={{ padding: '1.75rem 1.5rem' }}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{b.icon}</div>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.4rem' }}>{b.title}</h3>
              <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social Proof ───────────────────────────────────────────────── */}
      <section style={{ width: '100%', maxWidth: '680px', padding: '0 1.5rem 5rem', textAlign: 'center' }}>
        <p style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1.1rem' }}>
          Ideal para
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
          {[
            'Desarrolladores', 'Fotógrafos', 'Entrenadores', 'Restaurantes',
            'Consultores', 'Coaches', 'Diseñadores', 'Médicos',
            'Abogados', 'Agentes Inmobiliarios', 'Tiendas Online', 'Creativos',
          ].map(tag => (
            <span
              key={tag}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '999px',
                padding: '0.35rem 0.875rem',
                fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section style={{ width: '100%', maxWidth: '640px', padding: '0 1.5rem 5rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center' }}>Preguntas frecuentes</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            {
              q: '¿Es gratis?',
              a: 'Sí. El plan base es gratuito. Los primeros 100 en la lista de espera recibirán 1 mes del plan Premium gratis al lanzar.',
            },
            {
              q: '¿Necesito saber programar?',
              a: 'No. INTAP LINK está diseñado para que cualquier profesional o negocio pueda crear su mini-web en minutos, sin código.',
            },
            {
              q: '¿Cuándo lanza?',
              a: 'Estamos en early access. Al unirte a la lista serás de los primeros en acceder y recibirás aviso por email y WhatsApp.',
            },
            {
              q: '¿Qué puedo mostrar en mi perfil?',
              a: 'Links, servicios, catálogo de productos, galería de fotos, preguntas frecuentes y un botón directo a WhatsApp.',
            },
            {
              q: '¿Funciona en cualquier sector?',
              a: 'Sí. Está pensado para freelancers, emprendedores y pequeñas empresas en Latinoamérica de cualquier industria.',
            },
          ].map(item => (
            <FaqItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
      <section style={{
        width: '100%', maxWidth: '640px',
        padding: '0 1.5rem 6rem',
        textAlign: 'center',
      }}>
        <div
          className="glass-card"
          style={{ padding: 'clamp(2rem, 6vw, 3rem) 2rem' }}
        >
          <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.9rem)', fontWeight: 900, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            ¿Listo para crear tu perfil digital?
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
            Reserva tu lugar ahora. Es gratis y solo toma 1 minuto.
          </p>
          <button
            onClick={openModal}
            style={{
              background: 'linear-gradient(135deg, #0df2c9, #3b82f6)',
              border: 'none', borderRadius: '999px',
              padding: '0.9rem 2rem',
              color: '#030712', fontWeight: 800, fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 0 32px rgba(13,242,201,0.2)',
            }}
          >
            Crea tu perfil digital ✨
          </button>
          <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: '#475569' }}>
            Nota: Si eres de los 100 en la lista de espera, tendrás 1 mes Premium gratis.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ paddingBottom: '2rem', color: '#334155', fontSize: '0.75rem', textAlign: 'center' }}>
        © {new Date().getFullYear()} INTAP LINK · Hecho en Latinoamérica 🌎
      </footer>

      {modalOpen && <WaitlistModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

// ─── FaqItem (accordion simple) ──────────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="glass-card"
      style={{ padding: '1rem 1.25rem', cursor: 'pointer' }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{question}</span>
        <span style={{ color: '#0df2c9', fontSize: '1rem', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </div>
      {open && (
        <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.65, marginTop: '0.75rem', marginBottom: 0 }}>
          {answer}
        </p>
      )}
    </div>
  )
}
