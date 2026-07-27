import { useState, useRef, useEffect, useCallback } from 'react'
import { MdAccessTime } from 'react-icons/md'
import { toPersianNum } from '../../../utils/jalali.js'
import './TimePicker.css'

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function pad(n) { return String(n).padStart(2, '0') }

export default function TimePicker({
  value,
  onChange,
  placeholder = 'انتخاب ساعت',
  label,
  disabled = false,
  min, // "HH:MM" — disable hours/minutes before this
  max, // "HH:MM" — disable hours/minutes after this
  startHour = 7,
  endHour = 23,
}) {
  const HOURS = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const hourListRef = useRef(null)
  const minListRef = useRef(null)

  const [selHour, setSelHour] = useState(null)
  const [selMin, setSelMin] = useState(null)

  // Parse value on mount / when it changes externally
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number)
      setSelHour(isNaN(h) ? null : h)
      setSelMin(isNaN(m) ? null : m)
    } else {
      setSelHour(null)
      setSelMin(null)
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Scroll selected item into center when popup opens or selection changes
  const scrollToSelected = useCallback(() => {
    if (!open) return
    setTimeout(() => {
      if (hourListRef.current && selHour !== null) {
        const idx = HOURS.indexOf(selHour)
        const item = hourListRef.current.children[idx]
        if (item) item.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      if (minListRef.current && selMin !== null) {
        const idx = MINUTES.indexOf(selMin)
        const item = minListRef.current.children[idx]
        if (item) item.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }, 60)
  }, [open, selHour, selMin])

  useEffect(scrollToSelected, [scrollToSelected])

  function isHourDisabled(h) {
    if (min) {
      const [minH] = min.split(':').map(Number)
      if (h < minH) return true
    }
    if (max) {
      const [maxH] = max.split(':').map(Number)
      if (h > maxH) return true
    }
    return false
  }

  function isMinDisabledFor(h, m) {
    if (min) {
      const [minH, minM] = min.split(':').map(Number)
      if (h < minH) return true
      if (h === minH && m < minM) return true
    }
    if (max) {
      const [maxH, maxM] = max.split(':').map(Number)
      if (h > maxH) return true
      if (h === maxH && m > maxM) return true
    }
    return false
  }

  function pickHour(h) {
    if (isHourDisabled(h)) return
    setSelHour(h)
    if (selMin !== null && isMinDisabledFor(h, selMin)) {
      setSelMin(null)
    }
  }

  function pickMin(m) {
    if (selHour === null || isMinDisabledFor(selHour, m)) return
    setSelMin(m)
  }

  function confirm() {
    if (selHour === null || selMin === null) return
    onChange(`${pad(selHour)}:${pad(selMin)}`)
    setOpen(false)
  }

  const displayText = value ? toPersianNum(value.slice(0, 5)) : ''
  const previewText = selHour !== null && selMin !== null
    ? `${toPersianNum(pad(selHour))}:${toPersianNum(pad(selMin))}`
    : selHour !== null
      ? `${toPersianNum(pad(selHour))}:__`
      : ''

  return (
    <div className="tp" ref={containerRef}>
      {label && <label className="tp__label">{label}</label>}
      <button
        type="button"
        className={`tp__input ${open ? 'tp__input--open' : ''} ${disabled ? 'tp__input--disabled' : ''}`}
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
      >
        <MdAccessTime size={16} className="tp__input-icon" />
        <span className={`tp__input-value ${!displayText ? 'tp__input-placeholder' : ''}`}>
          {displayText || placeholder}
        </span>
        <span className="tp__input-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="tp__popup">
          <div className="tp__columns">
            {/* Hours column */}
            <div className="tp__col">
              <div className="tp__col-header">ساعت</div>
              <div className="tp__list" ref={hourListRef}>
                {HOURS.map((h) => {
                  const dis = isHourDisabled(h)
                  return (
                    <button
                      key={h}
                      type="button"
                      className={[
                        'tp__item',
                        selHour === h ? 'tp__item--selected' : '',
                        dis ? 'tp__item--disabled' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => pickHour(h)}
                      disabled={dis}
                    >
                      {toPersianNum(pad(h))}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="tp__sep">:</div>

            {/* Minutes column */}
            <div className="tp__col">
              <div className="tp__col-header">دقیقه</div>
              <div className="tp__list" ref={minListRef}>
                {MINUTES.map((m) => {
                  const dis = selHour === null || isMinDisabledFor(selHour, m)
                  return (
                    <button
                      key={m}
                      type="button"
                      className={[
                        'tp__item',
                        selMin === m ? 'tp__item--selected' : '',
                        dis ? 'tp__item--disabled' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => pickMin(m)}
                      disabled={dis}
                    >
                      {toPersianNum(pad(m))}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="tp__footer">
            <button
              type="button"
              className={`tp__confirm ${selHour === null || selMin === null ? 'tp__confirm--inactive' : ''}`}
              onClick={confirm}
              disabled={selHour === null || selMin === null}
            >
              {previewText ? `تأیید — ${previewText}` : 'ساعت و دقیقه را انتخاب کنید'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
