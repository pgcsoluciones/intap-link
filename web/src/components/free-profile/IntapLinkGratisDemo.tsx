import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  FaAddressCard,
  FaBriefcase,
  FaChartLine,
  FaChevronDown,
  FaExternalLinkAlt,
  FaHandshake,
  FaHome,
  FaImages,
  FaInstagram,
  FaKey,
  FaLink,
  FaMapMarkerAlt,
  FaPalette,
  FaPhoneAlt,
  FaShareAlt,
  FaWhatsapp,
} from 'react-icons/fa'
import './IntapLinkGratisDemo.css'
import {
  DEMO_APPEARANCE_COLORS,
  DEMO_PROFILE,
} from './IntapLinkGratis.demo-data'
import {
  FREE_PROFILE_LIMITS,
  type FreeProfileAppearanceColors,
  type FreeProfileLayoutId,
  type FreeProfileServiceIconKey,
} from './IntapLinkGratis.types'

type LayoutDefinition = {
  id: FreeProfileLayoutId
  name: string
  description: string
  recommendedFor: string
}

const LAYOUTS: LayoutDefinition[] = [
  {
    id: 'impacto',
    name: 'Impacto',
    description: 'Portada hero con presencia visual y fotografía principal.',
    recommendedFor: 'Empresas, negocios y marcas',
  },
  {
    id: 'personal',
    name: 'Personal',
    description: 'Retrato protagonista con degradado para marca personal.',
    recommendedFor: 'Asesores, vendedores y marca personal',
  },
  {
    id: 'esencial',
    name: 'Esencial',
    description: 'Composición limpia sin fotografía de portada.',
    recommendedFor: 'Perfiles rápidos y profesionales',
  },
]

const PALETTES: Array<{
  name: string
  colors: FreeProfileAppearanceColors
}> = [
  {
    name: 'INTAP',
    colors: DEMO_APPEARANCE_COLORS,
  },
  {
    name: 'Elegante',
    colors: {
      primary: '#171717',
      secondary: '#3f3f46',
      accent: '#b18a45',
      button: '#18181b',
      background: '#f1efe9',
      surface: '#ffffff',
      text: '#18181b',
      heroGradient: '#09090b',
    },
  },
  {
    name: 'Creativa',
    colors: {
      primary: '#4c1d95',
      secondary: '#7c3aed',
      accent: '#db2777',
      button: '#7c3aed',
      background: '#f5f0ff',
      surface: '#ffffff',
      text: '#2e1065',
      heroGradient: '#3b0764',
    },
  },
  {
    name: 'Natural',
    colors: {
      primary: '#12372a',
      secondary: '#436850',
      accent: '#adbc9f',
      button: '#436850',
      background: '#eef2e8',
      surface: '#ffffff',
      text: '#12372a',
      heroGradient: '#12372a',
    },
  },
]

const COLOR_FIELDS: Array<{
  key: keyof FreeProfileAppearanceColors
  label: string
}> = [
  { key: 'primary', label: 'Color principal' },
  { key: 'secondary', label: 'Color secundario' },
  { key: 'accent', label: 'Color de resaltado' },
  { key: 'button', label: 'Botón principal' },
  { key: 'background', label: 'Fondo general' },
  { key: 'surface', label: 'Fondo de cards' },
  { key: 'text', label: 'Texto principal' },
  { key: 'heroGradient', label: 'Degradado de imagen' },
]

function isLayoutId(value?: string): value is FreeProfileLayoutId {
  return value === 'impacto' || value === 'personal' || value === 'esencial'
}

function whatsappUrl(portfolioTitle?: string) {
  const greeting = `Hola ${DEMO_PROFILE.whatsappGreetingName},`

  const message = portfolioTitle
    ? `${greeting} vi "${portfolioTitle}" en tu portafolio de INTAP LINK y me gustaría recibir más información.`
    : `${greeting} vi tu perfil en INTAP LINK y me gustaría recibir más información.`

  return `https://wa.me/${DEMO_PROFILE.phone}?text=${encodeURIComponent(message)}`
}

