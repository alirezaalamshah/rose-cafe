import { useEffect, useRef } from 'react'

/**
 * هر intervalMs یک‌بار callback را اجرا می‌کند — فقط وقتی تب مرورگر در
 * پیش‌زمینه است، تا وقتی کاربر سراغ برنامه‌ی دیگری رفته، سرور را عبث صدا نزنیم.
 * به‌محض برگشتن به تب (visibilitychange)، بلافاصله یک بار هم fetch می‌کند
 * تا داده بدون معطلی تا دور بعدی تازه شود.
 */
export default function usePolling(callback, intervalMs, enabled = true) {
  const savedCallback = useRef(callback)
  savedCallback.current = callback

  useEffect(() => {
    if (!enabled) return

    function tick() {
      if (document.visibilityState === 'visible') savedCallback.current()
    }

    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs, enabled])
}
