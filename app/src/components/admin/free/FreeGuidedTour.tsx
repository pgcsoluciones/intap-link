import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TourStep = {
  id: string
  target: string
  title: string
  text: string
}

type TourState = {
  completed?: boolean
  snoozeUntil?: number
}

type Props = {
  storageId: string
}

const TOUR_VERSION = 'free-dashboard-v1'
const SNOOZE_MS = 24 * 60 * 60 * 1000

const STEPS: TourStep[] = [
  {
    id: 'profile-summary',
    target: '[data-tour="profile-summary"]',
    title: 'Este es tu perfil',
    text: 'Aquí ves tu foto, nombre, usuario y el tipo de perfil que tienes. Toca tu foto cuando quieras cambiarla.',
  },
  {
    id: 'profile-required',
    target: '[data-tour="profile-required"]',
    title: 'Empieza por lo indispensable',
    text: 'Desde aquí completas nombre, cargo, usuario, foto y portada. Son los datos básicos que necesitas antes de publicar.',
  },
  {
    id: 'publication',
    target: '[data-tour="publication"]',
    title: 'Controla cuándo tu perfil está visible',
    text: 'Cuando los datos indispensables estén completos podrás publicar. Si luego quieres ocultarlo, puedes hacerlo desde el mismo botón.',
  },
  {
    id: 'preview-design',
    target: '[data-tour="preview-design"]',
    title: 'Revisa y cambia el aspecto',
    text: 'Vista previa te enseña cómo lo verá otra persona. Diseño, plantilla y colores te permite cambiar la apariencia sin alterar tu información.',
  },
  {
    id: 'content-tools',
    target: '[data-tour="content-tools"]',
    title: 'Haz tuyo el contenido',
    text: 'Aquí tienes las herramientas para editar contacto, botones, ubicación, enlaces, trabajos y servicios. Puedes hacerlo poco a poco.',
  },
  {
    id: 'public-link',
    target: '[data-tour="public-link"]',
    title: 'Tu enlace para compartir',
    text: 'Cuando publiques, desde aquí puedes copiar o compartir el enlace de tu perfil. La vista previa funciona aunque todavía esté en borrador.',
  },
  {
    id: 'bank-accounts',
    target: '[data-tour="bank-accounts"]',
    title: 'Facilita transferencias a tus clientes',
    text: 'Aquí preparas tus cuentas para facilitar pagos por transferencia. Kawvo protege la privacidad ocultando datos sensibles cuando corresponde y tú compartes el acceso solo cuando lo necesitas.',
  },
  {
    id: 'ai-helper',
    target: '[data-tour="ai-helper"]',
    title: 'Ayuda para mejorar tu perfil',
    text: 'La IA de Kawvo puede ayudarte a mejorar textos y organizar tu presentación después de completar tus datos esenciales.',
  },
  {
    id: 'watermark',
    target: '[data-tour="watermark"]',
    title: 'Opciones adicionales',
    text: 'Aquí puedes conocer opciones para personalizar aún más tu perfil, como quitar la marca de agua.',
  },
  {
    id: 'header-actions',
    target: '[data-tour="header-actions"]',
    title: 'Avisos, recorrido y Mi cuenta',
    text: 'En la parte superior encuentras tus notificaciones, el acceso al recorrido y Mi cuenta, donde están las configuraciones avanzadas y opciones personales.',
  },
]

function storageKey(storageId: string) {
  return `kawvo:${TOUR_VERSION}:${storageId || 'anonymous'}`
}

function readState(key: string): TourState {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as TourState
  } catch {
    return {}
  }
}

