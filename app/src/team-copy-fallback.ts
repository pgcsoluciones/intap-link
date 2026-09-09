function fallbackCopy(value: string) {
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.focus()
  area.select()
  area.setSelectionRange(0, value.length)
  const ok = document.execCommand('copy')
  area.remove()
  return ok
}

const COPY_FEEDBACK_MS = 1600

function showCopiedFeedback(button: HTMLButtonElement) {
  const original = String(button.textContent || '').trim()
  if (!original || button.dataset.teamCopyFeedback === '1') return
  button.dataset.teamCopyFeedback = '1'
  button.textContent = 'Código copiado'
  button.setAttribute('aria-live', 'polite')
  window.setTimeout(() => {
    if (button.isConnected) button.textContent = original
    delete button.dataset.teamCopyFeedback
  }, COPY_FEEDBACK_MS)
}

function teamCodeFromArticle(article: HTMLElement) {
  for (const button of Array.from(article.querySelectorAll('button'))) {
    const match = String(button.textContent || '').match(/TEAM-[A-Z0-9]+-[A-Z0-9]+/i)
    if (match) return match[0].toUpperCase()
  }
  return ''
}

function articleIsAssigned(article: HTMLElement) {
  const text = String(article.textContent || '').toLowerCase()
  return text.includes('asignado') || text.includes('miembro asignado')
}

function actionContainer(article: HTMLElement) {
  return Array.from(article.querySelectorAll('div')).find((node) => {
    const text = String(node.textContent || '')
    return text.includes('Desactivar') || text.includes('Reactivar') || text.includes('Eliminar código') || text.includes('Copiar')
  }) as HTMLElement | undefined
}

function addCopyControl(article: HTMLElement) {
  const code = teamCodeFromArticle(article)
  if (!code || article.querySelector('[data-team-code-copy]')) return
  const actions = actionContainer(article) || article
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.teamCodeCopy = code
  button.textContent = 'Copiar'
  button.className = 'rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800'
  button.setAttribute('aria-label', `Copiar ${code}`)
  actions.appendChild(button)
}

function addDeleteControl(article: HTMLElement) {
  if (article.dataset.teamDeleteReady === '1') return
  const code = teamCodeFromArticle(article)
  if (!code || articleIsAssigned(article)) return

  article.dataset.teamDeleteReady = '1'
  const actions = actionContainer(article) || article

  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.teamCodeDelete = code
  button.textContent = 'Eliminar código'
  button.className = 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700'
  button.setAttribute('aria-label', `Eliminar ${code}`)
  actions.appendChild(button)
}

function addPageSizeLabel(section: HTMLElement, label: string) {
  if (section.querySelector(`[data-team-page-size="${label}"]`)) return
  const heading = Array.from(section.querySelectorAll('h2')).find((node) => String(node.textContent || '').trim() === label)
  if (!heading) return
  const badge = document.createElement('span')
  badge.dataset.teamPageSize = label
  badge.textContent = '5 por página'
  badge.className = 'ml-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 align-middle text-[10px] font-black uppercase tracking-wide text-slate-500'
  heading.appendChild(badge)
}

function setReactInputValue(input: HTMLInputElement, value: number) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(input, String(Math.min(50, Math.max(1, value))))
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function addQuantityStepper(section: HTMLElement) {
  if (section.dataset.teamQuantityReady === '1') return
  const heading = Array.from(section.querySelectorAll('h2')).find((node) => String(node.textContent || '').trim() === 'Generar códigos')
  if (!heading) return
  const input = section.querySelector('input[type="number"]') as HTMLInputElement | null
  if (!input) return

  section.dataset.teamQuantityReady = '1'
  input.classList.add('text-center')
  input.setAttribute('inputmode', 'numeric')
  input.addEventListener('focus', () => input.select())

  const wrapper = document.createElement('div')
  wrapper.className = 'ml-2 inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white'

  const minus = document.createElement('button')
  minus.type = 'button'
  minus.textContent = '−'
  minus.className = 'h-10 w-10 text-lg font-black text-slate-700 disabled:opacity-30'
  minus.setAttribute('aria-label', 'Disminuir cantidad de códigos')
  minus.addEventListener('click', () => {
    const current = Number(input.value || 1) || 1
    setReactInputValue(input, current - 1)
  })

  const plus = document.createElement('button')
  plus.type = 'button'
  plus.textContent = '+'
  plus.className = 'h-10 w-10 text-lg font-black text-slate-700 disabled:opacity-30'
  plus.setAttribute('aria-label', 'Aumentar cantidad de códigos')
  plus.addEventListener('click', () => {
    const current = Number(input.value || 1) || 1
    setReactInputValue(input, current + 1)
  })

  const parent = input.parentElement
  if (!parent) return
  input.classList.remove('ml-2')
  input.classList.add('w-16', 'border-0', 'bg-transparent', 'px-2')
  wrapper.append(minus, input, plus)
  parent.appendChild(wrapper)
}

function enhanceTeamScreen() {
  for (const article of Array.from(document.querySelectorAll('article'))) {
    addCopyControl(article as HTMLElement)
    addDeleteControl(article as HTMLElement)
  }
  for (const section of Array.from(document.querySelectorAll('section'))) {
    addPageSizeLabel(section as HTMLElement, 'Códigos y asignaciones')
    addPageSizeLabel(section as HTMLElement, 'Perfiles del equipo')
    addQuantityStepper(section as HTMLElement)
  }
}

async function copyTeamCode(button: HTMLButtonElement, code: string) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code)
    else fallbackCopy(code)
    showCopiedFeedback(button)
  } catch {
    try {
      fallbackCopy(code)
      showCopiedFeedback(button)
    } catch {
      window.alert('No pudimos copiar el código.')
    }
  }
}

async function deleteTeamCode(button: HTMLButtonElement, code: string) {
  if (!window.confirm(`¿Eliminar el código ${code}?\n\nEsta acción solo está disponible para códigos sin uso y no se puede deshacer.`)) return
  const original = button.textContent || 'Eliminar código'
  button.disabled = true
  button.textContent = 'Eliminando…'
  try {
    const response = await fetch('/api/v1/me/team/codes/delete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const json: any = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) {
      window.alert(json?.error || 'No pudimos eliminar este código.')
      button.disabled = false
      button.textContent = original
      return
    }
    window.location.reload()
  } catch {
    window.alert('No pudimos conectar para eliminar el código.')
    button.disabled = false
    button.textContent = original
  }
}

export function installTeamCopyFallback() {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (!(button instanceof HTMLButtonElement)) return

    const deleteCode = String(button.dataset.teamCodeDelete || '').trim().toUpperCase()
    if (deleteCode) {
      event.preventDefault()
      event.stopPropagation()
      void deleteTeamCode(button, deleteCode)
      return
    }

    const explicitCopy = String(button.dataset.teamCodeCopy || '').trim().toUpperCase()
    if (explicitCopy) {
      event.preventDefault()
      event.stopPropagation()
      void copyTeamCode(button, explicitCopy)
      return
    }

    const text = String(button.textContent || '').trim()
    if (!text.includes('TEAM-')) return
    const match = text.match(/TEAM-[A-Z0-9]+-[A-Z0-9]+/i)
    if (!match) return
    const code = match[0].toUpperCase()

    showCopiedFeedback(button)

    window.setTimeout(() => {
      try { fallbackCopy(code) } catch { /* keep the visible code selectable */ }
    }, 0)
  }, true)

  const observer = new MutationObserver(() => enhanceTeamScreen())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  enhanceTeamScreen()
}
