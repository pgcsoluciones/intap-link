import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  FiActivity,
  FiBookmark,
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiMapPin,
  FiNavigation,
  FiPhone,
  FiShare2,
  FiUser,
} from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import { apiGet } from '../../lib/api'
import KawMedAppointmentModal from './KawMedAppointmentModal'
import KawMedModal from './KawMedModal'
import type { KawMedCenter, KawMedProfileData, KawMedSchedule } from './types'
import './KawMedProfile.css'

type ApiResponse = {
  ok: boolean
  data?: KawMedProfileData
  error?: string
}

type ModalName = 'about' | 'schedule' | 'services' | 'centers' | 'location' | null

function formatTime(value: string): string {
  const [rawHour = '0', rawMinute = '00'] = value.split(':')
  const hour = Number(rawHour)
  return `${hour % 12 || 12}:${rawMinute} ${hour >= 12 ? 'p.m.' : 'a.m.'}`
}

function publicOrigin(): string {
  const host = window.location.hostname.toLowerCase()
  if (host === 'preview.intaprd.com' || host.endsWith('.pages.dev')) return window.location.origin
  return window.location.origin
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function openMap(center: KawMedCenter) {
  if (center.map_url) {
    window.open(center.map_url, '_blank', 'noopener,noreferrer')
    return
  }
  if (center.latitude !== null && center.longitude !== null) {
    window.open(`https://www.google.com/maps?q=${center.latitude},${center.longitude}`, '_blank', 'noopener,noreferrer')
  }
}

function ScheduleList({ schedules }: { schedules: KawMedSchedule[] }) {
  if (!schedules.length) return <p className="kawmed-empty">No hay horarios publicados.</p>
  return (
    <div className="kawmed-schedule-list">
      {schedules.map((schedule) => (
        <article className="kawmed-schedule-row" key={schedule.id}>
          <div>
            <strong>{schedule.day_label}</strong>
            <span>{schedule.center_name}</span>
          </div>
          <div className="kawmed-schedule-row__time">
            {schedule.shift ? <span className="kawmed-pill">{schedule.shift}</span> : null}
            <strong>{formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}</strong>
          </div>
        </article>
      ))}
    </div>
  )
}

export default function KawMedProfile() {
  const { slug = '' } = useParams()
  const [profile, setProfile] = useState<KawMedProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalName>(null)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [shareNotice, setShareNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiGet<ApiResponse>(`/public/medical-profiles/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (cancelled) return
        if (!response.ok || !response.data) {
          setError(response.error || 'Perfil médico no disponible.')
          setProfile(null)
          return
        }
        setProfile(response.data)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el perfil médico.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!profile) return
    const canonicalUrl = `${publicOrigin()}/m/${profile.slug}`
    const title = `${profile.display_name} · ${profile.specialty} | KawMed`
    const description = [
      profile.specialty,
      profile.subspecialty,
      profile.city ? `Consulta en ${profile.city}` : null,
    ].filter(Boolean).join(' · ')

    document.title = title

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, value: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(selector)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute(attribute, key)
        document.head.appendChild(tag)
      }
      tag.content = value
    }

    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'profile')
    if (profile.avatar_url) setMeta('meta[property="og:image"]', 'property', 'og:image', profile.avatar_url)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl

    const schemaId = 'kawmed-physician-jsonld'
    document.getElementById(schemaId)?.remove()
    const schema = document.createElement('script')
    schema.id = schemaId
    schema.type = 'application/ld+json'
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Physician',
      name: profile.display_name,
      medicalSpecialty: profile.specialty,
      description: profile.bio || profile.subspecialty || undefined,
      url: canonicalUrl,
      image: profile.avatar_url || undefined,
      telephone: profile.phone || undefined,
      email: profile.email || undefined,
      address: profile.city ? {
        '@type': 'PostalAddress',
        addressLocality: profile.city,
        addressRegion: profile.province || undefined,
        addressCountry: profile.country || undefined,
      } : undefined,
      workLocation: profile.centers.map((center) => ({
        '@type': 'MedicalClinic',
        name: center.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: center.address || undefined,
          addressLocality: center.city || undefined,
          addressRegion: center.province || undefined,
          addressCountry: center.country || undefined,
        },
      })),
    })
    document.head.appendChild(schema)

    return () => {
      schema.remove()
    }
  }, [profile])

  const primaryCenter = profile?.centers[0] || null

  const contactWhatsApp = useCallback(() => {
    if (!profile?.whatsapp) return
    const number = profile.whatsapp.replace(/\D/g, '')
    const message = `Hola ${profile.display_name}, deseo realizar una consulta.`
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }, [profile])

  const downloadVCard = useCallback(() => {
    if (!profile) return
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${profile.display_name}`,
      `N:${profile.name};;;;`,
      profile.specialty ? `TITLE:${profile.specialty}` : '',
      profile.organization ? `ORG:${profile.organization}` : '',
      profile.phone ? `TEL;TYPE=CELL,VOICE:${profile.phone}` : '',
      profile.whatsapp && profile.whatsapp.replace(/\D/g, '') !== (profile.phone || '').replace(/\D/g, '')
        ? `item1.TEL:${profile.whatsapp}`
        : '',
      profile.whatsapp && profile.whatsapp.replace(/\D/g, '') !== (profile.phone || '').replace(/\D/g, '')
        ? 'item1.X-ABLabel:WhatsApp'
        : '',
      profile.email ? `EMAIL:${profile.email}` : '',
      `URL:${publicOrigin()}/m/${profile.slug}`,
      'END:VCARD',
    ].filter(Boolean)
    const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${profile.slug}.vcf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }, [profile])

  const shareProfile = useCallback(async () => {
    if (!profile) return
    const url = `${publicOrigin()}/m/${profile.slug}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.display_name} · ${profile.specialty}`,
          text: `Perfil profesional de ${profile.display_name}`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareNotice('Enlace copiado')
      window.setTimeout(() => setShareNotice(''), 2200)
    } catch {
      // Cancelar el share nativo no debe mostrar un error.
    }
  }, [profile])

  const menuItems = useMemo(() => {
    if (!profile) return []
    return [
      { key: 'about' as const, icon: FiUser, title: 'Sobre mí', subtitle: 'Formación, enfoque y compromiso' },
      { key: 'schedule' as const, icon: FiCalendar, title: 'Horarios y centros de consulta', subtitle: 'Días, tandas y disponibilidad' },
      { key: 'services' as const, icon: FiActivity, title: 'Servicios / Especialidades', subtitle: 'Áreas de atención profesional' },
      { key: 'centers' as const, icon: FiBriefcase, title: 'Centros de atención', subtitle: `${profile.centers.length} ${profile.centers.length === 1 ? 'centro disponible' : 'centros disponibles'}` },
      { key: 'location' as const, icon: FiMapPin, title: 'Ubicación', subtitle: 'Elige el centro al que deseas llegar' },
    ]
  }, [profile])

  if (loading) {
    return <main className="kawmed-shell"><div className="kawmed-state">Cargando perfil médico…</div></main>
  }

  if (!profile || error) {
    return (
      <main className="kawmed-shell">
        <div className="kawmed-state">
          <FiActivity />
          <h1>Perfil médico no disponible</h1>
          <p>{error || 'Este perfil no está disponible.'}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="kawmed-shell">
      <div className="kawmed-profile">
        <div className="kawmed-brandbar" aria-label="KawMed by KawLink">
          <span className="kawmed-brandbar__mark">KAWLINK</span>
          <span>KawMed</span>
        </div>

        <section className="kawmed-hero">
          {profile.cover_url || profile.avatar_url ? (
            <img
              className="kawmed-hero__image"
              src={profile.cover_url || profile.avatar_url || ''}
              alt={profile.display_name}
            />
          ) : (
            <div className="kawmed-hero__placeholder" aria-hidden="true">
              <span className="kawmed-hero__pulse"><FiActivity /></span>
              <span>{initials(profile.name)}</span>
            </div>
          )}
        </section>

        <section className="kawmed-identity">
          <div className="kawmed-identity__icon"><FiActivity /></div>
          <div>
            <h1>{profile.display_name}</h1>
            <p className="kawmed-specialty">{profile.specialty}</p>
            {profile.subspecialty ? <p className="kawmed-subtitle">{profile.subspecialty}</p> : null}
          </div>
        </section>

        <div className="kawmed-meta">
          {primaryCenter ? <span><FiBriefcase /> {primaryCenter.name}</span> : null}
          {profile.city ? <span><FiMapPin /> {profile.city}</span> : null}
        </div>

        <section className="kawmed-primary-actions">
          <button
            className="kawmed-button kawmed-button--whatsapp"
            type="button"
            onClick={contactWhatsApp}
            disabled={!profile.whatsapp}
          >
            <FaWhatsapp />
            Contactar al médico
          </button>
          <button className="kawmed-button kawmed-button--appointment" type="button" onClick={() => setAppointmentOpen(true)}>
            <FiCalendar />
            Solicitar cita
          </button>
        </section>

        <section className="kawmed-menu" aria-label="Información del perfil">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                className="kawmed-menu-item"
                key={item.key}
                onClick={() => {
                  if (item.key === 'location' && profile.centers.length === 1) {
                    openMap(profile.centers[0])
                    return
                  }
                  setModal(item.key)
                }}
              >
                <span className="kawmed-menu-item__icon"><Icon /></span>
                <span className="kawmed-menu-item__copy">
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <FiChevronRight className="kawmed-menu-item__chevron" />
              </button>
            )
          })}

          <button type="button" className="kawmed-menu-item" onClick={() => {
            if (profile.phone) window.location.href = `tel:${profile.phone.replace(/[^+\d]/g, '')}`
          }} disabled={!profile.phone}>
            <span className="kawmed-menu-item__icon"><FiPhone /></span>
            <span className="kawmed-menu-item__copy">
              <strong>Llamar</strong>
              <small>{profile.phone || 'No disponible'}</small>
            </span>
            <FiChevronRight className="kawmed-menu-item__chevron" />
          </button>

          <button type="button" className="kawmed-menu-item" onClick={downloadVCard}>
            <span className="kawmed-menu-item__icon"><FiBookmark /></span>
            <span className="kawmed-menu-item__copy">
              <strong>Guardar contacto</strong>
              <small>Agregar a tu teléfono</small>
            </span>
            <FiChevronRight className="kawmed-menu-item__chevron" />
          </button>

          <button type="button" className="kawmed-menu-item" onClick={shareProfile}>
            <span className="kawmed-menu-item__icon"><FiShare2 /></span>
            <span className="kawmed-menu-item__copy">
              <strong>Compartir perfil</strong>
              <small>{shareNotice || 'Enviar o copiar enlace'}</small>
            </span>
            <FiChevronRight className="kawmed-menu-item__chevron" />
          </button>
        </section>

        <footer className="kawmed-footer">
          <span>KawMed</span>
          <small>by KawLink · información profesional pública</small>
        </footer>
      </div>

      <KawMedAppointmentModal open={appointmentOpen} profile={profile} onClose={() => setAppointmentOpen(false)} />

      <KawMedModal open={modal === 'about'} title="Sobre mí" onClose={() => setModal(null)}>
        <div className="kawmed-copy-block">
          <div className="kawmed-copy-block__badge"><FiActivity /> {profile.specialty}</div>
          <p>{profile.bio || 'Información profesional no disponible.'}</p>
          {profile.subspecialty ? <p><strong>Enfoque:</strong> {profile.subspecialty}</p> : null}
          {profile.city ? <p><strong>Ciudad:</strong> {profile.city}</p> : null}
        </div>
      </KawMedModal>

      <KawMedModal open={modal === 'schedule'} title="Horarios y centros de consulta" onClose={() => setModal(null)}>
        <ScheduleList schedules={profile.schedules} />
      </KawMedModal>

      <KawMedModal open={modal === 'services'} title="Servicios y especialidades" onClose={() => setModal(null)}>
        <div className="kawmed-detail-list">
          {profile.services.map((service) => (
            <article key={service.id} className="kawmed-detail-card">
              <span><FiActivity /></span>
              <div>
                <strong>{service.title}</strong>
                {service.description ? <p>{service.description}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </KawMedModal>

      <KawMedModal open={modal === 'centers'} title="Centros de atención" onClose={() => setModal(null)}>
        <div className="kawmed-detail-list">
          {profile.centers.map((center) => (
            <article key={center.id} className="kawmed-center-card">
              <div className="kawmed-center-card__icon"><FiBriefcase /></div>
              <div className="kawmed-center-card__copy">
                <strong>{center.name}</strong>
                <p>{[center.address, center.city].filter(Boolean).join(' · ')}</p>
                {center.phone ? <a href={`tel:${center.phone.replace(/[^+\d]/g, '')}`}><FiPhone /> {center.phone}</a> : null}
              </div>
              {(center.map_url || (center.latitude !== null && center.longitude !== null)) ? (
                <button type="button" onClick={() => openMap(center)}><FiNavigation /> Ver ubicación</button>
              ) : null}
            </article>
          ))}
        </div>
      </KawMedModal>

      <KawMedModal open={modal === 'location'} title="Seleccionar ubicación" onClose={() => setModal(null)}>
        <div className="kawmed-location-list">
          {profile.centers.map((center) => (
            <button
              key={center.id}
              type="button"
              className="kawmed-location-button"
              onClick={() => openMap(center)}
              disabled={!center.map_url && (center.latitude === null || center.longitude === null)}
            >
              <span><FiMapPin /></span>
              <span>
                <strong>{center.name}</strong>
                <small>{[center.address, center.city].filter(Boolean).join(' · ')}</small>
              </span>
              <FiNavigation />
            </button>
          ))}
        </div>
      </KawMedModal>
    </main>
  )
}
