import type { ReactNode } from 'react'
import { KAWMED_SHELL_TABS, type KawMedShellTab } from './kawmed-shell-navigation'

type Props = {
  enabled: boolean
  embedded: boolean
  name: string
  tab: KawMedShellTab
  onNavigate: (tab: KawMedShellTab) => void
  onLegacy: () => void
  children: ReactNode
}

/** Stateless chrome. MedicalDashboard owns data, drafts, navigation and all operations. */
export default function KawMedUnifiedShellFrame({ enabled, embedded, name, tab, onNavigate, onLegacy, children }: Props) {
  const Root = embedded ? 'div' : 'main'
  const navigation = (mobile: boolean) => KAWMED_SHELL_TABS.map(item => <button
    key={item.id}
    type="button"
    aria-current={tab === item.id ? 'page' : undefined}
    onClick={() => onNavigate(item.id)}
    className={'flex min-h-11 min-w-11 items-center rounded-xl px-3 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 ' + (mobile ? 'flex-col justify-center gap-1 text-xs ' : 'w-full gap-3 text-left ') + (tab === item.id ? 'bg-cyan-50 text-cyan-900' : 'text-slate-600 hover:bg-slate-50')}
  ><span aria-hidden="true" className="text-xl">{item.icon}</span><span>{item.label}</span></button>)

  return <Root data-kawmed-shell={enabled ? 'doctor' : undefined} className={enabled
    ? "min-h-[100dvh] min-w-0 bg-[#f1f5f7] pb-[calc(94px+env(safe-area-inset-bottom))] font-['Inter',sans-serif] text-slate-950 md:pl-[244px] md:pb-0 [&_[hidden]]:!hidden [&_button]:min-h-11 [&_button]:min-w-11 [&_a]:min-h-11 [&_a]:inline-flex [&_a]:items-center [&_input]:min-w-0 [&_input]:min-h-11 [&_select]:min-w-0 [&_select]:min-h-11 [&_input[type=checkbox]]:h-11 [&_input[type=checkbox]]:w-11 [&_input[type=checkbox]]:shrink-0 [&_h1]:break-words [&_p]:break-words [&_a]:break-words [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-cyan-700 [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-cyan-700"
    : embedded ? "font-['Inter'] text-slate-950" : "min-h-screen bg-slate-50 px-4 py-6 font-['Inter'] text-slate-950"}>
    {enabled && <aside aria-label="Menú lateral Kawmed" className="fixed inset-y-0 left-0 hidden w-[244px] flex-col p-4 md:flex">
      <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4">
        <div className="mb-7 flex items-center gap-3"><span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-[#123241] text-lg font-black text-white">K</span><div><strong>Kawvo</strong><p className="text-xs text-slate-500">Kawmed · Médico profesional</p></div></div>
        <nav aria-label="Secciones de Kawmed" className="space-y-2">{navigation(false)}</nav>
        <p className="mt-auto pt-6 text-xs leading-5 text-slate-500">Tu perfil médico y sus herramientas actuales.</p>
      </div>
    </aside>}
    {enabled && <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3">
      <div className="mx-auto flex max-w-4xl min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><strong className="block text-base text-cyan-900">Kawmed</strong><p className="break-words text-sm text-slate-600">{name}</p></div>
        <button type="button" onClick={onLegacy} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Panel anterior</button>
      </div>
    </header>}
    <div key="medical-content" className={enabled ? 'mx-auto w-full min-w-0 max-w-4xl space-y-5 px-4 py-5' : embedded ? 'w-full space-y-5' : 'mx-auto w-full max-w-5xl space-y-5'}>{children}</div>
    {enabled && <nav aria-label="Navegación Kawmed" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 border-t border-slate-200 bg-white px-2 pt-2 pb-[calc(7px+env(safe-area-inset-bottom))] md:hidden">{navigation(true)}</nav>}
  </Root>
}
