import { useState, useRef, useEffect } from 'react'
import { MdCalendarToday, MdChevronRight, MdChevronLeft } from 'react-icons/md'
import {
  toPersianNum, isoToJalali, jalaliToIso,
  getTodayJalali, jalaliMonthLength, firstWeekday,
  MONTH_NAMES, DAY_NAMES_SHORT,
} from '../../../utils/jalali.js'
import './PersianDatePicker.css'

export default function PersianDatePicker({
  value,
  onChange,
  min,
  placeholder = 'انتخاب تاریخ',
  label,
  disabled = false,
}) {
  const today = getTodayJalali()
  const selJ = value ? isoToJalali(value) : null
  const minIso = min || null

  const [viewYear, setViewYear] = useState(selJ?.jy || today.jy)
  const [viewMonth, setViewMonth] = useState(selJ?.jm || today.jm)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (value) {
      const j = isoToJalali(value)
      if (j) { setViewYear(j.jy); setViewMonth(j.jm) }
    }
  }, [value])

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function prevMonth() {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1) }
    else setViewMonth((m) => m + 1)
  }

  function selectDay(jy, jm, jd) {
    const iso = jalaliToIso(jy, jm, jd)
    if (minIso && iso < minIso) return
    onChange(iso)
    setOpen(false)
  }

  function goToday() {
    const iso = jalaliToIso(today.jy, today.jm, today.jd)
    if (minIso && iso < minIso) return
    onChange(iso)
    setViewYear(today.jy)
    setViewMonth(today.jm)
    setOpen(false)
  }

  // Build 42-cell grid (6 rows × 7 cols)
  const daysInMonth = jalaliMonthLength(viewYear, viewMonth)
  const offset = firstWeekday(viewYear, viewMonth)

  const cells = []
  // Leading days from previous month
  const prevMon = viewMonth === 1 ? 12 : viewMonth - 1
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear
  const daysInPrev = jalaliMonthLength(prevYear, prevMon)
  for (let i = offset - 1; i >= 0; i--) {
    cells.push({ jy: prevYear, jm: prevMon, jd: daysInPrev - i, other: true })
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ jy: viewYear, jm: viewMonth, jd: d, other: false })
  }
  // Trailing days
  const nextMon = viewMonth === 12 ? 1 : viewMonth + 1
  const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear
  let trailing = 1
  while (cells.length < 42) {
    cells.push({ jy: nextYear, jm: nextMon, jd: trailing++, other: true })
  }

  function isDisabled(jy, jm, jd) {
    if (!minIso) return false
    return jalaliToIso(jy, jm, jd) < minIso
  }

  function isToday(jy, jm, jd) {
    return jy === today.jy && jm === today.jm && jd === today.jd
  }

  function isSelected(jy, jm, jd) {
    return selJ && jy === selJ.jy && jm === selJ.jm && jd === selJ.jd
  }

  const displayText = selJ
    ? `${toPersianNum(selJ.jd)} ${MONTH_NAMES[selJ.jm - 1]} ${toPersianNum(selJ.jy)}`
    : ''

  return (
    <div className="pdp" ref={containerRef}>
      {label && <label className="pdp__label">{label}</label>}
      <button
        type="button"
        className={`pdp__input ${open ? 'pdp__input--open' : ''} ${disabled ? 'pdp__input--disabled' : ''}`}
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
      >
        <MdCalendarToday size={16} className="pdp__input-icon" />
        <span className={`pdp__input-value ${!displayText ? 'pdp__input-placeholder' : ''}`}>
          {displayText || placeholder}
        </span>
        <span className="pdp__input-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="pdp__popup">
          {/* Navigation header */}
          <div className="pdp__header">
            <button type="button" className="pdp__nav" onClick={nextMonth} aria-label="ماه بعد">
              <MdChevronRight size={22} />
            </button>
            <div className="pdp__month-label">
              {MONTH_NAMES[viewMonth - 1]}
              <span className="pdp__year">{toPersianNum(viewYear)}</span>
            </div>
            <button type="button" className="pdp__nav" onClick={prevMonth} aria-label="ماه قبل">
              <MdChevronLeft size={22} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="pdp__weekdays">
            {DAY_NAMES_SHORT.map((d) => (
              <span key={d} className="pdp__weekday">{d}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className="pdp__grid">
            {cells.map(({ jy, jm, jd, other }, idx) => {
              const sel = isSelected(jy, jm, jd)
              const tod = isToday(jy, jm, jd)
              const dis = isDisabled(jy, jm, jd)
              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    'pdp__day',
                    other ? 'pdp__day--other' : '',
                    sel ? 'pdp__day--selected' : '',
                    tod && !sel ? 'pdp__day--today' : '',
                    dis ? 'pdp__day--disabled' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !dis && !other && selectDay(jy, jm, jd)}
                  disabled={dis}
                  tabIndex={other || dis ? -1 : 0}
                >
                  {toPersianNum(jd)}
                </button>
              )
            })}
          </div>

          <div className="pdp__footer">
            <button type="button" className="pdp__today-btn" onClick={goToday}>
              امروز
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
