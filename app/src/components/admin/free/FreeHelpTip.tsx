import { useId, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  title: string
  text: string
  align?: 'left' | 'right'
}

export default function FreeHelpTip({ title, text }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span className="relative inline-flex shrink-0" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`Ayuda: ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-black text-slate-500 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
      >
        ?
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/20 px-4 pt-24"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            id={id}
            role="tooltip"
            className="w-full max-w-sm rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <strong className="block text-sm font-black text-slate-900">{title}</strong>
                <span className="mt-2 block text-xs leading-5 text-slate-600">{text}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500"
                aria-label="Cerrar ayuda"
              >
                ×
              </button>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-xl bg-cyan-50 px-4 py-2.5 text-xs font-black text-cyan-700">
              Entendido
            </button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
