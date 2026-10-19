import { ReactNode, useEffect } from 'react'
import { FiX } from 'react-icons/fi'

type Props = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}

export default function KawMedModal({ open, title, children, onClose, footer }: Props) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="kawmed-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="kawmed-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="kawmed-modal__header">
          <h2>{title}</h2>
          <button type="button" className="kawmed-icon-button" aria-label="Cerrar" onClick={onClose}>
            <FiX />
          </button>
        </header>
        <div className="kawmed-modal__content">{children}</div>
        {footer ? <footer className="kawmed-modal__footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
