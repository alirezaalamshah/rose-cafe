import { useEffect, useRef } from 'react'
import { MdClose } from 'react-icons/md'
import './Modal.css'

export default function Modal({ isOpen, onClose, title, size = 'md', children, footer }) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      previouslyFocused.current = document.activeElement
      panelRef.current?.focus()
    } else {
      document.body.style.overflow = ''
      previouslyFocused.current?.focus?.()
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal modal--${size}`} role="dialog" aria-modal="true" tabIndex={-1} ref={panelRef}>
        {title && (
          <div className="modal__header">
            <h2 className="modal__title">{title}</h2>
            <button className="modal__close" onClick={onClose} aria-label="بستن">
              <MdClose size={18} />
            </button>
          </div>
        )}
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}
