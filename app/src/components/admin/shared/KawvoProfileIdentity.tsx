import type { ReactNode } from 'react'

/** Presentation only: utility actions remain owned by each product. */
export default function KawvoProfileIdentity({ name, detail, avatar, utilities, mobileUtilitiesRow = false }: { name: string; detail: string; avatar?: ReactNode; utilities: ReactNode; mobileUtilitiesRow?: boolean }) {
  return <div data-kawvo-profile-identity className={'grid min-w-0 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto] ' + (mobileUtilitiesRow ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(0,7rem)]')}>
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      {avatar}
      <div className="min-w-0"><h2 className="break-words text-base font-black leading-snug text-slate-950 sm:text-lg">{name}</h2><p className="mt-1 break-words text-sm text-slate-600">{detail}</p></div>
    </div>
    <div aria-label="Acciones de la cuenta" className={'flex min-w-0 gap-2 sm:flex-row [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:gap-2 [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs ' + (mobileUtilitiesRow ? 'flex-wrap' : 'flex-col')}>{utilities}</div>
  </div>
}
