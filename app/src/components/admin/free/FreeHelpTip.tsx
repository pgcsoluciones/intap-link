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
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-black text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
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
            className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <strong className="block text-lg font-black leading-6 text-slate-950">{title}</strong>
                <span className="mt-3 block text-base font-medium leading-7 text-slate-700">{text}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-black text-slate-700"
                aria-label="Cerrar ayuda"
              >
                ×
              </button>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-cyan-50 px-4 py-3 text-base font-black text-cyan-800">
              Entendido
            </button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
