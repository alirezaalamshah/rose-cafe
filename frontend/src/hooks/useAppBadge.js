import { useEffect, useCallback } from 'react'
import { notificationsAPI } from '../api/notifications.js'
import usePolling from './usePolling.js'

const POLL_INTERVAL_MS = 30000

/**
 * عدد badge روی آیکون اپ نصب‌شده (navigator.setAppBadge) — تعداد کارهای
 * بدون‌اکشن کاربر جاری (سفارش/رزرو در انتظار تأیید). این API فقط در برخی
 * مرورگرها (Chrome/Edge روی اندروید و دسکتاپ، Safari ۱۶.۴+ روی iOS با اپ
 * نصب‌شده) پیاده‌سازی شده — نبودش را بی‌صدا نادیده می‌گیریم، نه خطا.
 * هر ۳۰ ثانیه پول می‌شود، و بلافاصله هم با رسیدن هر Push (پیام PUSH_RECEIVED
 * از service worker) رفرش می‌شود تا عدد با تأخیر زیاد عقب نماند.
 */
export default function useAppBadge() {
  const refresh = useCallback(async () => {
    if (!('setAppBadge' in navigator)) return
    try {
      const { count } = await notificationsAPI.getBadgeCount()
      if (count > 0) await navigator.setAppBadge(count)
      else await navigator.clearAppBadge()
    } catch {
      // شبکه/عدم‌احراز هویت — تلاش بعدی در دور پول یا پوش بعدی
    }
  }, [])

  usePolling(refresh, POLL_INTERVAL_MS)

  useEffect(() => {
    refresh()
    if (!('serviceWorker' in navigator)) return

    function onMessage(event) {
      if (event.data?.kind === 'PUSH_RECEIVED') refresh()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [refresh])
}