function serviceWhatsappUrl(serviceTitle: string) {
  const greeting = `Hola ${DEMO_PROFILE.whatsappGreetingName},`
  const message =
    `${greeting} vi el servicio "${serviceTitle}" en tu perfil de INTAP LINK y me gustaría recibir más información.`

  return `https://wa.me/${DEMO_PROFILE.phone}?text=${encodeURIComponent(message)}`
}

function renderServiceIcon(
  iconKey: FreeProfileServiceIconKey,
) {
  switch (iconKey) {
    case 'home':
      return <FaHome />

    case 'key':
      return <FaKey />

    case 'chart-line':
      return <FaChartLine />

    case 'handshake':
      return <FaHandshake />
  }
}

function DemoGallery() {
  return (
    <main className="il-free-gallery">
      <header className="il-free-gallery__header">
        <p className="il-free-eyebrow">INTAP LINK GRATIS</p>
        <h1>Tres estilos. Un solo perfil.</h1>
        <p>
          Los mismos datos se organizan de tres maneras distintas.
          El usuario podrá cambiar de plantilla y colores sin volver a
          completar su información.
        </p>
      </header>

      <section className="il-free-gallery__grid">
        {LAYOUTS.map((layout) => (
          <Link
            key={layout.id}
            to={`/demo/intap-link-gratis/${layout.id}`}
            className={`il-free-preview-card il-free-preview-card--${layout.id}`}
          >
            <div className="il-free-preview-card__screen">
              <div className="il-free-preview-card__brand">
                INTAP LINK GRATIS
              </div>

              {layout.id === 'impacto' && (
                <>
                  <div className="il-free-preview-card__hero" />
                  <div className="il-free-preview-card__avatar" />
                </>
              )}

              {layout.id === 'personal' && (
                <div className="il-free-preview-card__portrait" />
              )}

              {layout.id === 'esencial' && (
                <div className="il-free-preview-card__minimal-avatar" />
              )}

              <div className="il-free-preview-card__lines">
                <span />
                <span />
                <span />
              </div>

              <div className="il-free-preview-card__button" />

              <div className="il-free-preview-card__actions">
                <i />
                <i />
                <i />
              </div>
            </div>

            <div className="il-free-preview-card__content">
              <span className="il-free-preview-card__tag">
                {layout.recommendedFor}
              </span>
              <h2>{layout.name}</h2>
              <p>{layout.description}</p>
              <strong>Ver plantilla →</strong>
            </div>
          </Link>
        ))}
      </section>

      <aside className="il-free-gallery__note">
        <strong>Esta fase es solamente visual.</strong>
        <span>
          No modifica perfiles reales, planes, D1, registro ni Premium.
        </span>
      </aside>
    </main>
  )
}

