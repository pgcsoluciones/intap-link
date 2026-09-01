import { useState } from 'react'
import './DemoBankAccounts.css'

type Props = { holderName: string }

const DEMO_NUMBER = '123456789'
const DEMO_MASKED = `•••• ${DEMO_NUMBER.slice(-4)}`

export default function DemoBankAccounts({ holderName }: Props) {
  const [copied, setCopied] = useState<'account' | 'id' | null>(null)

  async function copy(value: string, key: 'account' | 'id') {
    try { await navigator.clipboard.writeText(value) } catch { /* demo only */ }
    setCopied(key)
    window.setTimeout(() => setCopied((current) => current === key ? null : current), 1600)
  }

  return (
    <section className="kawvo-demo-bank" aria-label="Ejemplo de cuentas bancarias">
      <div className="kawvo-demo-bank-head">
        <div>
          <p>DATOS PARA TRANSFERENCIAS</p>
          <h2>Cuentas bancarias</h2>
          <span>Así puede verse esta sección dentro de tu Perfil Digital.</span>
        </div>
        <div className="kawvo-demo-bank-generic" aria-hidden="true">↗</div>
      </div>

      <article>
        <div className="kawvo-demo-bank-card-top">
          <div className="kawvo-demo-bank-logo" aria-label="Banco de ejemplo">🏦</div>
          <div className="kawvo-demo-bank-data">
            <h3>Banco de ejemplo</h3>
            <b>Cuenta de ahorros · DOP</b>
            <strong>{holderName}</strong>
            <code>{DEMO_MASKED}</code>
            <small>Cédula/RNC de ejemplo · {DEMO_MASKED}</small>
          </div>
        </div>
        <div className="kawvo-demo-bank-actions">
          <button type="button" onClick={() => void copy(DEMO_NUMBER, 'account')}>
            {copied === 'account' ? '✓ Cuenta copiada' : 'Copiar cuenta'}
          </button>
          <button type="button" onClick={() => void copy(DEMO_NUMBER, 'id')}>
            {copied === 'id' ? '✓ ID copiado' : 'Copiar cédula/RNC'}
          </button>
        </div>
      </article>

    </section>
  )
}
