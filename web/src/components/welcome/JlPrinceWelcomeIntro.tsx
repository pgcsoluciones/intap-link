import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import './JlPrinceWelcomeIntro.css'

const SESSION_KEY = 'kawvo:jlprince-welcome-intro:v2'
const ASSET_URL = '/assets/welcome/jlprince-welcome-base.png'
const EXIT_AT_MS = 5350
const END_AT_MS = 5850

type JlPrinceWelcomeIntroProps = {
  children: ReactNode
}

function shouldShowIntro() {
  if (typeof window === 'undefined') return false

  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return false
    }

    return window.sessionStorage.getItem(SESSION_KEY) !== '1'
  } catch {
    return false
  }
}

export default function JlPrinceWelcomeIntro({
  children,
}: JlPrinceWelcomeIntroProps) {
  const [visible, setVisible] = useState(shouldShowIntro)
  const [leaving, setLeaving] = useState(false)

  const finish = useCallback((immediate = false) => {
    setLeaving(true)
    if (immediate) {
      window.setTimeout(() => setVisible(false), 240)
    }
  }, [])

  useEffect(() => {
    if (!visible) return

    try {
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // La intro sigue siendo no bloqueante si storage no está disponible.
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const exitTimer = window.setTimeout(() => finish(false), EXIT_AT_MS)
    const endTimer = window.setTimeout(() => setVisible(false), END_AT_MS)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(endTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [finish, visible])

  return (
    <>
      {children}

      {visible && (
        <div
          className={`jlw-intro${leaving ? ' jlw-intro--leaving' : ''}`}
          aria-label="Bienvenida a Kawvo Link"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="jlw-skip"
            onClick={() => finish(true)}
          >
            Saltar
          </button>

          <div className="jlw-stage" aria-hidden="true">
            <div className="jlw-layer jlw-layer--phone">
              <img src={ASSET_URL} alt="" draggable={false} />
            </div>

            <div className="jlw-layer jlw-layer--keychain">
              <img src={ASSET_URL} alt="" draggable={false} />
            </div>

            <div className="jlw-layer jlw-layer--nfc">
              <img src={ASSET_URL} alt="" draggable={false} />
            </div>

            <div className="jlw-layer jlw-layer--final">
              <img src={ASSET_URL} alt="" draggable={false} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
