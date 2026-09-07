import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const KAWVO_COMPACT_LOGO = '/assets/free-starter/branding/logo-solo.png'
const TEAM_CODE_KEY = 'kawvo_team_join_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

function appOrigin() {
  const host = window.location.hostname.toLowerCase()
  if (host === 'preview.intaprd.com') return 'https://app.preview.intaprd.com'
  if (host === 'intaprd.com' || host === 'www.intaprd.com' || host === 'link.intaprd.com') return 'https://app.intaprd.com'
  const configured = String(import.meta.env.VITE_APP_URL || '').replace(/\/$/, '')
  if (configured) return configured
  return host.includes('preview') ? 'https://app.preview.intaprd.com' : 'https://app.intaprd.com'
}

type ProductState = 'loading' | 'pending_activation' | 'profile_draft' | 'profile_draft_owner' | 'blocked' | 'unavailable' | 'not_ready' | 'later' | 'error'
type ArtifactInfo = { public_code?: string; product_type?: string; label?: string }

export default function ArtifactLinkResolver() {
  const { publicCode = '' } = useParams()
  const [state, setState] = useState<ProductState>('loading')
  const [artifact, setArtifact] = useState<ArtifactInfo | null>(null)
  const [profileUrl, setProfileUrl] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [message, setMessage] = useState('')
  const [starting, setStarting] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamCode, setTeamCode] = useState('')
  const [teamChecking, setTeamChecking] = useState(false)
  const [teamResult, setTeamResult] = useState<any>(null)
  const [teamError, setTeamError] = useState('')

  const code = publicCode.trim().toUpperCase()

  useEffect(() => {
    let active = true
    const inspect = async () => {
      if (!code) { setMessage('Este producto no tiene un identificador válido.'); setState('error'); return }
      try {
        const response = await fetch(`${appOrigin()}/api/v1/public/artifacts/scan/status`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_code: code }),
        })
        const json: any = await response.json().catch(() => ({ ok: false }))
        if (!active) return
        if (!response.ok || !json?.ok) { setMessage(json?.error || 'No pudimos abrir este producto.'); setState('error'); return }
        const nextUrl = String(json.next_url || '')
        if (json.state === 'activated' && nextUrl) { window.location.replace(nextUrl); return }
        setArtifact(json.artifact || null)
        setProfileUrl(nextUrl)
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
    window.location.assign(`${appOrigin()}/activate-product/${encodeURIComponent(code)}`)
  }

  const inspectTeamCode = async () => {
    const normalized = teamCode.trim().toUpperCase()
    if (!normalized) return
    setTeamChecking(true); setTeamError(''); setTeamResult(null)
    try {
      const response = await fetch(`${appOrigin()}/api/v1/public/team/code/inspect`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: normalized, public_code: code }),
      })
      const json: any = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !json?.ok) { setTeamError(json?.error || 'No pudimos validar el código Team.'); return }

      const nameResponse = await fetch(`${appOrigin()}/api/v1/public/team/name`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_id: json.data?.team_id }),
      })
      const nameJson: any = await nameResponse.json().catch(() => ({ ok: false }))
      if (!nameResponse.ok || !nameJson?.ok) { setTeamError(nameJson?.error || 'No pudimos identificar el Team de este código.'); return }

      setTeamCode(normalized)
      setTeamResult({ ...json.data, ...nameJson.data })
    } catch { setTeamError('No pudimos validar el código Team.') }
    finally { setTeamChecking(false) }
  }

  const continueTeam = () => {
    if (!teamResult || !teamCode || !code) return
    sessionStorage.setItem(TEAM_CODE_KEY, teamCode)
    localStorage.setItem(TEAM_CODE_KEY, teamCode)
    sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, code)
    localStorage.setItem(SCAN_PUBLIC_CODE_KEY, code)
    window.location.assign(`${appOrigin()}/admin/login?activation=team&public_code=${encodeURIComponent(code)}&team_code=${encodeURIComponent(teamCode)}`)
  }

  if (state === 'loading') return <main aria-busy="true" style={{ minHeight: '100vh', background: '#fff' }} />

  const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 28, padding: 28, boxShadow: '0 18px 55px rgba(15,23,42,.08)' }
  const primaryButton: React.CSSProperties = { width: '100%', border: 0, borderRadius: 16, padding: '15px 18px', background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }
  const secondaryButton: React.CSSProperties = { ...primaryButton, marginTop: 10, background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f9fc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={cardStyle}>
        <img src={KAWVO_COMPACT_LOGO} alt="Kawvo" style={{ display: 'block', width: 124, maxWidth: '48%', height: 36, objectFit: 'contain', margin: '0 auto' }} />

        {state === 'pending_activation' && (
          <>
            <div style={{ width: 48, height: 48, margin: '20px auto 0', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#ecfeff', color: '#0891b2', fontSize: 24, fontWeight: 900 }}>✓</div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 26 }}>Bienvenido a Kawvo Link</h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>Encontramos tu {artifact?.label || 'producto Kawvo'}.</p>

            {!teamOpen && <div style={{ marginTop: 22 }}>
              <button type="button" onClick={activateNow} disabled={starting} style={{ ...primaryButton, opacity: starting ? .6 : 1 }}>{starting ? 'Continuando…' : 'Activar desde cero'}</button>
              <button type="button" onClick={() => { setTeamOpen(true); setTeamError(''); setTeamResult(null) }} style={secondaryButton}>Vincular a un perfil (Team)</button>
              <button type="button" onClick={() => setState('later')} style={secondaryButton}>Activar luego</button>
            </div>}

            {teamOpen && !teamResult && <div style={{ marginTop: 22, textAlign: 'left' }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>Vincular a un Team</h2>
              <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55, fontSize: 14 }}>Ingresa el código de vinculación suministrado por el administrador Team.</p>
              <input value={teamCode} onChange={(event) => setTeamCode(event.target.value.toUpperCase())} placeholder="TEAM-XXXX-XXXX" autoComplete="off" spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', marginTop: 16, border: '1px solid #cbd5e1', borderRadius: 14, padding: '14px 15px', fontSize: 15, fontWeight: 800, textTransform: 'uppercase', background: '#f8fafc' }} />
              {teamError && <p style={{ margin: '12px 0 0', color: '#be123c', fontSize: 13, lineHeight: 1.5 }}>{teamError}</p>}
              <button type="button" onClick={() => void inspectTeamCode()} disabled={teamChecking || !teamCode.trim()} style={{ ...primaryButton, marginTop: 14, opacity: teamChecking || !teamCode.trim() ? .5 : 1 }}>{teamChecking ? 'Validando…' : 'Validar código'}</button>
              <button type="button" onClick={() => { setTeamOpen(false); setTeamCode(''); setTeamError('') }} style={secondaryButton}>Volver</button>
            </div>}

            {teamOpen && teamResult && <div style={{ marginTop: 22, textAlign: 'left' }}>
              <div style={{ border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: 18, padding: 16 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: '#0369a1' }}>TEAM CONFIRMADO</p>
                <h2 style={{ margin: '6px 0 0', fontSize: 22 }}>{teamResult.team_name}</h2>
                {teamResult.master_name && teamResult.master_name !== teamResult.team_name && <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Perfil principal: {teamResult.master_name}</p>}
                <p style={{ margin: '12px 0 0', color: '#334155', lineHeight: 1.5, fontSize: 14, fontWeight: 700 }}>Confirma que este es el Team correcto antes de continuar.</p>
                <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.5, fontSize: 13 }}>Este producto quedará vinculado a este Team y el código no podrá volver a utilizarse.</p>
              </div>
              <button type="button" onClick={continueTeam} style={{ ...primaryButton, marginTop: 14 }}>Sí, continuar con {teamResult.team_name}</button>
              <button type="button" onClick={() => { setTeamResult(null); setTeamCode(''); }} style={secondaryButton}>No es mi Team</button>
              <button type="button" onClick={() => setState('later')} style={secondaryButton}>Vincular luego</button>
            </div>}
          </>
        )}

        {state === 'later' && <><div style={{ width: 48, height: 48, margin: '20px auto 0', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#f1f5f9', color: '#475569', fontSize: 22 }}>✓</div><h1 style={{ margin: '16px 0 8px', fontSize: 25 }}>Puedes activarlo cuando quieras</h1><p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>Tu producto sigue pendiente y disponible. Cuando estés listo, vuelve a escanear su QR o NFC.</p><button type="button" onClick={() => { setState('pending_activation'); setTeamOpen(false); setTeamResult(null) }} style={{ ...secondaryButton, marginTop: 20 }}>Volver</button></>}

        {(state === 'profile_draft' || state === 'profile_draft_owner') && <><div style={{ width: 48, height: 48, margin: '20px auto 0', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#fff7ed', color: '#c2410c', fontSize: 22, fontWeight: 900 }}>…</div><h1 style={{ margin: '16px 0 8px', fontSize: 26 }}>Perfil en construcción</h1><p style={{ margin: '0 0 20px', lineHeight: 1.6, color: '#64748b' }}>{state === 'profile_draft_owner' ? (message || 'Tu Perfil Digital todavía está en construcción.') : 'Este Perfil Digital todavía está en construcción.'}</p>{state === 'profile_draft_owner' && profileUrl && <button type="button" onClick={() => window.location.assign(profileUrl)} style={primaryButton}>Continuar configurando mi perfil</button>}{state === 'profile_draft' && loginUrl && <><button type="button" onClick={() => window.location.assign(loginUrl)} style={primaryButton}>Soy el propietario · Iniciar sesión</button><button type="button" onClick={() => window.location.assign('https://nfc.kawvoia.com')} style={secondaryButton}>Conocer Kawvo Link</button></>}</>}

        {(state === 'blocked' || state === 'unavailable' || state === 'not_ready' || state === 'error') && <><h1 style={{ margin: '18px 0 8px', fontSize: 24 }}>{state === 'blocked' ? 'Producto no disponible' : state === 'not_ready' ? 'Producto pendiente de habilitación' : 'No pudimos continuar'}</h1><p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>{message || 'No pudimos comprobar este producto.'}</p></>}
      </section>
    </main>
  )
}
