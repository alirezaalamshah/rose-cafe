import { useState, useEffect } from 'react'
import { jalaliToIso, isoToJalali, jalaliMonthLength, MONTH_NAMES, toPersianNum, getTodayJalali } from '../../../utils/jalali.js'
import './BirthdayPicker.css'

const today = getTodayJalali()
const YEARS = Array.from({ length: 100 }, (_, i) => today.jy - i)

function getDayCount(jy, jm) {
  if (!jy || !jm) return 31
  try { return jalaliMonthLength(Number(jy), Number(jm)) } catch { return 31 }
}

export default function BirthdayPicker({ value, onChange, label, disabled = false }) {
  const parsed = value ? isoToJalali(value) : null

  const [year, setYear] = useState(parsed?.jy || '')
  const [month, setMonth] = useState(parsed?.jm || '')
  const [day, setDay] = useState(parsed?.jd || '')

  useEffect(() => {
    if (value) {
      const j = isoToJalali(value)
      if (j) { setYear(j.jy); setMonth(j.jm); setDay(j.jd) }
    } else {
      setYear(''); setMonth(''); setDay('')
    }
  }, [value])

  const dayCount = getDayCount(year, month)

  useEffect(() => {
    if (day && Number(day) > dayCount) setDay(dayCount)
  }, [dayCount, day])

  function handleChange(newYear, newMonth, newDay) {
    if (newYear && newMonth && newDay) {
      const iso = jalaliToIso(Number(newYear), Number(newMonth), Number(newDay))
      onChange(iso)
    } else {
      onChange('')
    }
  }

  function onYear(e) {
    setYear(e.target.value)
    handleChange(e.target.value, month, day)
  }
  function onMonth(e) {
    setMonth(e.target.value)
    handleChange(year, e.target.value, day)
  }
  function onDay(e) {
    setDay(e.target.value)
    handleChange(year, month, e.target.value)
  }

  return (
    <div className="bday-picker">
      {label && <label className="bday-picker__label">{label}</label>}
      <div className="bday-picker__row">
        <select className="bday-picker__select" value={year} onChange={onYear} disabled={disabled}>
          <option value="">سال</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{toPersianNum(y)}</option>
          ))}
        </select>

        <select className="bday-picker__select" value={month} onChange={onMonth} disabled={disabled || !year}>
          <option value="">ماه</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>

        <select className="bday-picker__select" value={day} onChange={onDay} disabled={disabled || !year || !month}>
          <option value="">روز</option>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{toPersianNum(d)}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
