import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

function appOrigin() {
  const configured = String(import.meta.env.VITE_APP_URL || '').replace(/\/$/, '')
  if (configured) return configured
  return window.location.hostname.includes('preview')
    ? 'https://app.preview.intaprd.com'
    : 'https://app.intaprd.com'
}

export default function ArtifactLinkResolver() {
  const { publicCode = '' } = useParams()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const resolve = async () => {
      const code = publicCode.trim().toUpperCase()
      if (!code) {
        setError('Este producto no tiene un identificador válido.')
        return
      }

      try {
        const response = await fetch(`${appOrigin()}/api/v1/public/artifacts/scan/start`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_code: code }),
        })
        const json: any = await response.json().catch(() => ({ ok: false }))
        if (!active) return

        if (!response.ok || !json?.ok || !json?.next_url) {
          setError(json?.error || 'No pudimos abrir este producto.')
          return
        }

        window.location.replace(String(json.next_url))
      } catch {
        if (active) setError('No pudimos conectar con Kawvo. Intenta nuevamente.')
      }
    }

    void resolve()
    return () => { active = false }
  }, [publicCode])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f9fc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 28, padding: 28, boxShadow: '0 18px 55px rgba(15,23,42,.08)' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: '.22em', color: '#0891b2' }}>KAWVO LINK</p>
        {error ? (
          <>
            <h1 style={{ margin: '14px 0 8px', fontSize: 24 }}>No pudimos abrir este producto</h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>{error}</p>
          </>
        ) : (
          <>
            <div style={{ width: 42, height: 42, margin: '20px auto 0', border: '4px solid #e2e8f0', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            <h1 style={{ margin: '16px 0 8px', fontSize: 24 }}>Reconociendo tu producto…</h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#64748b' }}>Un momento. Estamos preparando su activación de forma segura.</p>
          </>
        )}
      </section>
    </main>
  )
}
