export function formatPrice(price) {
  if (!price && price !== 0) return '—'
  return new Intl.NumberFormat('fa-IR').format(price) + ' تومان'
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatTime(timeStr) {
  if (!timeStr) return '—'
  return timeStr.slice(0, 5)
}

export function getStatusLabel(status) {
  const map = {
    pending: 'در انتظار',
    confirmed: 'تایید شده',
    preparing: 'در حال آماده‌سازی',
    ready: 'آماده تحویل',
    delivered: 'تحویل داده شد',
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
    pending: 'status-pending',
    confirmed: 'status-confirmed',
    preparing: 'status-preparing',
    ready: 'status-ready',
    delivered: 'status-delivered',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
    success: 'status-confirmed',
    failed: 'status-cancelled',
  }
  return map[status] || ''
}

export function getMediaUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path}`
}
