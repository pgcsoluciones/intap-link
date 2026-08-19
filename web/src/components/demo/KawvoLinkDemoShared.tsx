import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'
import type {
  FreeProfileAppearanceColors,
  FreeProfileData,
  FreeProfileLayoutId,
} from '../free-profile/IntapLinkGratis.types'
import './KawvoLinkDemoShared.css'

type SharedResponse = {
  ok: boolean
  snapshot?: {
    profile?: FreeProfileData
    layout?: FreeProfileLayoutId
    colors?: FreeProfileAppearanceColors
  }
  sector_key?: string | null
  expires_at?: string
  assets?: {
    portrait?: string | null
    services?: Array<string | null>
  }
  error?: string
  expired?: boolean
}

function postEvent(body: Record<string, unknown>) {
  fetch('/api/v1/public/demo/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined)
}

export default function KawvoLinkDemoShared() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<SharedResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.body.classList.add('kawvo-demo-shared-body')
    return () => document.body.classList.remove('kawvo-demo-shared-body')
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/v1/public/demo/share/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json().catch(() => ({ ok: false, error: 'No se pudo abrir esta vista previa.' }))
        if (!active) return
        setData(json)
      })
      .catch(() => {
        if (active) setData({ ok: false, error: 'No se pudo abrir esta vista previa.' })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const profile = useMemo(() => {
    const base = data?.snapshot?.profile
    if (!base) return null
    const services = (base.services || []).map((service, index) => ({
      ...service,
      image: data?.assets?.services?.[index] || service.image,
    }))
    return {
      ...base,
      portrait: data?.assets?.portrait || base.portrait,
      services,
    }
  }, [data])

  function startOwnDemo() {
    postEvent({
      event_type: 'recipient_demo_started',
      snapshot_token: token,
      sector_key: data?.sector_key || null,
      source: 'shared_preview',
    })
    navigate(`/demo?from=${encodeURIComponent(token)}`)
  }

  if (loading) {
    return <main className="kawvo-demo-shared-state"><div className="kawvo-demo-shared-spinner" /><p>Cargando vista previa…</p></main>
  }

  if (!data?.ok || !profile || !data.snapshot?.layout || !data.snapshot?.colors) {
    return (
      <main className="kawvo-demo-shared-state">
        <span className="kawvo-demo-shared-mark">KAWVO LINK</span>
        <h1>{data?.expired ? 'Esta vista previa ya expiró.' : 'Esta vista previa no está disponible.'}</h1>
        <p>Las demostraciones compartidas duran 24 horas. Puedes crear una nueva con tu propia profesión.</p>
        <button type="button" onClick={() => navigate('/demo')}>Probar con mi profesión</button>
      </main>
    )
  }

  return (
    <main className="kawvo-demo-shared-page">
      <header className="kawvo-demo-shared-banner">
        <strong>Kawvo Link</strong>
        <span>Vista previa de demostración · válida por 24 horas</span>
      </header>

      <div className="kawvo-demo-shared-preview" onClickCapture={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('a, button')) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}>
        <style>{`.kawvo-demo-shared-preview a, .kawvo-demo-shared-preview button { pointer-events: none !important; }`}</style>
        <IntapLinkGratisProfile
          profile={profile}
          layout={data.snapshot.layout}
          colors={data.snapshot.colors}
        />
      </div>

      <section className="kawvo-demo-shared-cta">
        <span>DEMO KAWVO LINK</span>
        <h2>¿Quieres ver cómo se vería con tu profesión?</h2>
        <p>No importa si el perfil que recibiste es de mecánica, belleza, contabilidad u otro negocio. Kawvo Link se adapta a lo que tú haces.</p>
        <button type="button" onClick={startOwnDemo}>Prueba con tu profesión</button>
        <small>Sin registro. Primero eliges un ejemplo parecido a ti y luego lo personalizas con tus datos.</small>
      </section>
    </main>
  )
}
