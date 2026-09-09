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

export function installTeamCopyFallback() {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (!(button instanceof HTMLButtonElement)) return
    const text = String(button.textContent || '').trim()
    if (!text.includes('TEAM-')) return
    const match = text.match(/TEAM-[A-Z0-9]+-[A-Z0-9]+/i)
    if (!match) return
    const code = match[0].toUpperCase()

    showCopiedFeedback(button)

    // The component already tries the modern Clipboard API. This fallback is
    // intentionally delayed so it only matters on browsers/contexts where that
    // path is unavailable or rejected.
    window.setTimeout(() => {
      try { fallbackCopy(code) } catch { /* keep the visible code selectable */ }
    }, 0)
  }, true)
}
