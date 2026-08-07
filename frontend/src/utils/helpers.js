import { formatJalali, toPersianNum } from './jalali.js'

export function formatPrice(price) {
  if (!price && price !== 0) return '—'
  return new Intl.NumberFormat('fa-IR').format(price) + ' تومان'
}

export function formatDate(dateStr) {
  return formatJalali(dateStr)
}

/** "YYYY-MM-DDTHH:MM:SS+03:30" → "۱ تیر ۱۴۰۵ - ۱۴:۳۲" */
export function formatDateTime(isoDatetime) {
  if (!isoDatetime) return '—'
  const datePart = formatJalali(isoDatetime.slice(0, 10))
  const timePart = toPersianNum(isoDatetime.slice(11, 16))
  return `${datePart} - ${timePart}`
}

export function formatTime(timeStr) {
  if (!timeStr) return '—'
  return timeStr.slice(0, 5)
}

export function getStatusLabel(status) {
  const map = {
    waiting_payment: 'در انتظار پرداخت',
    pending_confirmation: 'در انتظار تأیید کافه',
    paid: 'تأیید شده',
    preparing: 'در حال آماده‌سازی',
    ready: 'آماده تحویل',
    delivered: 'تحویل داده شد',
    rejected: 'رد شده',
    cancelled: 'لغو شده',
    completed: 'انجام شده',
    no_show: 'حضور نیافت',
    success: 'موفق',
    failed: 'ناموفق',
  }
  return map[status] || status
}

export function getStatusClass(status) {
  const map = {
    waiting_payment: 'status-pending',
    pending_confirmation: 'status-pending',
    paid: 'status-confirmed',
    preparing: 'status-preparing',
    ready: 'status-ready',
    delivered: 'status-delivered',
    rejected: 'status-cancelled',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
    no_show: 'status-cancelled',
    success: 'status-confirmed',
    failed: 'status-cancelled',
  }
  return map[status] || ''
}

/** قیمت واحد یک ردیف سبد/سفارش — قیمت پایه یا نوع، به‌علاوه‌ی جمع افزودنی‌های انتخابی */
export function itemUnitPrice(item) {
  const base = item.discounted_price || item.price
  const addonsTotal = (item.addons || []).reduce((s, a) => s + a.price, 0)
  return base + addonsTotal
}

export function getMediaUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  // در محیط dev، Vite پروکسی /media را به Django هدایت می‌کند
  // پس path را مستقیم برمی‌گردانیم (شروع با /media/)
  const base = import.meta.env.VITE_MEDIA_BASE_URL || ''
  return base ? `${base}${path}` : path
}
