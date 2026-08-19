import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type DemoMetrics = {
  ok: boolean
  period_days: number
  totals: Record<string, number>
  funnel: {
    completed: number
    purchase_clicks: number
    shares: number
    preview_opens: number
    recipient_demo_starts: number
    share_rate: number
    preview_open_rate: number
    viral_activation_rate: number
    purchase_click_rate: number
  }
  snapshots: { total: number; active: number; opens: number }
  by_sector: Array<{
    sector_key: string
    completed: number
    shares: number
    preview_opens: number
    recipient_starts: number
    purchase_clicks: number
  }>
}

const SECTOR_LABELS: Record<string, string> = {
  professional: 'Profesional / Servicios',
  wellness: 'Belleza, Salud y Bienestar',
  food: 'Comida y Restaurantes',
  retail: 'Tiendas y Ventas',
  creative: 'Creativos / Manualidades',
  business: 'Empresa / Negocio',
  sin_sector: 'Sin profesión elegida',
}

function pct(value: number) {
  return `${Math.round((Number(value || 0) * 1000)) / 10}%`
}

export default function SuperAdminDemoMetrics() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<DemoMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetch(`/api/v1/superadmin/demo/metrics?days=${days}`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.ok) throw new Error(json?.error || 'No se pudieron cargar los resultados de la Demo.')
        if (active) setData(json)
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Error al cargar métricas.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days])

  const cards = useMemo(() => {
    if (!data) return []
    return [
      ['Demos completadas', data.funnel.completed],
      ['Clics en precios', data.funnel.purchase_clicks],
      ['Compartidas', data.funnel.shares],
      ['Vistas compartidas', data.funnel.preview_opens],
      ['Nuevas demos por compartir', data.funnel.recipient_demo_starts],
      ['Previews activas', data.snapshots.active],
    ] as Array<[string, number]>
  }, [data])

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px 60px', color: '#0f172a' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <Link to="/superadmin" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>← Super Admin</Link>
            <p style={{ margin: '14px 0 6px', color: '#2563eb', fontSize: 12, fontWeight: 800, letterSpacing: '.08em' }}>RESULTADOS DEMO</p>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 42px)' }}>Conversión y viralidad</h1>
            <p style={{ margin: '8px 0 0', color: '#64748b', maxWidth: 680 }}>Mide desde el inicio de la Demo hasta el clic en precios, compartir por WhatsApp y las nuevas demos originadas por una vista compartida.</p>
          </div>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
            Período
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '10px 12px', background: 'white' }}>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>
          </label>
        </header>

        {loading && <div style={{ padding: 28, background: 'white', borderRadius: 18 }}>Cargando resultados…</div>}
        {error && <div style={{ padding: 18, background: '#fff1f2', color: '#9f1239', borderRadius: 18 }}>{error}</div>}

        {!loading && !error && data && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
              {cards.map(([label, value]) => (
                <article key={label} style={{ background: 'white', borderRadius: 18, padding: 18, boxShadow: '0 8px 30px rgba(15,23,42,.05)' }}>
                  <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{label}</span>
                  <strong style={{ display: 'block', marginTop: 8, fontSize: 30 }}>{Number(value || 0).toLocaleString()}</strong>
                </article>
              ))}
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                ['Conversión a precios', pct(data.funnel.purchase_click_rate)],
                ['Tasa de compartir', pct(data.funnel.share_rate)],
                ['Apertura de compartidos', pct(data.funnel.preview_open_rate)],
                ['Activación viral', pct(data.funnel.viral_activation_rate)],
              ].map(([label, value]) => (
                <article key={label} style={{ background: '#0f172a', color: 'white', borderRadius: 18, padding: 18 }}>
                  <span style={{ color: '#cbd5e1', fontSize: 13 }}>{label}</span>
                  <strong style={{ display: 'block', marginTop: 8, fontSize: 30 }}>{value}</strong>
                </article>
              ))}
            </section>

            <section style={{ background: 'white', borderRadius: 20, padding: 18, overflowX: 'auto', boxShadow: '0 8px 30px rgba(15,23,42,.05)' }}>
              <div style={{ marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>Resultados por profesión / ejemplo</h2>
                <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Sirve para saber qué ejemplos generan más terminaciones, compartidos, aperturas y clics comerciales.</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                    {['Profesión / ejemplo', 'Completadas', 'Compartidas', 'Aperturas', 'Nuevas demos', 'Clics precios'].map((head) => <th key={head} style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.by_sector.map((row) => (
                    <tr key={row.sector_key}>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{SECTOR_LABELS[row.sector_key] || row.sector_key}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1f5f9' }}>{Number(row.completed || 0)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1f5f9' }}>{Number(row.shares || 0)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1f5f9' }}>{Number(row.preview_opens || 0)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1f5f9' }}>{Number(row.recipient_starts || 0)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1f5f9' }}>{Number(row.purchase_clicks || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
