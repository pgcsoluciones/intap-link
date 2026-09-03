import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

function appOrigin() {
  // Canonical public hosts must always hand off to the admin APP host.
  // Resolve them at runtime before considering build-time env values so a
  // local/CI env override can never keep /activate-product on the public site.
  const host = window.location.hostname.toLowerCase()
  if (host === 'preview.intaprd.com') return 'https://app.preview.intaprd.com'
  if (host === 'intaprd.com' || host === 'www.intaprd.com' || host === 'link.intaprd.com') {
    return 'https://app.intaprd.com'
  }

  const configured = String(import.meta.env.VITE_APP_URL || '').replace(/\/$/, '')
  if (configured) return configured

  return host.includes('preview')
    ? 'https://app.preview.intaprd.com'
    : 'https://app.intaprd.com'
}

type ProductState = 'loading' | 'pending_activation' | 'activated' | 'profile_draft' | 'profile_draft_owner' | 'blocked' | 'unavailable' | 'not_ready' | 'later' | 'error'

type ArtifactInfo = {
  public_code?: string
  product_type?: string
  label?: string
}

export default function ArtifactLinkResolver() {
  const { publicCode = '' } = useParams()
  const [state, setState] = useState<ProductState>('loading')
  const [artifact, setArtifact] = useState<ArtifactInfo | null>(null)
  const [profileUrl, setProfileUrl] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [message, setMessage] = useState('')
  const [starting, setStarting] = useState(false)

  const code = publicCode.trim().toUpperCase()

  useEffect(() => {
    let active = true

    const inspect = async () => {
      if (!code) {
        setMessage('Este producto no tiene un identificador válido.')
        setState('error')
        return
      }

      try {
        const response = await fetch(`${appOrigin()}/api/v1/public/artifacts/scan/status`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_code: code }),
        })
        const json: any = await response.json().catch(() => ({ ok: false }))
        if (!active) return

        if (!response.ok || !json?.ok) {
          setMessage(json?.error || 'No pudimos abrir este producto.')
          setState('error')
          return
        }

        setArtifact(json.artifact || null)
        setProfileUrl(String(json.next_url || ''))
        setLoginUrl(String(json.login_url || ''))
        setMessage(String(json.message || ''))
        setState(String(json.state || 'error') as ProductState)
      } catch {
        if (!active) return
        setMessage('No pudimos conectar con Kawvo. Intenta nuevamente.')
        setState('error')
      }
    }

    void inspect()
    return () => { active = false }
  }, [code])

  const activateNow = () => {
    if (!code || starting) return
    setStarting(true)
    setMessage('')

    // Public site only confirms intention. Handoff must be an absolute APP URL.
    window.location.assign(`${appOrigin()}/activate-product/${encodeURIComponent(code)}`)
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    textAlign: 'center',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 28,
    padding: 28,
    boxShadow: '0 18px 55px rgba(15,23,42,.08)',
  }

  const primaryButton: React.CSSProperties = {
    width: '100%',
    border: 0,
    borderRadius: 16,
    padding: '15px 18px',
    background: '#0f172a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  }

  const secondaryButton: React.CSSProperties = {
    ...primaryButton,
    marginTop: 10,
    background: '#fff',
    color: '#475569',
    border: '1px solid #e2e8f0',
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f9fc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={cardStyle}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: '.22em', color: '#0891b2' }}>KAWVO LINK</p>

        {state === 'loading' && (
          <>
            <div style={{ width: 42, height: 42, margin: '20px auto 0', border: '4px solid #e2e8f0', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            <h1 style={{ margin: '16px 0 8px', fontSize: 24 }}>Reconociendo tu producto…</h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>Estamos comprobando su estado.</p>
          </>
        )}

        {state === 'pending_activation' && (
          <>
            <div style={{ width: 48, height: 48, margin: '20px auto 0', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#ecfeff', color: '#0891b2', fontSize: 24, fontWeight: 900 }}>✓</div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 26 }}>Bienvenido a Kawvo Link</h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>Encontramos tu {artifact?.label || 'producto Kawvo'}.</p>
            <div style={{ margin: '18px 0', padding: 16, borderRadius: 18, background: '#f8fafc', textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#64748b' }}>ESTADO</p>
              <p style={{ margin: '5px 0 0', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>Pendiente de activar</p>
            </div>
            <p style={{ margin: '0 0 18px', lineHeight: 1.6, color: '#475569' }}>¿Deseas activarlo ahora?</p>
            <button type="button" onClick={activateNow} disabled={starting} style={{ ...primaryButton, opacity: starting ? .6 : 1 }}>
              {starting ? 'Continuando…' : 'Activarlo ahora'}
            </button>
            <button type="button" onClick={() => setState('later')} style={secondaryButton}>Lo haré más tarde</button>
            {message && <p style={{ margin: '14px 0 0', color: '#be123c', lineHeight: 1.5 }}>{message}</p>}
          </>
        )}

        {state === 'later' && (
          <>
            <div style={{ width: 48, height: 48, margin: '20px auto 0', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#f1f5f9', color: '#475569', fontSize: 22 }}>✓</div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 25 }}>Puedes activarlo cuando quieras</h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>Tu producto sigue pendiente y disponible. Cuando estés listo, vuelve a escanear su QR o NFC.</p>
            <button type="button" onClick={() => setState('pending_activation')} style={{ ...secondaryButton, marginTop: 20 }}>Volver</button>
          </>
        )}

        {(state === 'profile_draft' || state === 'profile_draft_owner') && (
          <>
            <div style={{ width: 48, height: 48, margin: '20px auto 0', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#fff7ed', color: '#c2410c', fontSize: 22, fontWeight: 900 }}>…</div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 26 }}>Perfil en construcción</h1>
            <p style={{ margin: '0 0 20px', lineHeight: 1.6, color: '#64748b' }}>
              {state === 'profile_draft_owner'
                ? (message || 'Tu Perfil Digital todavía está en construcción.')
                : 'Este Perfil Digital todavía está en construcción. Su propietario está preparando su presentación en Kawvo Link.'}
            </p>

            {state === 'profile_draft_owner' && profileUrl && (
              <button type="button" onClick={() => window.location.assign(profileUrl)} style={primaryButton}>
                Continuar configurando mi perfil
              </button>
            )}

            {state === 'profile_draft' && loginUrl && (
              <>
                <button type="button" onClick={() => window.location.assign(loginUrl)} style={primaryButton}>
                  Soy el propietario · Iniciar sesión
                </button>
                <button type="button" onClick={() => window.location.assign('https://nfc.kawvoia.com')} style={secondaryButton}>
                  Conocer Kawvo Link
                </button>
              </>
            )}
          </>
        )}

        {state === 'activated' && (
          <>
            <div style={{ width: 48, height: 48, margin: '20px auto 0', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#ecfdf5', color: '#047857', fontSize: 24, fontWeight: 900 }}>✓</div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 26 }}>Este producto ya está activo</h1>
            <p style={{ margin: '0 0 20px', lineHeight: 1.6, color: '#64748b' }}>{artifact?.label || 'Tu producto Kawvo'} ya está conectado a un Perfil Digital.</p>
            {profileUrl ? (
              <button type="button" onClick={() => window.location.assign(profileUrl)} style={primaryButton}>Abrir Perfil Digital</button>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>El producto está activo, pero su perfil todavía no está disponible públicamente.</p>
            )}
          </>
        )}

        {(state === 'blocked' || state === 'unavailable' || state === 'not_ready' || state === 'error') && (
          <>
            <h1 style={{ margin: '18px 0 8px', fontSize: 24 }}>
              {state === 'blocked' ? 'Producto no disponible' : state === 'not_ready' ? 'Producto pendiente de habilitación' : 'No pudimos continuar'}
            </h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>{message || 'No pudimos comprobar este producto.'}</p>
          </>
        )}
      </section>
    </main>
  )
}
