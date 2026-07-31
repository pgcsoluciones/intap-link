import { useEffect } from 'react'
import IntapProfileBioPests from './IntapProfileBioPests'
import './IntapProfileBioPestsVariant.css'

const MANAGER = {
  slug: 'biopestsgrd',
  name: 'Rene Prieto',
  role: 'CEO',
  phone: '(829) 246-9777',
  phoneRaw: '18292469777',
  alternatePhone: '(829) 750-0908',
  alternatePhoneRaw: '18297500908',
  email: 'grupomatyse@gmail.com',
  instagram: 'https://www.instagram.com/biopestsrd/',
  vcardUrl: '/assets/biopestrd/contacts/rene-prieto-biopests.vcf',
  vcardFilename: 'Rene-Prieto-BioPests.vcf',
  canonicalUrl: 'https://intaprd.com/biopestsgrd',
  previewImage:
    'https://intaprd.com/assets/biopestrd/values/innovacion.png?v=biopests-shared-og-v1',
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  element.content = value
}

function replaceWhatsAppNumber(href: string): string {
  return href.replace(/https:\/\/wa\.me\/\d+/i, `https://wa.me/${MANAGER.phoneRaw}`)
}

function applyManagerProfile() {
  const root = document.querySelector<HTMLElement>('.biopests-page')
  if (!root) return

  root.dataset.biopestsProfile = 'manager'

  const identity = root.querySelector<HTMLElement>('.biopests-identity')
  if (identity && !identity.querySelector('.biopests-holder-card')) {
    const card = document.createElement('div')
    card.className = 'biopests-holder-card'
    card.setAttribute('aria-label', `${MANAGER.name}, ${MANAGER.role} de BioPests`)
    card.innerHTML = `
      <span>BioPests</span>
      <strong>${MANAGER.name}</strong>
      <small>${MANAGER.role}</small>
    `

    const tagline = identity.querySelector('h2')
    if (tagline?.nextSibling) {
      identity.insertBefore(card, tagline.nextSibling)
    } else {
      identity.appendChild(card)
    }
  }

  root.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
    const label = (anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
    const href = anchor.getAttribute('href') || ''

    if (/https:\/\/wa\.me\/\d+/i.test(href)) {
      anchor.href = replaceWhatsAppNumber(href)
    }

    if (label.includes('llamar')) {
      anchor.href = `tel:+${MANAGER.phoneRaw}`
    }

    if (label.includes('guardar contacto')) {
      anchor.href = MANAGER.vcardUrl
      anchor.download = MANAGER.vcardFilename
    }
  })

  root
    .querySelectorAll<HTMLAnchorElement>('.biopests-contact-list a')
    .forEach((anchor) => {
      const type = anchor.querySelector('small')?.textContent?.trim().toLowerCase() || ''
      const value = anchor.querySelector<HTMLElement>('strong')

      if (type.includes('principal')) {
        anchor.href = `tel:+${MANAGER.phoneRaw}`
        if (value) value.textContent = MANAGER.phone
      }

      if (type.includes('alternativo')) {
        anchor.href = `tel:+${MANAGER.alternatePhoneRaw}`
        if (value) value.textContent = MANAGER.alternatePhone
      }
    })
}

export default function IntapProfileBioPestsManager() {
  useEffect(() => {
    document.title = `${MANAGER.name} | ${MANAGER.role} de BioPests`

    upsertMeta('meta[name="description"]', 'name', 'description',
      `${MANAGER.name}, ${MANAGER.role} de BioPests. Manejo integral de plagas, evaluación técnica, prevención y monitoreo empresarial.`)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title',
      `${MANAGER.name} | ${MANAGER.role} de BioPests`)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description',
      `${MANAGER.name}, ${MANAGER.role} de BioPests. Soluciones empresariales para prevenir, controlar y monitorear plagas.`)
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', MANAGER.canonicalUrl)
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', MANAGER.previewImage)
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title',
      `${MANAGER.name} | ${MANAGER.role} de BioPests`)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description',
      `${MANAGER.name}, ${MANAGER.role} de BioPests. Manejo integral de plagas para empresas.`)
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', MANAGER.previewImage)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = MANAGER.canonicalUrl

    applyManagerProfile()

    const observer = new MutationObserver(() => applyManagerProfile())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return <IntapProfileBioPests />
}
