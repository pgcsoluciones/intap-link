import { useEffect, useId, useRef, useState } from 'react'

// UI preference only, scoped to product + role + authorized profile. Never grants access.
const dismissedInMemory = new Set<string>()
function wasDismissed(identity: string) {
  try { return dismissedInMemory.has(identity) || sessionStorage.getItem('kawvo_ready_notice_v1:' + identity) === 'later' } catch { return dismissedInMemory.has(identity) }
}
type Props = { identity: string; ready: boolean; canPrompt?: boolean; title: string; onReview: () => void }

export default function KawvoReadyToPublish(props: Props) {
  // A change of authorized profile must never inherit another profile's dismissal.
  return <ProfileNotice key={props.identity} {...props}/>
}
function ProfileNotice({ identity, ready, canPrompt = true, title, onReview }: Props) {
  const [dismissed, setDismissed] = useState(() => wasDismissed(identity))
  const reviewRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const open = Boolean(identity && ready && canPrompt && !dismissed)
  const dismiss = () => {
    dismissedInMemory.add(identity)
    try { sessionStorage.setItem('kawvo_ready_notice_v1:' + identity, 'later') } catch { /* In-memory preference still preserves this SPA session. */ }
    setDismissed(true)
  }
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    reviewRef.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [open])
  if (!identity || !ready) return null
  const review = () => { dismiss(); onReview() }
  return <>
    <section aria-label="Perfil listo para publicar" aria-hidden={open||undefined} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-950">
      <div className="min-w-0"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-sm">Los requisitos obligatorios están guardados. La publicación requiere tu confirmación.</p></div>
      <button type="button" onClick={review} className="min-h-11 min-w-11 rounded-xl border border-cyan-300 bg-white px-4 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Publicar</button>
    </section>
    {open && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/60 p-4" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss() }
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll('button')
        if (!buttons?.length) return
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <h2 id={titleId} className="text-xl font-black">{title}</h2><p className="mt-2 text-sm text-slate-600">Puedes revisar y confirmar la publicación o continuar editando. No se publicará automáticamente.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button ref={reviewRef} type="button" onClick={review} className="min-h-11 min-w-11 rounded-xl bg-cyan-800 px-4 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">Publicar</button><button type="button" onClick={dismiss} className="min-h-11 min-w-11 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Más tarde</button></div>
      </div>
    </div>}
  </>
}
