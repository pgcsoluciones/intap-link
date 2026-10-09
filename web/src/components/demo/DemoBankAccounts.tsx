import { useState } from 'react'
import './DemoBankAccounts.css'

type Props = { holderName: string }

const DEMO_NUMBER = '123456789'
const DEMO_ID = '00112345678'
const DEMO_MASKED = `•••• ${DEMO_NUMBER.slice(-4)}`
const DEMO_ID_MASKED = `•••• ${DEMO_ID.slice(-4)}`

export default function DemoBankAccounts({ holderName }: Props) {
  const [copied, setCopied] = useState('')

  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value) } catch { /* demo only */ }
    setCopied(key)
    window.setTimeout(() => setCopied((current) => current === key ? '' : current), 1500)
  }

  return (
    <section className="kawvo-demo-bank" aria-label="Datos para Transferencias">
      <div className="kawvo-demo-bank-toggle">
        <span className="kawvo-demo-bank-title"><span aria-hidden="true" className="kawvo-demo-bank-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3 3 7v2h18V7l-9-4Zm-7 8v6H3v2h18v-2h-2v-6h-2v6h-3v-6h-2v6H9v-6H7v6H5v-6Z"/></svg></span><h2>Datos para Transferencias</h2></span>
      </div>

      <div id="kawvo-demo-bank-content">
        <article>
          <div className="kawvo-demo-bank-card-top">
            <div className="kawvo-demo-bank-logo" aria-label="Banco de ejemplo">🏦</div>
            <div className="kawvo-demo-bank-data">
              <h3>Banco de ejemplo</h3>
              <b>Cuenta de ahorros · DOP</b>
              <strong>{holderName}</strong>
              <code>{DEMO_MASKED}</code>
              <em>Cédula: {DEMO_ID_MASKED}</em>
            </div>
          </div>
          <div className="kawvo-demo-bank-actions">
            <button type="button" onClick={() => void copy(DEMO_NUMBER, 'account')} aria-live="polite">{copied === 'account' ? 'Cuenta copiada' : 'Copiar cuenta'}</button>
            <button type="button" onClick={() => void copy(DEMO_ID, 'id')} aria-live="polite">{copied === 'id' ? 'RNC/CÉD. copiada' : 'Copiar RNC/CÉD.'}</button>
          </div>
        </article>
      </div>
    </section>
  )
}
