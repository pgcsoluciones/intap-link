import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  FiActivity,
  FiUserPlus,
  FiPlusSquare,
  FiBriefcase,
  FiHome,
  FiShieldCheck,
  FiCalendar,
  FiChevronRight,
  FiMapPin,
  FiNavigation,
  FiPhone,
  FiShare2,
  FiShield,
} from 'react-icons/fi'
import { FaQrcode, FaTimes, FaWhatsapp } from 'react-icons/fa'
import { apiGet } from '../../lib/api'
import AppointmentRequestModal from '../appointments/AppointmentRequestModal'
import AppointmentOwnerBar from '../appointments/AppointmentOwnerBar'
import KawMedModal from './KawMedModal'
import type { KawMedCenter, KawMedProfileData, KawMedSchedule } from './types'
import './KawMedProfile.css'

type ApiResponse = {
  ok: boolean
  data?: KawMedProfileData
  error?: string
}

type ModalName = 'schedule' | 'centers' | 'location' | 'insurance' | null

function formatTime(value: string): string {
  const [rawHour = '0', rawMinute = '00'] = value.split(':')
  const hour = Number(rawHour)
  return `${hour % 12 || 12}:${rawMinute} ${hour >= 12 ? 'p.m.' : 'a.m.'}`
}

function publicOrigin(): string {
  return window.location.origin
}

function appOrigin(): string {
  const host = window.location.hostname.toLowerCase()
  return host === 'preview.intaprd.com' || host.endsWith('.pages.dev')
    ? 'https://app.preview.intaprd.com'
    : 'https://app.intaprd.com'
}

