import { useEffect, type MouseEvent } from 'react'
import IntapProfileBioPests from './IntapProfileBioPests'
import './IntapProfileBioPestsVariant.css'

const MANAGER = {
  name: 'Rene Prieto',
  role: 'CEO',
  phoneRaw: '18292469777',
  alternatePhoneRaw: '18297500908',
  vcardUrl:
    '/assets/biopestrd/contacts/rene-prieto-biopests-final.vcf?v=20260731-3',
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

function downloadVcard() {
  const anchor = document.createElement('a')
  anchor.href = MANAGER.vcardUrl
  anchor.download = MANAGER.vcardFilename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function handleLinkClick(event: MouseEvent<HTMLDivElement>) {
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest('a')
  if (!(anchor instanceof HTMLAnchorElement)) return

  const label = (anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const href = anchor.getAttribute('href') || ''
  const contactType = anchor.querySelector('small')?.textContent?.trim().toLowerCase() || ''

  if (label.includes('guardar contacto')) {
    event.preventDefault()
    event.stopPropagation()
    downloadVcard()
    return
  }

  let destination: string | null = null
  if (/https:\/\/wa\.me\/\d+/i.test(href)) {
    destination = href.replace(/https:\/\/wa\.me\/\d+/i, `https://wa.me/${MANAGER.phoneRaw}`)
  } else if (contactType.includes('alternativo')) {
    destination = `tel:+${MANAGER.alternatePhoneRaw}`
  } else if (href.startsWith('tel:') || label.includes('llamar')) {
    destination = `tel:+${MANAGER.phoneRaw}`
  }

  if (!destination) return
  event.preventDefault()
  event.stopPropagation()

  if (anchor.target === '_blank' && !destination.startsWith('tel:')) {
    window.open(destination, '_blank', 'noopener,noreferrer')
  } else {
    window.location.assign(destination)
  }
}

export default function IntapProfileBioPestsManager() {
  useEffect(() => {
    const title = `${MANAGER.name} | ${MANAGER.role} de BioPests`
    const description = `${MANAGER.name}, ${MANAGER.role} de BioPests. Manejo integral de plagas para empresas.`
    document.title = title
    upsertMeta('meta[name="description"]', 'name', 'description', description)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description)
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', MANAGER.canonicalUrl)
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', MANAGER.previewImage)
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', MANAGER.previewImage)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = MANAGER.canonicalUrl
  }, [])

  return (
    <div className="biopests-person-profile" data-biopests-profile="manager" onClickCapture={handleLinkClick}>
      <IntapProfileBioPests />
    </div>
  )
}
