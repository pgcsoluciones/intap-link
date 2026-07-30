import {
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
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
  FaPhoneAlt,
  FaShareAlt,
  FaWhatsapp,
} from 'react-icons/fa'
import './IntapLinkGratisDemo.css'
import {
  FREE_PROFILE_LIMITS,
  type FreeProfileAppearanceColors,
  type FreeProfileData,
  type FreeProfileLayoutId,
  type FreeProfileServiceIconKey,
} from './IntapLinkGratis.types'

export type IntapLinkGratisProfileProps = {
  profile: FreeProfileData
  layout: FreeProfileLayoutId
  colors: FreeProfileAppearanceColors
  topContent?: ReactNode
}

function portfolioWhatsappUrl(
  profile: FreeProfileData,
  portfolioTitle?: string,
) {
  const greeting =
    `Hola ${profile.whatsappGreetingName},`

  const message = portfolioTitle
    ? `${greeting} vi "${portfolioTitle}" en tu portafolio de INTAP LINK y me gustaría recibir más información.`
    : `${greeting} vi tu perfil en INTAP LINK y me gustaría recibir más información.`

  return (
    `https://wa.me/${profile.phone}` +
    `?text=${encodeURIComponent(message)}`
  )
}

function serviceWhatsappUrl(
  profile: FreeProfileData,
  serviceTitle: string,
) {
  const greeting =
    `Hola ${profile.whatsappGreetingName},`

  const message =
    `${greeting} vi el servicio "${serviceTitle}" en tu perfil de INTAP LINK y me gustaría recibir más información.`

  return (
    `https://wa.me/${profile.phone}` +
    `?text=${encodeURIComponent(message)}`
  )
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

    default:
      return null
  }
}

