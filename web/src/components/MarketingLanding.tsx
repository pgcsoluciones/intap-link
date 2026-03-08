import { useEffect } from 'react'

type IconName = 'spark' | 'layout' | 'target' | 'check' | 'briefcase' | 'store' | 'rocket' | 'chat' | 'arrow' | 'bolt'

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'spark':
      return <svg {...common}><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" /></svg>
    case 'layout':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M9 20V10" /></svg>
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M2 12h2" /></svg>
    case 'check':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.3 2.3 4.7-5.1" /></svg>
    case 'briefcase':
      return <svg {...common}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" /><path d="M3 12h18" /></svg>
    case 'store':
      return <svg {...common}><path d="M4 10h16" /><path d="M5 10V7l1.5-2h11L19 7v3" /><rect x="6" y="10" width="12" height="9" rx="1.8" /></svg>
    case 'rocket':
      return <svg {...common}><path d="M14 4c3.7.3 5.7 3 6 6-2 2.4-4.5 4.4-7.5 6l-4.5-4.5c1.6-3 3.6-5.5 6-7.5z" /><path d="m8.2 12.8-2.7.8.9-2.8" /></svg>
    case 'chat':
      return <svg {...common}><path d="M6 18.5h7.5l4.5 2v-2A3.5 3.5 0 0 0 21.5 15V8A3.5 3.5 0 0 0 18 4.5H6A3.5 3.5 0 0 0 2.5 8v7A3.5 3.5 0 0 0 6 18.5z" /><path d="M7 9h10" /></svg>
    case 'arrow':
      return <svg {...common}><path d="M4 12h16" /><path d="m13 6 7 6-7 6" /></svg>
    case 'bolt':
      return <svg {...common}><path d="M13 2 5 13h5l-1 9 8-11h-5z" /></svg>
    default:
      return null
  }
}

const benefits = [
  'Tu enlace se ve profesional desde el primer vistazo.',
  'Tu propuesta se entiende sin explicaciones extra.',
  'Centralizas contacto, confianza y conversión en una sola página.',
  'Puedes compartirlo en redes, QR, NFC y mensajes comerciales.',
]

const useCases = [
  { role: 'Profesionales', icon: 'briefcase' as const, text: 'Servicios, método, disponibilidad y CTA en una presentación pulida.' },
  { role: 'Emprendedores', icon: 'rocket' as const, text: 'Producto, oferta y siguiente paso en un flujo más persuasivo.' },
  { role: 'Negocios', icon: 'store' as const, text: 'Catálogo, FAQs, ubicación y WhatsApp con imagen más sólida.' },
]

const faqs = [
  { q: '¿INTAP LINK es gratis?', a: 'Sí. El plan base se mantiene gratis para siempre con funciones esenciales.' },
  { q: '¿Qué incluye la prueba premium?', a: '7 días con funciones avanzadas para personalización y presentación comercial.' },
  { q: '¿Es sólo para redes sociales?', a: 'No. También funciona en propuestas, QR impresos, WhatsApp y tarjetas NFC.' },
  { q: '¿Reemplaza mi sitio completo?', a: 'No necesariamente. Es tu mejor puerta de entrada para captar interés y contacto.' },
]

