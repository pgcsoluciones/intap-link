import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type OnboardingRow = {
  profile_id: string
  slug?: string | null
  name?: string | null
  email?: string | null
  category?: string | null
  subcategory?: string | null
  lead_source?: string | null
  starter_variant?: number | null
  starter_generated_at?: string | null
  identity_confirmed?: boolean
  updated_at?: string | null
}

type ExitRow = {
  id: string
  profile_slug?: string | null
  email?: string | null
  reason?: string | null
  improvement_one?: string | null
  improvement_two?: string | null
  trial_offer_eligible?: number | null
  created_at?: string | null
}

export default function SuperAdminFeedback() {
  const [onboarding, setOnboarding] = useState<OnboardingRow[]>([])
  const [exits, setExits] = useState<ExitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'onboarding' | 'exits'>('onboarding')

  useEffect(() => {
    apiGet('/superadmin/free-feedback')
      .then((json: any) => {
        if (!json?.ok) throw new Error(json?.error || 'No se pudieron cargar las respuestas.')
        setOnboarding(Array.isArray(json.data?.onboarding) ? json.data.onboarding : [])
        setExits(Array.isArray(json.data?.exits) ? json.data.exits : [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las respuestas.'))
      .finally(() => setLoading(false))
  }, [])

  const leadSourceSummary = useMemo(() => {
    const counts = new Map<string, number>()
    onboarding.forEach((row) => {
      const key = row.lead_source || 'Sin respuesta'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [onboarding])

  return (
    <SuperAdminLayout currentSection="feedback">
      <section style={{ display: 'grid', gap: 18 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: '#0891b2' }}>Experiencia Free</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 900 }}>Onboarding y bajas</h1>
          <p style={{ margin: '7px 0 0', color: '#475569', maxWidth: 760, lineHeight: 1.6 }}>Aquí llegan las respuestas del onboarding y la evaluación que completa el usuario antes de eliminar su perfil.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #dbe3ee', borderRadius: 18, padding: 18 }}><div style={{ color: '#64748b', fontSize: 12, fontWeight: 900 }}>ONBOARDINGS</div><div style={{ marginTop: 6, fontSize: 30, fontWeight: 900 }}>{onboarding.length}</div></div>
          <div style={{ background: '#fff', border: '1px solid #dbe3ee', borderRadius: 18, padding: 18 }}><div style={{ color: '#64748b', fontSize: 12, fontWeight: 900 }}>EVALUACIONES DE SALIDA</div><div style={{ marginTop: 6, fontSize: 30, fontWeight: 900 }}>{exits.length}</div></div>
          <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 18, padding: 18 }}><div style={{ color: '#0e7490', fontSize: 12, fontWeight: 900 }}>FUENTE PRINCIPAL</div><div style={{ marginTop: 8, fontSize: 18, fontWeight: 900 }}>{leadSourceSummary[0]?.[0] || 'Sin datos'}</div></div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTab('onboarding')} style={{ border: tab === 'onboarding' ? '2px solid #0891b2' : '1px solid #cbd5e1', borderRadius: 12, padding: '10px 14px', background: tab === 'onboarding' ? '#ecfeff' : '#fff', color: '#334155', fontWeight: 900, cursor: 'pointer' }}>Respuestas de onboarding</button>
          <button type="button" onClick={() => setTab('exits')} style={{ border: tab === 'exits' ? '2px solid #e11d48' : '1px solid #cbd5e1', borderRadius: 12, padding: '10px 14px', background: tab === 'exits' ? '#fff1f2' : '#fff', color: '#334155', fontWeight: 900, cursor: 'pointer' }}>Evaluaciones al eliminar perfil</button>
        </div>

        {error && <div role="alert" style={{ padding: 14, borderRadius: 14, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>{error}</div>}
        {loading ? <div style={{ padding: 28, color: '#475569' }}>Cargando respuestas…</div> : tab === 'onboarding' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {onboarding.length === 0 ? <div style={{ padding: 28, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>Todavía no hay respuestas de onboarding registradas.</div> : onboarding.map((row) => (
              <article key={row.profile_id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div><div style={{ fontWeight: 900, fontSize: 16 }}>{row.name || row.email || 'Perfil Free'}</div><div style={{ marginTop: 5, color: '#64748b', fontSize: 13 }}>{row.email || ''}{row.slug ? ` · @${row.slug}` : ''}</div></div>
                  <div style={{ color: row.identity_confirmed ? '#047857' : '#b45309', fontWeight: 900, fontSize: 12 }}>{row.identity_confirmed ? 'Identidad confirmada' : 'En configuración'}</div>
                </div>
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                  <div><strong>Actividad:</strong> {row.category || '—'}</div>
                  <div><strong>Subcategoría:</strong> {row.subcategory || '—'}</div>
                  <div><strong>Cómo nos conoció:</strong> {row.lead_source || '—'}</div>
                  <div><strong>Propuesta base:</strong> {row.starter_variant ? `Variante ${row.starter_variant}` : '—'}</div>
                </div>
                <div style={{ marginTop: 12, color: '#64748b', fontSize: 12 }}>{row.starter_generated_at || row.updated_at || ''}</div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {exits.length === 0 ? <div style={{ padding: 28, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>Todavía no hay evaluaciones de salida registradas.</div> : exits.map((row) => (
              <article key={row.id} style={{ background: '#fff', border: '1px solid #fecdd3', borderRadius: 18, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><div><div style={{ fontWeight: 900, fontSize: 16 }}>{row.email || 'Usuario'}</div><div style={{ marginTop: 5, color: '#64748b', fontSize: 13 }}>{row.profile_slug ? `@${row.profile_slug}` : 'Perfil eliminado'}</div></div><span style={{ borderRadius: 999, background: row.trial_offer_eligible ? '#ecfdf5' : '#f1f5f9', color: row.trial_offer_eligible ? '#047857' : '#475569', padding: '6px 10px', fontSize: 11, fontWeight: 900 }}>{row.trial_offer_eligible ? 'Elegible trial 7 días' : 'Sin oferta trial'}</span></div>
                <div style={{ marginTop: 14 }}><strong>Motivo principal:</strong> {row.reason || '—'}</div>
                {row.improvement_one && <div style={{ marginTop: 10, color: '#334155' }}><strong>Qué mejorar:</strong> {row.improvement_one}</div>}
                {row.improvement_two && <div style={{ marginTop: 10, color: '#334155' }}><strong>Qué faltó:</strong> {row.improvement_two}</div>}
                <div style={{ marginTop: 12, color: '#64748b', fontSize: 12 }}>{row.created_at || ''}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </SuperAdminLayout>
  )
}