function writeState(key: string, value: TourState) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // El recorrido sigue funcionando aunque el navegador no permita persistencia.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function FreeGuidedTour({ storageId }: Props) {
  const key = useMemo(() => storageKey(storageId), [storageId])
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardHeight, setCardHeight] = useState(250)
  const autoStartedRef = useRef(false)
  const cardRef = useRef<HTMLElement | null>(null)

  const findAvailableIndex = useCallback((start: number, direction: 1 | -1 = 1) => {
    let index = start
    while (index >= 0 && index < STEPS.length) {
      if (document.querySelector(STEPS[index].target)) return index
      index += direction
    }
    return -1
  }, [])

  const positionCurrent = useCallback((index = stepIndex) => {
    const step = STEPS[index]
    if (!step) return
    const element = document.querySelector(step.target) as HTMLElement | null
    if (!element) return
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    window.setTimeout(() => setRect(element.getBoundingClientRect()), 260)
  }, [stepIndex])

  const start = useCallback((force = false) => {
    if (!force) {
      const state = readState(key)
      if (state.completed || Number(state.snoozeUntil || 0) > Date.now()) return
    }
    const first = findAvailableIndex(0)
    if (first < 0) return
    setStepIndex(first)
    setOpen(true)
    window.setTimeout(() => positionCurrent(first), 40)
  }, [findAvailableIndex, key, positionCurrent])

  useEffect(() => {
    if (autoStartedRef.current || !storageId) return
    autoStartedRef.current = true
    const timer = window.setTimeout(() => start(false), 850)
    return () => window.clearTimeout(timer)
  }, [start, storageId])

  useEffect(() => {
    const onReplay = () => start(true)
    window.addEventListener('kawvo:free-tour:start', onReplay)
    return () => window.removeEventListener('kawvo:free-tour:start', onReplay)
  }, [start])

  useEffect(() => {
    if (!open) return
    const update = () => {
      const step = STEPS[stepIndex]
      const element = step ? document.querySelector(step.target) as HTMLElement | null : null
      if (element) setRect(element.getBoundingClientRect())
      if (cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height || 250)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        writeState(key, { snoozeUntil: Date.now() + SNOOZE_MS })
        setOpen(false)
      }
    }
    const observer = typeof ResizeObserver !== 'undefined' && cardRef.current ? new ResizeObserver(update) : null
    if (observer && cardRef.current) observer.observe(cardRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.addEventListener('keydown', onKey)
    window.requestAnimationFrame(update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [key, open, stepIndex])

  const later = () => {
    writeState(key, { snoozeUntil: Date.now() + SNOOZE_MS })
    setOpen(false)
  }

  const complete = () => {
    writeState(key, { completed: true })
    setOpen(false)
  }

  const go = (direction: 1 | -1) => {
    const next = findAvailableIndex(stepIndex + direction, direction)
    if (next < 0) {
      if (direction === 1) complete()
      return
    }
    setStepIndex(next)
    setRect(null)
    window.setTimeout(() => positionCurrent(next), 30)
  }

  if (!open) return null

  const step = STEPS[stepIndex]
  if (!step) return null

  // Un poco de aire alrededor del área explicada para que el foco no se sienta apretado.
  const pad = 14
  const safeRect = rect ? {
    left: clamp(rect.left - pad, 8, window.innerWidth - 16),
    top: clamp(rect.top - pad, 8, window.innerHeight - 16),
    right: clamp(rect.right + pad, 8, window.innerWidth - 8),
    bottom: clamp(rect.bottom + pad, 8, window.innerHeight - 8),
  } : null
  const holeWidth = safeRect ? Math.max(0, safeRect.right - safeRect.left) : 0
  const holeHeight = safeRect ? Math.max(0, safeRect.bottom - safeRect.top) : 0
  const availableStepNumber = STEPS.slice(0, stepIndex + 1).filter((item) => document.querySelector(item.target)).length
  const availableTotal = STEPS.filter((item) => document.querySelector(item.target)).length
  const isLast = findAvailableIndex(stepIndex + 1, 1) < 0
  const mobile = window.innerWidth < 640
  const cardWidth = Math.min(360, window.innerWidth - 32)
  const cardLeft = safeRect
    ? clamp(safeRect.left + holeWidth / 2 - cardWidth / 2, 16, window.innerWidth - cardWidth - 16)
    : (window.innerWidth - cardWidth) / 2

  const cardGap = mobile ? 14 : 18
  const viewportMargin = 16
  const spaceBelow = safeRect ? window.innerHeight - safeRect.bottom : 0
  const spaceAbove = safeRect ? safeRect.top : 0
  const fitsBelow = Boolean(safeRect && spaceBelow >= cardHeight + cardGap + viewportMargin)
  const fitsAbove = Boolean(safeRect && spaceAbove >= cardHeight + cardGap + viewportMargin)

  let cardTop = window.innerHeight - cardHeight - viewportMargin
  if (safeRect) {
    if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
      cardTop = safeRect.bottom + cardGap
    } else {
      cardTop = safeRect.top - cardHeight - cardGap
    }
  }
  cardTop = clamp(cardTop, viewportMargin, Math.max(viewportMargin, window.innerHeight - cardHeight - viewportMargin))

  return (
    <div className="fixed inset-0 z-[10000]" aria-live="polite">
      {safeRect ? <>
        <div className="fixed left-0 right-0 top-0 bg-slate-950/80 backdrop-blur-[1px]" style={{ height: safeRect.top }} />
        <div className="fixed left-0 bg-slate-950/80 backdrop-blur-[1px]" style={{ top: safeRect.top, width: safeRect.left, height: holeHeight }} />
        <div className="fixed right-0 bg-slate-950/80 backdrop-blur-[1px]" style={{ top: safeRect.top, left: safeRect.right, height: holeHeight }} />
        <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-[1px]" style={{ top: safeRect.bottom }} />
        <div className="pointer-events-auto fixed rounded-[26px] border-[3px] border-cyan-300 shadow-[0_0_0_5px_rgba(34,211,238,0.16),0_0_46px_rgba(34,211,238,0.42)]" style={{ left: safeRect.left, top: safeRect.top, width: holeWidth, height: holeHeight }} />
      </> : <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-[1px]" />}

      <section
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Recorrido guiado por tu panel"
        className="fixed z-[10002] rounded-[26px] border border-cyan-100 bg-white p-5 shadow-[0_28px_90px_rgba(2,8,23,0.34)]"
        style={{ width: cardWidth, left: cardLeft, top: cardTop }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">Recorrido Kawvo</span>
          <span className="text-[11px] font-bold text-slate-400">{availableStepNumber}/{availableTotal}</span>
        </div>
        <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-slate-950">{step.title}</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{step.text}</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${Math.max(8, (availableStepNumber / Math.max(availableTotal, 1)) * 100)}%` }} />
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button type="button" onClick={later} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ver más tarde</button>
          <div className="flex gap-2">
            {findAvailableIndex(stepIndex - 1, -1) >= 0 && <button type="button" onClick={() => go(-1)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">Atrás</button>}
            <button type="button" onClick={() => isLast ? complete() : go(1)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">{isLast ? 'Completado' : 'Continuar'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
