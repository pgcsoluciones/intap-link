import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import './JlPrinceWelcomeIntro.css'

const SESSION_KEY = 'kawvo:jlprince-welcome-intro:v1'
const EXIT_AT_MS = 2820
const END_AT_MS = 3220

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
    if (immediate) {
      setLeaving(true)
      window.setTimeout(() => setVisible(false), 220)
      return
    }

    setLeaving(true)
  }, [])

  useEffect(() => {
    if (!visible) return

    try {
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // If storage is unavailable, the intro still remains non-blocking.
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

          <div className="jlw-scene" aria-hidden="true">
            <svg
              className="jlw-key-hand"
              viewBox="0 0 420 440"
              focusable="false"
            >
              <g className="jlw-key-art" fill="none" stroke="currentColor">
                <path
                  d="M63 324c-8-54 0-113 36-154 23-27 59-44 89-24 18 12 20 33 8 49-13 17-35 23-51 38-19 18-24 48-26 74"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M115 252c22 11 31 31 27 58M151 224c23 11 34 31 31 56M187 203c22 11 32 28 31 50"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M31 399c37-68 67-109 106-135 35-24 67-34 111-33l52 2"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <circle cx="282" cy="123" r="49" strokeWidth="8" />
                <circle cx="282" cy="123" r="35" strokeWidth="4" opacity=".35" />
                <path d="M281 169v32" strokeWidth="8" strokeLinecap="round" />
                <path d="M282 185c-5 0-10 5-10 11s5 11 10 11 10-5 10-11-5-11-10-11Z" fill="white" strokeWidth="6" />
                <circle cx="282" cy="279" r="80" strokeWidth="8" fill="#edf4ff" />
                <rect x="244" y="246" width="20" height="20" rx="2" strokeWidth="7" />
                <rect x="300" y="246" width="20" height="20" rx="2" strokeWidth="7" />
                <rect x="244" y="302" width="20" height="20" rx="2" strokeWidth="7" />
                <path d="M277 247h10v10h-10v10h12v10h-9v11h-12v-10h9v-10h10" strokeWidth="7" />
                <path d="M300 282h19v9h-9v10h10v20h-10v-10h-10v-10h-10v-10h10Z" strokeWidth="7" />
                <text
                  x="282"
                  y="349"
                  textAnchor="middle"
                  fill="currentColor"
                  stroke="none"
                  fontSize="22"
                  fontWeight="800"
                  fontFamily="Arial, sans-serif"
                >
                  KAWVO
                </text>
              </g>
            </svg>

            <div className="jlw-nfc" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className="jlw-phone-wrap">
              <svg
                className="jlw-phone-hand"
                viewBox="0 0 480 690"
                focusable="false"
              >
                <g fill="none" stroke="currentColor" strokeLinecap="round">
                  <path
                    d="M395 315c30 14 38 46 40 81l6 112c2 58-25 113-71 148"
                    strokeWidth="9"
                  />
                  <path
                    d="M376 365c24-10 47 1 57 25M374 418c23-8 42 3 53 23M369 470c21-6 38 5 47 23"
                    strokeWidth="7"
                    opacity=".55"
                  />
                </g>
              </svg>

              <div className="jlw-phone">
                <div className="jlw-phone-top">
                  <span>9:41</span>
                  <span className="jlw-dynamic-island" />
                  <span className="jlw-status">● ◔ ▰</span>
                </div>

                <div className="jlw-screen">
                  <div className="jlw-profile">
                    <div className="jlw-cover">
                      <span className="jlw-cover-plant" />
                      <span className="jlw-cover-desk" />
                      <span className="jlw-cover-chair" />
                    </div>

                    <div className="jlw-avatar">
                      <span className="jlw-avatar-hair" />
                      <span className="jlw-avatar-face" />
                      <span className="jlw-avatar-body" />
                    </div>

                    <div className="jlw-name">Laura Méndez</div>
                    <div className="jlw-role">Coach de bienestar</div>

                    <div className="jlw-whatsapp">
                      <span>◉</span>
                      <strong>Hablar por WhatsApp</strong>
                    </div>

                    <div className="jlw-actions">
                      <div><span>☎</span><b>Llamar</b></div>
                      <div><span>◎</span><b>Instagram</b></div>
                      <div><span>⌖</span><b>Ubicación</b></div>
                    </div>

                    <div className="jlw-save">▣ Guardar contacto</div>

                    <div className="jlw-about">
                      <strong>Sobre mí</strong>
                      <p>Te acompaño a crear una vida más saludable, consciente y en equilibrio.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="jlw-caption">
            Acerca. Conecta. Comparte.
          </p>
        </div>
      )}
    </>
  )
}
