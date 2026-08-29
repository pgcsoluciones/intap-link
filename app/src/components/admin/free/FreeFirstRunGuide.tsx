export type FreePublicationReadiness = {
  ready: boolean
  missing: string[]
  steps: {
    identifier: boolean
    identity: boolean
    contact: boolean
    quick_actions: boolean
    portfolio: boolean
    services: boolean
  }
  counts?: {
    quick_actions?: number
    portfolio?: number
    services?: number
  }
}

const REQUIRED_KEYS: Array<keyof FreePublicationReadiness['steps']> = [
  'identifier',
  'identity',
  'contact',
  'quick_actions',
  'portfolio',
  'services',
]

export default function FreeFirstRunGuide({ readiness }: { readiness: FreePublicationReadiness }) {
  const complete = REQUIRED_KEYS.filter((key) => readiness.steps[key]).length
  const percent = Math.round((complete / REQUIRED_KEYS.length) * 100)

  return (
    <section className={`rounded-[26px] border p-5 shadow-sm ${readiness.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50/45'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[11px] font-black uppercase tracking-[0.16em] ${readiness.ready ? 'text-emerald-700' : 'text-amber-700'}`}>
            {readiness.ready ? 'Todo listo' : 'Requisitos para publicar'}
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            {readiness.ready ? 'Ya puedes publicar tu perfil' : `Tu perfil está ${percent}% listo para publicar`}
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
            {readiness.ready
              ? 'Cumples los requisitos necesarios para publicar tu perfil.'
              : 'Completa los apartados marcados en amarillo más abajo. Son los datos mínimos necesarios para habilitar Publicar.'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${readiness.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{complete}/{REQUIRED_KEYS.length}</span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/80" aria-label={`${percent}% completado`}>
        <div className={`h-full rounded-full transition-all ${readiness.ready ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
      </div>

      {!readiness.ready && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        Completa los apartados pendientes para habilitar la publicación.
      </p>}
    </section>
  )
}
