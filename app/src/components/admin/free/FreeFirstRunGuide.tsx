import { useNavigate } from 'react-router-dom'

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

type GuideStep = {
  key: keyof FreePublicationReadiness['steps']
  title: string
  text: string
  to: string
}

const GUIDE_STEPS: GuideStep[] = [
  { key: 'identifier', title: 'Reserva tu identificador', text: 'Elige una dirección fácil de recordar, por ejemplo /cafedemaria.', to: '/admin/free/identifier' },
  { key: 'identity', title: 'Confirma tu identidad', text: 'Pon tu nombre o marca y revisa a qué te dedicas.', to: '/admin/free/onboarding/identity' },
  { key: 'contact', title: 'Agrega cómo contactarte', text: 'Con un WhatsApp, teléfono o correo ya podremos avanzar.', to: '/admin/free/onboarding/contact' },
  { key: 'quick_actions', title: 'Elige tus accesos rápidos', text: 'Selecciona al menos 2 accesos para que sea fácil comunicarse contigo.', to: '/admin/free/quick-actions' },
  { key: 'portfolio', title: 'Pon ejemplos de tu trabajo', text: 'Agrega al menos 3 imágenes reales de lo que haces.', to: '/admin/free/portfolio' },
  { key: 'services', title: 'Confirma tus servicios', text: 'Completa al menos 2 servicios con título, descripción e imagen.', to: '/admin/free/services' },
]

export default function FreeFirstRunGuide({ readiness }: { readiness: FreePublicationReadiness }) {
  const navigate = useNavigate()
  const next = GUIDE_STEPS.find((step) => !readiness.steps[step.key])
  const complete = GUIDE_STEPS.filter((step) => readiness.steps[step.key]).length
  const percent = Math.round((complete / GUIDE_STEPS.length) * 100)

  return (
    <section className={`rounded-[26px] border p-5 shadow-sm ${readiness.ready ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[11px] font-black uppercase tracking-[0.16em] ${readiness.ready ? 'text-emerald-700' : 'text-cyan-700'}`}>
            {readiness.ready ? 'Todo listo' : 'Progreso de tu perfil'}
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            {readiness.ready ? 'Ya puedes publicar tu perfil' : `Tu perfil está ${percent}% completo`}
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{complete} de {GUIDE_STEPS.length} pasos necesarios completados.</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${readiness.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-50 text-cyan-700'}`}>{percent}%</span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${percent}% completado`}>
        <div className={`h-full rounded-full transition-all ${readiness.ready ? 'bg-emerald-500' : 'bg-cyan-600'}`} style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-4 grid gap-2">
        {GUIDE_STEPS.map((step) => {
          const done = readiness.steps[step.key]
          const isNext = next?.key === step.key
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => navigate(step.to)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${done ? 'border-emerald-200 bg-emerald-50/70' : isNext ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-100' : 'border-slate-200 bg-slate-50'}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${done ? 'bg-emerald-600 text-white' : isNext ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{done ? '✓' : isNext ? '!' : '○'}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{step.text}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${done ? 'bg-emerald-100 text-emerald-700' : isNext ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-500'}`}>
                {done ? 'Completado' : isNext ? 'Continúa aquí' : 'Pendiente'}
              </span>
            </button>
          )
        })}
      </div>

      {readiness.ready ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">Revisa tu vista previa una vez más y, cuando estés conforme, publica tu perfil.</p>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-500">Los elementos opcionales no reducen este porcentaje. El 100% coincide con los requisitos necesarios para publicar.</p>
      )}
    </section>
  )
}