export default function MarketingLanding() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.16, rootMargin: '0px 0px -45px 0px' },
    )

    document.querySelectorAll('.reveal-on-scroll').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="marketing-shell">
      <header className="marketing-nav">
        <a href="/" className="brand">INTAP LINK</a>
        <div className="nav-ctas">
          <a href="#como-funciona" className="ghost-btn">Cómo funciona</a>
          <a href="https://app.intaprd.com/admin/login" className="primary-btn">Empezar gratis</a>
        </div>
      </header>

      <main>
        <section className="hero reveal-on-scroll">
          <div className="hero-copy">
            <p className="eyebrow">Perfil digital premium para profesionales y negocios</p>
            <h1>Tu perfil digital puede abrir oportunidades… o perderlas en segundos.</h1>
            <p>
              INTAP LINK transforma un enlace genérico en una presentación comercial clara, elegante y orientada a contacto.
              Gratis para siempre, con 7 días premium para probar funciones avanzadas.
            </p>

            <div className="hero-actions">
              <a href="https://app.intaprd.com/admin/login" className="primary-btn">Crear mi INTAP LINK</a>
              <a href="#diferencia" className="ghost-btn">Ver diferencia real</a>
            </div>

            <div className="hero-chips">
              <span><Icon name="check" /> Gratis para siempre</span>
              <span><Icon name="spark" /> 7 días premium</span>
              <span><Icon name="chat" /> Contacto directo por CTA</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-pill pill-top"><Icon name="bolt" /> Mejor primera impresión</div>
            <div className="visual-pill pill-bottom"><Icon name="target" /> Más claridad para convertir</div>

            <div className="phone-back-layer" />
            <div className="phone-side-card">
              <strong>Panel de bloques</strong>
              <small>Servicios · FAQ · Testimonios</small>
              <div className="tiny-bars"><span /><span /><span /></div>
            </div>

            <div className="phone-mockup floaty" id="demo">
              <div className="phone-notch" />
              <div className="phone-screen">
                <div className="mockup-header">
                  <div className="mini-avatar" />
                  <div>
                    <h3>Andrea López</h3>
                    <p>Nutrición clínica · online y presencial</p>
                  </div>
                </div>

                <button className="mock-cta">Agendar evaluación por WhatsApp</button>

                <div className="mock-kpis">
                  <article><strong>Servicios</strong><small>Consulta · Seguimiento</small></article>
                  <article><strong>FAQ</strong><small>Resuelve objeciones clave</small></article>
                </div>

                <div className="mock-testimonial">
                  “Ahora mis clientes llegan sabiendo exactamente cómo trabajo.”
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-soft reveal-on-scroll" id="diferencia">
          <h2>Tradicional vs INTAP: la diferencia se nota en segundos</h2>
          <p>Comparar ambos formatos deja claro por qué un perfil mejor diseñado genera mejores conversaciones.</p>

          <div className="compare-premium">
            <article className="traditional-panel">
              <h4>Perfil tradicional</h4>
              <div className="traditional-mock">
                <span>link 1</span><span>link 2</span><span>link 3</span><span>link 4</span>
              </div>
              <ul>
                <li><Icon name="arrow" /> Se ve genérico y olvidable</li>
                <li><Icon name="arrow" /> Obliga a adivinar qué haces</li>
                <li><Icon name="arrow" /> Menos intención de contacto</li>
              </ul>
            </article>

            <article className="intap-panel">
              <h4>Perfil INTAP</h4>
              <div className="intap-mock">
                <div><strong>Propuesta clara</strong><small>Qué haces y para quién</small></div>
                <div><strong>Prueba de confianza</strong><small>FAQ + testimonios</small></div>
                <div><strong>CTA directo</strong><small>WhatsApp / contacto</small></div>
              </div>
              <ul>
                <li><Icon name="check" /> Imagen profesional consistente</li>
                <li><Icon name="check" /> Mensaje claro y ordenado</li>
                <li><Icon name="check" /> Más probabilidad de conversión</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="section reveal-on-scroll">
          <h2>La solución no es “poner links”. Es guiar una decisión.</h2>
          <div className="solution-layout">
            <article className="solution-main">
              <h4><Icon name="layout" /> Arquitectura de contenido con intención</h4>
              <p>INTAP ordena tu presentación en un flujo que reduce fricción: valor, confianza y CTA.</p>
              <div className="solution-grid">
                <div><strong>Presentación</strong><small>Quién eres y cómo ayudas</small></div>
                <div><strong>Confianza</strong><small>Prueba social + FAQ</small></div>
                <div><strong>Conversión</strong><small>Siguiente paso claro</small></div>
              </div>
            </article>
            <article className="solution-side">
              <h4><Icon name="chat" /> Contacto más directo</h4>
              <p>Menos pasos para escribirte y más claridad para decidir rápido.</p>
            </article>
            <article className="solution-side">
              <h4><Icon name="target" /> Enfoque comercial</h4>
              <p>Presentas valor y propuesta sin ruido ni bloques vacíos.</p>
            </article>
          </div>
        </section>

        <section className="section section-glow pricing reveal-on-scroll">
          <h2>Empieza gratis. Prueba premium. Decide con confianza.</h2>
          <div className="pricing-grid">
            <article className="price-card free">
              <p className="tag">Gratis para siempre</p>
              <h3>Base profesional lista para compartir</h3>
              <ul>
                <li><Icon name="check" /> Perfil funcional y presentable</li>
                <li><Icon name="check" /> Bloques esenciales</li>
                <li><Icon name="check" /> Enlace único para tus canales</li>
              </ul>
              <a href="https://app.intaprd.com/admin/login" className="ghost-btn">Comenzar gratis</a>
            </article>
            <article className="price-card premium featured">
              <p className="tag">7 días premium</p>
              <h3>Funciones avanzadas para elevar percepción y respuesta</h3>
              <ul>
                <li><Icon name="spark" /> Más personalización visual</li>
                <li><Icon name="spark" /> Presentación comercial más completa</li>
                <li><Icon name="spark" /> Prueba real antes de decidir</li>
              </ul>
              <a href="https://app.intaprd.com/admin/login" className="primary-btn">Activar prueba premium</a>
            </article>
          </div>
        </section>

        <section className="section section-light reveal-on-scroll">
          <h2>Beneficios que se sienten en cada visita</h2>
          <ul className="benefits-list richer">
            {benefits.map((item) => (
              <li key={item}><Icon name="check" /> <span>{item}</span></li>
            ))}
          </ul>
        </section>

        <section className="section reveal-on-scroll">
          <h2>Casos de uso con identidad propia</h2>
          <div className="cards-grid use-cases">
            {useCases.map((item) => (
              <article key={item.role} className="card use-case">
                <div className="case-top"><Icon name={item.icon} /><span>{item.role}</span></div>
                <p>{item.text}</p>
                <div className="case-chip">Perfil más claro · mejor percepción</div>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-soft reveal-on-scroll social-proof">
          <h2>Prueba social cualitativa, sin promesas infladas</h2>
          <div className="cards-grid two-cols">
            <article className="card quote">
              <p>“Dejé de enviar enlaces sueltos. Ahora todo lo importante vive en un solo perfil que sí me representa.”</p>
              <strong>— Consultora de marca personal</strong>
            </article>
            <article className="card quote">
              <p>“Mis clientes llegan mejor orientados y las conversaciones son más directas.”</p>
              <strong>— Profesional independiente</strong>
            </article>
          </div>
        </section>

        <section className="section reveal-on-scroll" id="como-funciona">
          <h2>Cómo funciona</h2>
          <div className="steps-grid">
            <article className="step-card"><span>01</span><h4>Crea tu perfil</h4><p>Define tu presentación base en minutos.</p></article>
            <article className="step-card"><span>02</span><h4>Ordena tu propuesta</h4><p>Bloques para valor, confianza y contacto.</p></article>
            <article className="step-card"><span>03</span><h4>Comparte y convierte</h4><p>Úsalo en redes, QR, NFC y mensajes comerciales.</p></article>
          </div>
        </section>

        <section className="section reveal-on-scroll">
          <h2>Preguntas frecuentes</h2>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section final-cta reveal-on-scroll">
          <div className="final-cta-content">
            <div>
              <h2>Haz que tu enlace se vea al nivel real de tu trabajo.</h2>
              <p>Empieza gratis hoy y activa 7 días premium para comparar el impacto en tu presentación y en tus contactos.</p>
              <div className="hero-actions">
                <a href="https://app.intaprd.com/admin/login" className="primary-btn">Crear mi INTAP LINK</a>
                <a href="#demo" className="ghost-btn">Ver hero otra vez</a>
              </div>
            </div>
            <div className="cta-mini-mock">
              <div><strong>Perfil listo</strong><small>Valor + prueba + CTA</small></div>
              <div><strong>Más claridad</strong><small>Menos fricción para decidir</small></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
