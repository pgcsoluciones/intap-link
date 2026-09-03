import { useEffect } from 'react'

const KAWVO_LINK_HOME = 'https://nfc.kawvoia.com'
const KAWVO_LOGO_FULL = '/assets/free-starter/branding/logo-completo.png'
const KAWVO_404_AVATAR = '/assets/free-starter/branding/avatar-404.png'

function makeAction(label: string, className: string) {
  const link = document.createElement('a')
  link.href = KAWVO_LINK_HOME
  link.className = className
  link.textContent = label
  return link
}

function enhanceCard(card: HTMLElement) {
  if (card.dataset.kawvoEnhanced === '1') return

  const originalTitle = card.querySelector('h1')?.textContent || ''
  const isPrivate = originalTitle.toLowerCase().includes('privado')

  card.dataset.kawvoEnhanced = '1'
  card.innerHTML = ''

  const logo = document.createElement('img')
  logo.src = KAWVO_LOGO_FULL
  logo.alt = 'Kawvo'
  logo.className = 'kawvo-error-logo'
  card.appendChild(logo)

  const avatar = document.createElement('img')
  avatar.src = KAWVO_404_AVATAR
  avatar.alt = ''
  avatar.className = 'kawvo-error-avatar'
  avatar.setAttribute('aria-hidden', 'true')
  card.appendChild(avatar)

  const title = document.createElement('h1')
  title.className = 'kawvo-error-title'
  title.textContent = isPrivate ? 'Perfil privado' : 'Perfil no disponible'
  card.appendChild(title)

  const text = document.createElement('p')
  text.className = 'kawvo-error-copy'
  text.textContent = isPrivate
    ? 'Este perfil no está disponible públicamente en este momento.'
    : 'Este perfil no existe, aún no está publicado o no está disponible en este momento.'
  card.appendChild(text)

  const actions = document.createElement('div')
  actions.className = 'kawvo-error-actions'
  actions.appendChild(makeAction('Conocer Kawvo Link', 'kawvo-error-primary'))
  actions.appendChild(makeAction('Volver al inicio', 'kawvo-error-secondary'))
  card.appendChild(actions)
}

function enhanceVisibleErrors() {
  document
    .querySelectorAll<HTMLElement>('.public-profile.error-page .profile-card')
    .forEach(enhanceCard)
}

export default function PublicProfileErrorEnhancer() {
  useEffect(() => {
    enhanceVisibleErrors()

    const observer = new MutationObserver(enhanceVisibleErrors)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
