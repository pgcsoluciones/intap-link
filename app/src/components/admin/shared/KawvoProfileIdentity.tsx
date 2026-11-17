import type { ReactNode } from 'react'

/** Presentation only: utility actions remain owned by each product. */
export default function KawvoProfileIdentity({ name, detail, avatar, utilities }: { name: string; detail: string; avatar?: ReactNode; utilities: ReactNode }) {
  return <div data-kawvo-profile-identity className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,7rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      {avatar}
      <div className="min-w-0"><h2 className="break-words text-base font-black leading-snug text-slate-950 sm:text-lg">{name}</h2><p className="mt-1 break-words text-sm text-slate-600">{detail}</p></div>
    </div>
    <div aria-label="Acciones de la cuenta" className="flex min-w-0 flex-col gap-2 sm:flex-row [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:gap-2 [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs">{utilities}</div>
  </div>
}
