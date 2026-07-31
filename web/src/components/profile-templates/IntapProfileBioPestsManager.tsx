import { useEffect, type MouseEvent } from 'react'
import IntapProfileBioPests from './IntapProfileBioPests'
import './IntapProfileBioPestsVariant.css'

const MANAGER = {
  slug: 'biopestsgrd',
  name: 'Rene Prieto',
  role: 'CEO',
  phone: '(829) 750-0908',
  phoneRaw: '18297500908',
  alternatePhone: '(829) 246-9777',
  alternatePhoneRaw: '18292469777',
  email: 'grupomatyse@gmail.com',
  instagram: 'https://www.instagram.com/biopestsrd/',
  vcardUrl:
    '/assets/biopestrd/contacts/rene-prieto-biopests-v2.vcf?v=20260731-2',
  vcardFilename: 'Rene-Prieto-BioPests-actualizado.vcf',
  canonicalUrl: 'https://intaprd.com/biopestsgrd',
  previewImage:
    'https://intaprd.com/assets/biopestrd/values/innovacion.png?v=biopests-shared-og-v1',
}

function upsertMeta(
  selector: string,
  attribute: 'name' | 'property',
  key: string,
  value: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  element.content = value
}

function replaceWhatsAppNumber(href: string): string {
  return href.replace(
    /https:\/\/wa\.me\/\d+/i,
    `https://wa.me/${MANAGER.phoneRaw}`,
  )
}

function downloadManagerVcard() {
  const anchor = document.createElement('a')
  anchor.href = MANAGER.vcardUrl
  anchor.download = MANAGER.vcardFilename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function handleManagerLinkClick(event: MouseEvent<HTMLDivElement>) {
  const target = event.target

  if (!(target instanceof Element)) return

  const anchor = target.closest('a')

  if (!(anchor instanceof HTMLAnchorElement)) return

  const label = (anchor.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  const href = anchor.getAttribute('href') || ''
  const contactType = anchor
    .querySelector('small')
    ?.textContent
    ?.trim()
    .toLowerCase() || ''

  if (label.includes('guardar contacto')) {
    event.preventDefault()
    event.stopPropagation()
    downloadManagerVcard()
    return
  }

  let destination: string | null = null

  if (/https:\/\/wa\.me\/\d+/i.test(href)) {
    destination = replaceWhatsAppNumber(href)
  } else if (contactType.includes('principal')) {
    destination = `tel:+${MANAGER.phoneRaw}`
  } else if (contactType.includes('alternativo')) {
    destination = `tel:+${MANAGER.alternatePhoneRaw}`
  } else if (label.includes('llamar')) {
    destination = `tel:+${MANAGER.phoneRaw}`
  }

  if (!destination) return

  event.preventDefault()
  event.stopPropagation()

  if (
    anchor.target === '_blank' &&
    !destination.startsWith('tel:')
  ) {
    window.open(destination, '_blank', 'noopener,noreferrer')
    return
  }

  window.location.assign(destination)
}

export default function IntapProfileBioPestsManager() {
  useEffect(() => {
    document.title = `${MANAGER.name} | ${MANAGER.role} de BioPests`

    upsertMeta(
      'meta[name="description"]',
      'name',
      'description',
      `${MANAGER.name}, ${MANAGER.role} de BioPests. Manejo integral de plagas, evaluación técnica, prevención y monitoreo empresarial.`,
    )
    upsertMeta(
      'meta[property="og:title"]',
      'property',
      'og:title',
      `${MANAGER.name} | ${MANAGER.role} de BioPests`,
    )
    upsertMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
      `${MANAGER.name}, ${MANAGER.role} de BioPests. Soluciones empresariales para prevenir, controlar y monitorear plagas.`,
    )
    upsertMeta(
      'meta[property="og:url"]',
      'property',
      'og:url',
      MANAGER.canonicalUrl,
    )
    upsertMeta(
      'meta[property="og:image"]',
      'property',
      'og:image',
      MANAGER.previewImage,
    )
    upsertMeta(
      'meta[name="twitter:card"]',
      'name',
      'twitter:card',
      'summary_large_image',
    )
    upsertMeta(
      'meta[name="twitter:title"]',
      'name',
      'twitter:title',
      `${MANAGER.name} | ${MANAGER.role} de BioPests`,
    )
    upsertMeta(
      'meta[name="twitter:description"]',
      'name',
      'twitter:description',
      `${MANAGER.name}, ${MANAGER.role} de BioPests. Manejo integral de plagas para empresas.`,
    )
    upsertMeta(
      'meta[name="twitter:image"]',
      'name',
      'twitter:image',
      MANAGER.previewImage,
    )

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )

    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }

    canonical.href = MANAGER.canonicalUrl
  }, [])

  return (
    <div
      className="biopests-manager-profile"
      data-biopests-profile="manager"
      onClickCapture={handleManagerLinkClick}
    >
      <IntapProfileBioPests />
    </div>
  )
}