function ProfileIdentity({
  layout,
  profile,
}: {
  layout: FreeProfileLayoutId
  profile: FreeProfileData
}) {
  if (layout === 'impacto') {
    return (
      <section className="il-free-identity il-free-identity--impacto">
        <div className="il-free-impact-hero">
          <img src={profile.hero} alt="" />
        </div>

        <div className="il-free-impact-avatar">
          <img src={profile.portrait} alt={profile.name} />
        </div>

        <div className="il-free-identity-copy">
          <h1>{profile.name}</h1>
          <p>{profile.role}</p>
        </div>
      </section>
    )
  }

  if (layout === 'personal') {
    return (
      <section className="il-free-identity il-free-identity--personal">
        <div className="il-free-personal-portrait">
          <img src={profile.portrait} alt={profile.name} />
          <div className="il-free-personal-gradient" />
        </div>

        <div className="il-free-personal-copy">
          <span>{profile.personalBadge}</span>
          <h1>{profile.name}</h1>
          <p>{profile.role}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="il-free-identity il-free-identity--esencial">
      <div className="il-free-essential-avatar">
        <img src={profile.portrait} alt={profile.name} />
      </div>

      <div className="il-free-identity-copy">
        <h1>{profile.name}</h1>
        <p>{profile.role}</p>
      </div>
    </section>
  )
}

export default function IntapLinkGratisProfile({
  profile,
  layout,
  colors,
  topContent,
}: IntapLinkGratisProfileProps) {
  const [copied, setCopied] = useState(false)
  const [linksOpen, setLinksOpen] = useState(false)

  const customLinks = profile.customLinks.slice(
    0,
    FREE_PROFILE_LIMITS.maxCustomLinks,
  )

  const portfolio = profile.portfolio.slice(
    0,
    FREE_PROFILE_LIMITS.maxPortfolioImages,
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
      await navigator.clipboard.writeText(
        window.location.href,
      )

      setCopied(true)

      window.setTimeout(
        () => setCopied(false),
        1800,
      )
    } catch {
      setCopied(false)
    }
  }

  async function shareProfile() {
    const shareData = {
      title: `${profile.name} | INTAP LINK`,
      text: `Conoce el perfil de ${profile.name}`,
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
      `FN:${profile.name}`,
      `TITLE:${profile.role}`,
      `TEL:${profile.phone}`,
      `URL:${window.location.href}`,
      'END:VCARD',
    ].join('\n')

    const blob = new Blob([content], {
      type: 'text/vcard;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = profile.vcardFileName

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      0,
    )
  }

  return (
    <main
      className={`il-free-page il-free-page--${layout}`}
      style={cssVariables}
    >
      {topContent}

      <article className="il-free-profile">
        <ProfileIdentity
          layout={layout}
          profile={profile}
        />

        <div className="il-free-content">
          <a
            href={portfolioWhatsappUrl(profile)}
            target="_blank"
            rel="noopener noreferrer"
            className="il-free-whatsapp"
          >
            <FaWhatsapp />
            <span>{profile.whatsappCtaLabel}</span>
          </a>

          <section
            className="il-free-quick-actions"
            aria-label="Enlaces rápidos"
          >
            <a href={`tel:+${profile.phone}`}>
              <span>
                <FaPhoneAlt />
              </span>
              <strong>Llamar</strong>
            </a>

            <a
              href={profile.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                <FaInstagram />
              </span>
              <strong>Instagram</strong>
            </a>

            <a
              href={profile.location}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                <FaMapMarkerAlt />
              </span>
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
            <p className="il-free-section-label">
              Sobre mí
            </p>

            <h2>{profile.aboutTitle}</h2>
            <p>{profile.bio}</p>
          </section>

          <section className="il-free-portfolio">
            <header className="il-free-portfolio__header">
              <div>
                <span>
                  <FaImages />
                </span>

                <div>
                  <strong>Mi portafolio</strong>
                  <small>
                    Hasta{' '}
                    {FREE_PROFILE_LIMITS.maxPortfolioImages}{' '}
                    imágenes
                  </small>
                </div>
              </div>
            </header>

            <div className="il-free-portfolio__viewport">
              <div className="il-free-portfolio__track">
                {[...portfolio, ...portfolio].map(
                  (item, index) => (
                    <a
                      key={`${item.id}-${index}`}
                      href={portfolioWhatsappUrl(
                        profile,
                        item.title,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                      />

                      <span>{item.title}</span>

                      <i>
                        <FaWhatsapp />
                      </i>
                    </a>
                  ),
                )}
              </div>
            </div>
          </section>

          <section className="il-free-section">
            <p className="il-free-section-label">
              Servicios
            </p>

            <h2>¿Cómo puedo ayudarte?</h2>

            <div className="il-free-services">
              {profile.services.map((service) => (
                <a
                  key={service.id}
                  href={serviceWhatsappUrl(
                    profile,
                    service.title,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="il-free-service-card"
                  aria-label={
                    `Contactar por WhatsApp sobre ` +
                    service.title
                  }
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
                          {renderServiceIcon(
                            service.iconKey,
                          )}
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
              onClick={() =>
                setLinksOpen((current) => !current)
              }
              aria-expanded={linksOpen}
            >
              <span className="il-free-custom-links__icon">
                <FaBriefcase />
              </span>

              <span className="il-free-custom-links__title">
                <strong>Mis enlaces</strong>

                <small>
                  {customLinks.length} de{' '}
                  {FREE_PROFILE_LIMITS.maxCustomLinks}{' '}
                  disponibles
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
            <button
              type="button"
              onClick={shareProfile}
            >
              <FaShareAlt />
              <span>Compartir</span>
            </button>

            <button
              type="button"
              onClick={copyProfileLink}
            >
              <FaLink />
              <span>
                {copied
                  ? 'Enlace copiado'
                  : 'Copiar enlace'}
              </span>
            </button>
          </section>
        </div>

        <footer className="il-free-footer">
          <a href="/">
            Crea tu perfil gratis con{' '}
            <strong>INTAP Link</strong>
          </a>
        </footer>
      </article>
    </main>
  )
}
