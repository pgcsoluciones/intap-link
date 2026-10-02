import { useEffect, useRef, useState } from 'react'
import './DemoBankAccounts.css'

type Props = { holderName: string }

const DEMO_NUMBER = '123456789'
const DEMO_MASKED = `•••• ${DEMO_NUMBER.slice(-4)}`

export default function DemoBankAccounts({ holderName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!expanded) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && !sectionRef.current?.contains(target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [expanded])

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value) } catch { /* demo only */ }
    window.setTimeout(() => setExpanded(false), 720)
  }

  return (
    <section ref={sectionRef} className="kawvo-demo-bank" aria-label="Ejemplo de cuentas bancarias">
      <button type="button" className="kawvo-demo-bank-toggle" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-controls="kawvo-demo-bank-content">
        <h2>Cuentas</h2>
        <span aria-hidden="true" className={expanded ? 'is-open' : ''}>⌄</span>
      </button>

      {expanded && <div id="kawvo-demo-bank-content">
        <article>
          <div className="kawvo-demo-bank-card-top">
            <div className="kawvo-demo-bank-logo" aria-label="Banco de ejemplo">🏦</div>
            <div className="kawvo-demo-bank-data">
              <h3>Banco de ejemplo</h3>
              <b>Cuenta de ahorros · DOP</b>
              <strong>{holderName}</strong>
              <code>{DEMO_MASKED}</code>
            </div>
          </div>
          <div className="kawvo-demo-bank-actions">
            <button type="button" onClick={() => void copy(DEMO_NUMBER)} aria-label="Cuenta">Cuenta</button>
            <button type="button" onClick={() => void copy(DEMO_NUMBER)} aria-label="RNC o cédula">RNC / CÉD.</button>
          </div>
        </article>
      </div>}
    </section>
  )
}
