import * as jalaali from 'jalaali-js'

export const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
  'مرداد', 'شهریور', 'مهر', 'آبان',
  'آذر', 'دی', 'بهمن', 'اسفند',
]

export const DAY_NAMES_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

export function toPersianNum(n) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
}

/** "YYYY-MM-DD" → {jy, jm, jd} */
export function isoToJalali(isoDate) {
  if (!isoDate) return null
  const str = isoDate.length === 10 ? isoDate + 'T12:00:00' : isoDate
  const d = new Date(str)
  const { jy, jm, jd } = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return { jy, jm, jd }
}

/** {jy, jm, jd} → "YYYY-MM-DD" */
export function jalaliToIso(jy, jm, jd) {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd)
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
}

/** "YYYY-MM-DD" → "۱ تیر ۱۴۰۳" */
export function formatJalali(isoDate) {
  if (!isoDate) return '—'
  const j = isoToJalali(isoDate)
  if (!j) return '—'
  return `${toPersianNum(j.jd)} ${MONTH_NAMES[j.jm - 1]} ${toPersianNum(j.jy)}`
}

/** Today in Jalali */
export function getTodayJalali() {
  const d = new Date()
  const { jy, jm, jd } = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return { jy, jm, jd }
}

/** Number of days in a Jalali month */
export function jalaliMonthLength(jy, jm) {
  return jalaali.jalaaliMonthLength(jy, jm)
}

/** First day-of-week for (jy, jm, 1) — 0=شنبه … 6=جمعه */
export function firstWeekday(jy, jm) {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, 1)
  const dow = new Date(gy, gm - 1, gd).getDay() // 0=Sun
  return (dow + 1) % 7 // Sat=0
}
