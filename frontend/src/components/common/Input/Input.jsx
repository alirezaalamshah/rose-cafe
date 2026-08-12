import { useId } from 'react'
import './Input.css'

export function Input({ label, error, iconRight, iconLeft, id, className = '', ...props }) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <div className="input-group">
      {label && <label className="input-label" htmlFor={inputId}>{label}</label>}
      <div className="input-wrapper">
        {iconLeft && <span className="input-icon input-icon--left">{iconLeft}</span>}
        <input
          id={inputId}
          className={`input-field ${error ? 'error' : ''} ${iconRight ? 'has-icon-right' : ''} ${iconLeft ? 'has-icon-left' : ''} ${className}`}
          {...props}
        />
        {iconRight && <span className="input-icon input-icon--right">{iconRight}</span>}
      </div>
      {error && <span className="input-error">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, id, className = '', ...props }) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <div className="input-group">
      {label && <label className="input-label" htmlFor={inputId}>{label}</label>}
      <textarea
        id={inputId}
        className={`input-field textarea-field ${error ? 'error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="input-error">{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, id, className = '', ...props }) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <div className="input-group">
      {label && <label className="input-label" htmlFor={inputId}>{label}</label>}
      <div className="input-wrapper">
        <select
          id={inputId}
          className={`input-field select-field ${error ? 'error' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        <span className="input-icon input-icon--right select-arrow" style={{ pointerEvents: 'none' }}>▾</span>
      </div>
      {error && <span className="input-error">{error}</span>}
    </div>
  )
}