function ProfileIdentity({ layout }: { layout: FreeProfileLayoutId }) {
  if (layout === 'impacto') {
    return (
      <section className="il-free-identity il-free-identity--impacto">
        <div className="il-free-impact-hero">
          <img src={DEMO_PROFILE.hero} alt="" />
        </div>

        <div className="il-free-impact-avatar">
          <img src={DEMO_PROFILE.portrait} alt={DEMO_PROFILE.name} />
        </div>

        <div className="il-free-identity-copy">
          <h1>{DEMO_PROFILE.name}</h1>
          <p>{DEMO_PROFILE.role}</p>
        </div>
      </section>
    )
  }

  if (layout === 'personal') {
    return (
      <section className="il-free-identity il-free-identity--personal">
        <div className="il-free-personal-portrait">
          <img src={DEMO_PROFILE.portrait} alt={DEMO_PROFILE.name} />
          <div className="il-free-personal-gradient" />
        </div>

        <div className="il-free-personal-copy">
          <span>{DEMO_PROFILE.personalBadge}</span>
          <h1>{DEMO_PROFILE.name}</h1>
          <p>{DEMO_PROFILE.role}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="il-free-identity il-free-identity--esencial">
      <div className="il-free-essential-avatar">
        <img src={DEMO_PROFILE.portrait} alt={DEMO_PROFILE.name} />
      </div>

      <div className="il-free-identity-copy">
        <h1>{DEMO_PROFILE.name}</h1>
        <p>{DEMO_PROFILE.role}</p>
      </div>
    </section>
  )
}

export default function IntapLinkGratisDemo() {
  const { layoutId } = useParams<{ layoutId?: string }>()

  const [copied, setCopied] = useState(false)
  const [linksOpen, setLinksOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [colors, setColors] = useState<FreeProfileAppearanceColors>(DEMO_APPEARANCE_COLORS)

  if (!isLayoutId(layoutId)) {
    return <DemoGallery />
  }

  const customLinks = DEMO_PROFILE.customLinks.slice(
    0,
    FREE_PROFILE_LIMITS.maxCustomLinks,
  )

  const cssVariables = {
    '--il-free-blue': colors.primary,
    '--il-free-blue-2': colors.secondary,
    '--il-free-green': colors.button,
    '--il-free-green-dark': colors.accent,
    '--il-free-ink': colors.text,
    '--il-free-page-background': colors.background,
    '--il-free-surface': colors.surface,
    '--il-free-hero-gradient': colors.heroGradient,
  } as CSSProperties

  async function copyProfileLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function shareProfile() {
    const shareData = {
      title: `${DEMO_PROFILE.name} | INTAP LINK`,
      text: `Conoce el perfil de ${DEMO_PROFILE.name}`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await copyProfileLink()
      }
    } catch {
      // El usuario puede cancelar el diálogo nativo.
    }
  }

  function downloadVCard() {
    const content = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${DEMO_PROFILE.name}`,
      `TITLE:${DEMO_PROFILE.role}`,
      `TEL:${DEMO_PROFILE.phone}`,
      `URL:${window.location.href}`,
      'END:VCARD',
    ].join('\n')

    const blob = new Blob([content], {
      type: 'text/vcard;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = DEMO_PROFILE.vcardFileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <main
      className={`il-free-page il-free-page--${layoutId}`}
      style={cssVariables}
    >
      <nav
        className="il-free-demo-nav"
        aria-label="Plantillas de demostración"
      >
        <Link to="/demo/intap-link-gratis">
          ← Plantillas
        </Link>

        <div className="il-free-demo-nav__layouts">
          {LAYOUTS.map((item) => (
            <Link
              key={item.id}
              to={`/demo/intap-link-gratis/${item.id}`}
              aria-current={item.id === layoutId ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="il-free-appearance-trigger"
          onClick={() => setAppearanceOpen((current) => !current)}
          aria-expanded={appearanceOpen}
        >
          <FaPalette />
          <span>Personalizar</span>
        </button>
      </nav>

      {appearanceOpen && (
        <aside className="il-free-appearance-panel">
          <header>
            <div>
              <strong>Personalizar perfil</strong>
              <span>Personaliza los colores corporativos.</span>
            </div>

            <button
              type="button"
              onClick={() => setAppearanceOpen(false)}
              aria-label="Cerrar configuración"
            >
              ×
            </button>
          </header>

          <div className="il-free-palette-presets">
            {PALETTES.map((palette) => (
              <button
                key={palette.name}
                type="button"
                onClick={() => setColors(palette.colors)}
              >
                <i
                  style={{
                    background: `linear-gradient(135deg, ${palette.colors.primary}, ${palette.colors.accent})`,
                  }}
                />
                <span>{palette.name}</span>
              </button>
            ))}
          </div>

          <div className="il-free-color-fields">
            {COLOR_FIELDS.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <input
                  type="color"
                  value={colors[field.key]}
                  onChange={(event) =>
                    setColors((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </aside>
      )}

      <article className="il-free-profile">
        <ProfileIdentity layout={layoutId} />

        <div className="il-free-content">
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="il-free-whatsapp"
          >
            <FaWhatsapp />
            <span>{DEMO_PROFILE.whatsappCtaLabel}</span>
          </a>

          <section
            className="il-free-quick-actions"
            aria-label="Enlaces rápidos"
          >
            <a href={`tel:+${DEMO_PROFILE.phone}`}>
              <span><FaPhoneAlt /></span>
              <strong>Llamar</strong>
            </a>

            <a
              href={DEMO_PROFILE.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span><FaInstagram /></span>
              <strong>Instagram</strong>
            </a>

            <a
              href={DEMO_PROFILE.location}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span><FaMapMarkerAlt /></span>
              <strong>Ubicación</strong>
            </a>
          </section>

          <button
            type="button"
            className="il-free-vcard"
            onClick={downloadVCard}
          >
            <FaAddressCard />
            <span>Guardar mi contacto</span>
          </button>



          <section className="il-free-section il-free-about">
            <p className="il-free-section-label">Sobre mí</p>
            <h2>{DEMO_PROFILE.aboutTitle}</h2>
            <p>{DEMO_PROFILE.bio}</p>
          </section>

          <section className="il-free-portfolio">
            <header className="il-free-portfolio__header">
              <div>
                <span><FaImages /></span>
                <div>
                  <strong>Mi portafolio</strong>
                  <small>
                    Hasta {FREE_PROFILE_LIMITS.maxPortfolioImages} imágenes
                  </small>
                </div>
              </div>

            </header>

            <div className="il-free-portfolio__viewport">
              <div className="il-free-portfolio__track">
                {[...DEMO_PROFILE.portfolio, ...DEMO_PROFILE.portfolio].map(
                  (item, index) => (
                    <a
                      key={`${item.id}-${index}`}
                      href={whatsappUrl(item.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img src={item.image} alt={item.title} />
                      <span>{item.title}</span>
                      <i><FaWhatsapp /></i>
                    </a>
                  ),
                )}
              </div>
            </div>
          </section>

          <section className="il-free-section">
            <p className="il-free-section-label">Servicios</p>
            <h2>¿Cómo puedo ayudarte?</h2>

            <div className="il-free-services">
              {DEMO_PROFILE.services.map((service) => (
                <a
                  key={service.id}
                  href={serviceWhatsappUrl(service.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="il-free-service-card"
                  aria-label={`Contactar por WhatsApp sobre ${service.title}`}
                >
                  <div className="il-free-service-card__media">
                    {service.image ? (
                      <img
                        src={service.image}
                        alt={service.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className="il-free-service-card__iconWrap">
                        <span className="il-free-service-card__icon">
                          {renderServiceIcon(service.iconKey)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="il-free-service-card__body">
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>

                    <span
                      className="il-free-service-card__cta"
                      aria-hidden="true"
                    >
                      <FaWhatsapp />
                      Contactar
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="il-free-custom-links">
            <button
              type="button"
              className="il-free-custom-links__toggle"
              onClick={() => setLinksOpen((current) => !current)}
              aria-expanded={linksOpen}
            >
              <span className="il-free-custom-links__icon">
                <FaBriefcase />
              </span>

              <span className="il-free-custom-links__title">
                <strong>Mis enlaces</strong>
                <small>
                  {customLinks.length} de{' '}
                  {FREE_PROFILE_LIMITS.maxCustomLinks} disponibles
                </small>
              </span>

              <FaChevronDown
                className={
                  linksOpen
                    ? 'il-free-custom-links__chevron--open'
                    : ''
                }
              />
            </button>

            <div
              className={`il-free-custom-links__content ${
                linksOpen
                  ? 'il-free-custom-links__content--open'
                  : ''
              }`}
            >
              <div>
                {customLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="il-free-link-pill"
                  >
                    <span>{link.label}</span>
                    <FaExternalLinkAlt />
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="il-free-share">
            <button type="button" onClick={shareProfile}>
              <FaShareAlt />
              <span>Compartir</span>
            </button>

            <button type="button" onClick={copyProfileLink}>
              <FaLink />
              <span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</span>
            </button>
          </section>
        </div>

        <footer className="il-free-footer">
          <a href="/">
            Crea tu perfil gratis con <strong>INTAP Link</strong>
          </a>
        </footer>
      </article>
    </main>
  )
}