function loginUrl(): string {
  return appOrigin() + '/admin/login'
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
  const params = new URLSearchParams(window.location.search)
  const previewTemplate = params.get('kawmed_preview')
  const previewPalette = params.get('kawmed_palette')
  const [profile, setProfile] = useState<KawMedProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalName>(null)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [shareNotice, setShareNotice] = useState('')
  const [toast, setToast] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')

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

  const openQr = useCallback(async () => {
    if (!profile) return
    try {
      const QRCode = await import('qrcode')
      setQrDataUrl(await QRCode.toDataURL(`${publicOrigin()}/m/${profile.slug}`, {
        width: 1200,
        margin: 3,
        errorCorrectionLevel: 'H',
        color: { dark: '#10233f', light: '#ffffff' },
      }))
      setQrOpen(true)
    } catch {
      setToast('No pudimos generar el código QR.')
      window.setTimeout(() => setToast(''), 2800)
    }
  }, [profile])

  const downloadQr = useCallback(() => {
    if (!profile || !qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${profile.slug}-qr.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [profile, qrDataUrl])

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
  const isPastel = (previewTemplate === 'pastel' || previewTemplate === 'classic' ? previewTemplate : profile.template) === 'pastel'
  const effectivePalette = previewPalette && ['aqua','lavender','mint','peach','sky'].includes(previewPalette) ? previewPalette : profile.palette
  const palette: 'aqua' | 'lavender' | 'mint' | 'peach' | 'sky' = effectivePalette && ['aqua','lavender','mint','peach','sky'].includes(effectivePalette) ? effectivePalette as 'aqua' | 'lavender' | 'mint' | 'peach' | 'sky' : 'aqua'

  return (
    <main className={`kawmed-shell${isPastel ? ` kawmed-shell--pastel kawmed-palette--${palette}` : ""}`}>
      <AppointmentOwnerBar
        username={profile.slug}
        ownerApiBase={appOrigin()+'/api/v1/me/medical-profile/appointments'}
        manageOrigin={appOrigin()}
        settingsPath="/admin/medical"
        settingsLabel="Editar mi perfil"
        palette={{accent:isPastel?({aqua:'#139da7',lavender:'#9686c9',mint:'#4a9c87',peach:'#cf8c77',sky:'#568fbf'} as Record<string,string>)[palette]:'#126fe8',accentSoft:'#eaf4ff',text:'#10233f'}}
        onToast={(message) => {
          setToast(message)
          window.setTimeout(() => setToast(''), 2800)
        }}
      />
      <div className="kawmed-profile">
        <section className="kawmed-hero">
          <img className="kawmed-hero__image" src={heroImage} alt={profile.display_name} />
          <div className="kawmed-hero__shade" />
          {isPastel ? <div className="kawmed-pastel-hero-copy">
            <h1>{profile.display_name}</h1>
            <div className="kawmed-pastel-hero-specialties">{profile.specialty.split(' | ').filter(Boolean).map((name,index)=><p className={index===0?'kawmed-pastel-main-specialty':'kawmed-pastel-extra-specialty'} key={index}>{name.trim()}</p>)}</div>
            {profile.subspecialty?<p className="kawmed-pastel-subspecialty">{profile.subspecialty}</p>:null}
          </div>:null}
        </section>

        {!isPastel?<section className="kawmed-identity">
          <h1>{profile.display_name}</h1>
          <div className="kawmed-specialties">{profile.specialty.split(" | ").map((name,index)=><p className={index===0?"kawmed-specialty kawmed-specialty--main":"kawmed-specialty kawmed-specialty--additional"} key={index}>{name.trim()}</p>)}</div>
          {profile.subspecialty ? <p className="kawmed-subtitle">{profile.subspecialty}</p> : null}
        </section>:null}

        <section className="kawmed-intro">
          <p>{profile.bio || 'Información profesional no disponible.'}</p>
          <div className="kawmed-meta">
            {primaryCenter ? <span><FiBriefcase /> {primaryCenter.name}</span> : null}
            {profile.city ? <span><FiMapPin /> {profile.city}</span> : null}
          </div>
        </section>

        <section className="kawmed-contact-pills" aria-label="Contacto y acciones">
          <button
            className="kawmed-contact-pill"
            type="button"
            onClick={contactWhatsApp}
            disabled={!profile.whatsapp}
          >
            <span className="kawmed-contact-pill__icon"><FaWhatsapp /></span>
            <span><strong>Contactar</strong><small>WhatsApp</small></span>
          </button>

          <button
            className="kawmed-contact-pill kawmed-contact-pill--primary"
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
            <span className="kawmed-contact-pill__icon"><FiUserPlus /></span>
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
            <span className="kawmed-panel__illustration" aria-hidden="true"><FiCalendar /></span><FiChevronRight className="kawmed-panel__chevron" />
          </button>

          <button className="kawmed-panel kawmed-panel--direct" type="button" onClick={() => setModal('centers')}>
            <span className="kawmed-panel__icon kawmed-panel__icon--teal"><FiPlusSquare /></span>
            <span className="kawmed-panel__title">
              <strong>Centros de atención</strong>
              <small>{profile.centers.length} {profile.centers.length === 1 ? 'centro disponible' : 'centros disponibles'}</small>
            </span>
            <span className="kawmed-panel__illustration" aria-hidden="true"><FiHome /><FiPlusSquare /></span><FiChevronRight className="kawmed-panel__chevron" />
          </button>

          <article className="kawmed-panel kawmed-panel--insurance">
            <div className="kawmed-panel__trigger kawmed-panel__trigger--static">
              <span className="kawmed-panel__icon kawmed-panel__icon--insurance"><FiShieldCheck /></span>
              <span className="kawmed-panel__title">
                <strong>Seguros médicos</strong>
                <small>{profile.insurance_policy.accepted.length ? profile.insurance_policy.accepted.slice(0,2).join(' · ') : profile.insurance_policy.accepts_all ? 'Todos los seguros' : 'Consulta cobertura y excepciones'}</small>
              </span>
              <span className="kawmed-panel__illustration" aria-hidden="true"><FiShieldCheck /></span><button type="button" className="kawmed-insurance-except" onClick={() => setModal('insurance')}>
                Ver seguros
              </button>
            </div>
          </article>
        </section>

        <section className="kawmed-public-actions" aria-label="Acciones del perfil">
          <button type="button" onClick={shareProfile}><FiShare2 />{shareNotice || 'Compartir perfil'}</button>
          <button type="button" onClick={() => void openQr()}><FaQrcode />Código QR</button>
          <a href={loginUrl()}>Iniciar sesión</a>
        </section>

        <footer className="kawmed-footer">
          <a href="https://nfc.kawvoia.com" target="_blank" rel="noopener noreferrer">
            <span>KawMed</span>
            <small>by KawLink</small>
          </a>
        </footer>
      </div>

      {appointmentOpen ? (
        <AppointmentRequestModal
          apiBase={'/api/v1/public/medical-profiles/'+encodeURIComponent(profile.slug)+'/appointments'}
          palette={{accent:'#126fe8',accentSoft:'#eaf4ff',text:'#10233f'}}
          onClose={() => setAppointmentOpen(false)}
          onToast={(message) => {
            setToast(message)
            window.setTimeout(() => setToast(''), 2800)
          }}
          detailsPlaceholder="Ej.: Primera consulta por molestias recientes, seguimiento de tratamiento o revisión de resultados."
        />
      ) : null}
      {toast ? <div className="kawmed-toast" role="status">{toast}</div> : null}

      {qrOpen ? (
        <div className="kawmed-qr-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setQrOpen(false)
        }}>
          <article className="kawmed-qr-modal" role="dialog" aria-modal="true" aria-label="Código QR">
            <button type="button" className="kawmed-qr-close" onClick={() => setQrOpen(false)} aria-label="Cerrar"><FaTimes /></button>
            <span className="kawmed-qr-kicker">KAWMED</span>
            <h2>Código QR</h2>
            <p>Escanea para abrir este perfil médico.</p>
            {qrDataUrl ? <img src={qrDataUrl} alt={`Código QR de ${profile.display_name}`} /> : null}
            <strong>{profile.display_name}</strong>
            <button type="button" className="kawmed-qr-download" onClick={downloadQr}><FaQrcode />Descargar PNG</button>
          </article>
        </div>
      ) : null}

      <KawMedModal open={modal === 'schedule'} title="Horarios y centros de consulta" onClose={() => setModal(null)}>
        <ScheduleList schedules={profile.schedules} />
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
      <KawMedModal open={modal === 'insurance'} title="Seguros médicos" onClose={() => setModal(null)}>
        <div className="kawmed-insurance-modal">
          <h3>Seguros aceptados</h3>
          {profile.insurance_policy.accepted.length ? (
            <ul>{profile.insurance_policy.accepted.map((name) => <li key={'accepted-'+name}>{name}</li>)}</ul>
          ) : (
            <p>Este perfil no ha publicado una lista específica de seguros aceptados.</p>
          )}
          {profile.insurance_policy.excluded.length > 0 && <><h3>Excepciones</h3><ul>{profile.insurance_policy.excluded.map((name) => <li key={'excluded-'+name}>{name}</li>)}</ul></>}
        </div>
      </KawMedModal>

    </main>
  )
}
