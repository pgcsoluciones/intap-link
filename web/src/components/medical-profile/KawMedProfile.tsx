import { useCallback, useEffect, useState } from 'react'
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
  FiShield,
} from 'react-icons/fi'
import { FaHeartbeat, FaStethoscope, FaWhatsapp } from 'react-icons/fa'
import { apiGet } from '../../lib/api'
import KawMedAppointmentModal from './KawMedAppointmentModal'
import KawMedModal from './KawMedModal'
import type { KawMedCenter, KawMedProfileData, KawMedSchedule, KawMedService } from './types'
import './KawMedProfile.css'

type ApiResponse = {
  ok: boolean
  data?: KawMedProfileData
  error?: string
}

type ModalName = 'schedule' | 'services' | 'centers' | 'location' | 'insurance' | null

function formatTime(value: string): string {
  const [rawHour = '0', rawMinute = '00'] = value.split(':')
  const hour = Number(rawHour)
  return `${hour % 12 || 12}:${rawMinute} ${hour >= 12 ? 'p.m.' : 'a.m.'}`
}

function publicOrigin(): string {
  return window.location.origin
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

function ServiceIcon({ service }: { service: KawMedService }) {
  const value = `${service.title} ${service.category || ''}`.toLowerCase()
  if (value.includes('electro') || value.includes('ecg')) return <FiActivity />
  if (value.includes('prevención') || value.includes('prevencion') || value.includes('riesgo')) return <FaHeartbeat />
  return <FaStethoscope />
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
    if (profile.avatar_url || profile.cover_url) {
      setMeta('meta[property="og:image"]', 'property', 'og:image', profile.avatar_url || profile.cover_url || '')
    }

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
      image: profile.avatar_url || profile.cover_url || undefined,
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

    return () => schema.remove()
  }, [profile])

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
      // Cancelar el share nativo no debe mostrar error.
    }
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

  const heroImage = profile.cover_url || profile.avatar_url || '/assets/kawmed/laura-mendez-hero.jpg'
  const primaryCenter = profile.centers[0] || null

  return (
    <main className="kawmed-shell">
      <div className="kawmed-profile">
        <div className="kawmed-brandbar" aria-label="KawMed by KawLink">
          <span className="kawmed-brandbar__mark">KAWLINK</span>
          <span className="kawmed-brandbar__product">KawMed</span>
        </div>

        <section className="kawmed-hero">
          <img className="kawmed-hero__image" src={heroImage} alt={profile.display_name} />
          <div className="kawmed-hero__shade" />
        </section>

        <section className="kawmed-identity">
          <h1>{profile.display_name}</h1>
          <p className="kawmed-specialty">{profile.specialty}</p>
          {profile.subspecialty ? <p className="kawmed-subtitle">{profile.subspecialty}</p> : null}
        </section>

        <section className="kawmed-intro">
          <p>{profile.bio || 'Información profesional no disponible.'}</p>
          <div className="kawmed-meta">
            {primaryCenter ? <span><FiBriefcase /> {primaryCenter.name}</span> : null}
            {profile.city ? <span><FiMapPin /> {profile.city}</span> : null}
          </div>
        </section>

        <section className="kawmed-contact-pills" aria-label="Contacto y acciones">
          <button
            className="kawmed-contact-pill kawmed-contact-pill--primary"
            type="button"
            onClick={contactWhatsApp}
            disabled={!profile.whatsapp}
          >
            <span className="kawmed-contact-pill__icon"><FaWhatsapp /></span>
            <span><strong>Contactar</strong><small>WhatsApp</small></span>
          </button>

          <button
            className="kawmed-contact-pill"
            type="button"
            onClick={() => setAppointmentOpen(true)}
          >
            <span className="kawmed-contact-pill__icon"><FiCalendar /></span>
            <span><strong>Agendar</strong><small>Solicitar cita</small></span>
          </button>

          <button
            className="kawmed-contact-pill"
            type="button"
            onClick={() => {
              if (profile.phone) window.location.href = `tel:${profile.phone.replace(/[^+\\d]/g, '')}`
            }}
            disabled={!profile.phone}
          >
            <span className="kawmed-contact-pill__icon"><FiPhone /></span>
            <span><strong>Llamar</strong><small>Llamada directa</small></span>
          </button>

          <button className="kawmed-contact-pill" type="button" onClick={downloadVCard}>
            <span className="kawmed-contact-pill__icon"><FiBookmark /></span>
            <span><strong>Guardar contacto</strong><small>En tu teléfono</small></span>
          </button>
        </section>

        <section className="kawmed-panels">
          <button className="kawmed-panel kawmed-panel--direct" type="button" onClick={() => setModal('schedule')}>
            <span className="kawmed-panel__icon"><FiCalendar /></span>
            <span className="kawmed-panel__title">
              <strong>Horarios</strong>
              <small>Días y tandas disponibles</small>
            </span>
            <FiChevronRight className="kawmed-panel__chevron" />
          </button>

          <button className="kawmed-panel kawmed-panel--direct" type="button" onClick={() => setModal('centers')}>
            <span className="kawmed-panel__icon kawmed-panel__icon--teal"><FiBriefcase /></span>
            <span className="kawmed-panel__title">
              <strong>Centros de atención</strong>
              <small>{profile.centers.length} {profile.centers.length === 1 ? 'centro disponible' : 'centros disponibles'}</small>
            </span>
            <FiChevronRight className="kawmed-panel__chevron" />
          </button>

          <button className="kawmed-panel kawmed-panel--direct" type="button" onClick={() => setModal('services')}>
            <span className="kawmed-panel__icon kawmed-panel__icon--service"><FaStethoscope /></span>
            <span className="kawmed-panel__title">
              <strong>Servicios / Especialidades</strong>
              <small>Áreas de atención profesional</small>
            </span>
            <FiChevronRight className="kawmed-panel__chevron" />
          </button>

          <article className="kawmed-panel kawmed-panel--insurance">
            <div className="kawmed-panel__trigger kawmed-panel__trigger--static">
              <span className="kawmed-panel__icon kawmed-panel__icon--insurance"><FiShield /></span>
              <span className="kawmed-panel__title">
                <strong>Aceptamos todos los seguros</strong>
                <small>Sujeto a cobertura y condiciones de cada plan</small>
              </span>
              <button type="button" className="kawmed-insurance-except" onClick={() => setModal('insurance')}>
                Excepto
              </button>
            </div>
          </article>
        </section>

        <button type="button" className="kawmed-share-footer" onClick={shareProfile}>
          <FiShare2 />
          {shareNotice || 'Compartir perfil'}
        </button>

        <footer className="kawmed-footer">
          <span>KawMed</span>
          <small>by KawLink</small>
        </footer>
      </div>

      <KawMedAppointmentModal open={appointmentOpen} profile={profile} onClose={() => setAppointmentOpen(false)} />

      <KawMedModal open={modal === 'schedule'} title="Horarios y centros de consulta" onClose={() => setModal(null)}>
        <ScheduleList schedules={profile.schedules} />
      </KawMedModal>

      <KawMedModal open={modal === 'services'} title="Servicios y especialidades" onClose={() => setModal(null)}>
        <div className="kawmed-detail-list">
          {profile.services.map((service) => (
            <article key={service.id} className="kawmed-detail-card">
              <span><ServiceIcon service={service} /></span>
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
      <KawMedModal open={modal === 'insurance'} title="Seguros no aceptados" onClose={() => setModal(null)}>
        <div className="kawmed-insurance-modal">
          {profile.insurance_policy.excluded.length ? (
            <>
              <p>Este perfil indica cobertura general, excepto los siguientes seguros o planes:</p>
              <ul>
                {profile.insurance_policy.excluded.map((name) => <li key={name}>{name}</li>)}
              </ul>
            </>
          ) : (
            <p>No hay excepciones registradas para este perfil.</p>
          )}
        </div>
      </KawMedModal>

    </main>
  )
}
