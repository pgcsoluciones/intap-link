import { useId, useState } from 'react'

type Props = {
  title: string
  text: string
  align?: 'left' | 'right'
}

export default function FreeHelpTip({ title, text, align = 'right' }: Props) {
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
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-9 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xl ${align === 'left' ? 'left-0' : 'right-0'}`}
        >
          <strong className="block text-xs font-black text-slate-900">{title}</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-600">{text}</span>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-[11px] font-black text-cyan-700">Entendido</button>
        </span>
      )}
    </span>
  )
}
