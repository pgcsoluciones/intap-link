import type { MouseEventHandler } from 'react'

const BASIC_PLAN_PHONE = '18097059802'
const BASIC_PLAN_MESSAGE = 'Tengo un perfil Digital Gratis y me gustaría pasarme al Plan Básico.'

export function basicPlanWhatsAppUrl() {
  return `https://wa.me/${BASIC_PLAN_PHONE}?text=${encodeURIComponent(BASIC_PLAN_MESSAGE)}`
}

export function FreeBackButton({
  onClick,
}: {
  onClick: MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
    >
      <span aria-hidden="true">←</span>
      <span>Volver a mi panel</span>
    </button>
  )
}

export function FreeUpgradeCard({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <aside
      className={`rounded-[24px] border border-violet-100 bg-violet-50/70 ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lg">✦</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Amplía tu alcance</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Logra mayor impacto con más herramientas en tu perfil. Pásate a un Plan Básico.</p>
          <a
            href={basicPlanWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-black text-violet-700 shadow-sm"
          >
            Conocer Plan Básico
          </a>
        </div>
      </div>
    </aside>
  )
}

export function FreeLimitUpgradeCard({
  text,
}: {
  text: string
}) {
  return (
    <aside className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-black text-amber-900">Límite del Plan Gratis alcanzado</p>
      <p className="mt-1 text-xs leading-5 text-amber-800">{text}</p>
      <a
        href={basicPlanWhatsAppUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-black text-violet-700 shadow-sm"
      >
        Pasarme al Plan Básico
      </a>
    </aside>
  )
}
