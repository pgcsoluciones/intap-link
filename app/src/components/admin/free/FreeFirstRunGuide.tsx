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

  if (!next) {
    return (
      <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Todo listo</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">Ya completaste lo necesario para publicar</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Revisa tu vista previa una vez más y, cuando estés conforme, publica tu perfil.</p>
      </section>
    )
  }

  return (
    <section className="rounded-[26px] border border-cyan-300 bg-cyan-50/70 p-5 shadow-[0_16px_45px_rgba(8,145,178,0.10)] ring-4 ring-cyan-100/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">Te guiamos paso a paso</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Empieza por aquí</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-cyan-700 shadow-sm">{complete}/{GUIDE_STEPS.length}</span>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-base font-black text-slate-950">{next.title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{next.text}</p>
        <button type="button" onClick={() => navigate(next.to)} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-extrabold text-white">
          Hacer este paso
        </button>
      </div>

      <div className="mt-4 flex gap-1.5" aria-label={`${complete} de ${GUIDE_STEPS.length} pasos completados`}>
        {GUIDE_STEPS.map((step) => <span key={step.key} className={`h-1.5 flex-1 rounded-full ${readiness.steps[step.key] ? 'bg-cyan-600' : 'bg-cyan-200'}`} />)}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">No tienes que saber de tecnología. Haz un paso a la vez y nosotros te diremos cuál sigue.</p>
    </section>
  )
}
