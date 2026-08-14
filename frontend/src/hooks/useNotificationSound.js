import { useEffect } from 'react'

const SOUND_MAP = {
  new_order: '/sounds/new-order.mp3',
  new_reservation: '/sounds/new-reservation.mp3',
  cash_reminder: '/sounds/cash-reminder.mp3',
}

/**
 * وقتی اپ باز است، service worker به‌جای تکیه به صدای پیش‌فرض سیستم‌عامل، برای هر
 * نوتیفیکیشن Push یک پیام به تب‌های باز می‌فرستد؛ این هوک آن پیام را می‌گیرد و صدای
 * گفتاری اختصاصی همان نوع رویداد را پخش می‌کند. خطای پخش (مثلاً پیش از هرگونه تعامل
 * کاربر با صفحه، که مرورگرها autoplay را مسدود می‌کنند) بی‌صدا نادیده گرفته می‌شود —
 * نوتیفیکیشن بصری/سیستم‌عامل در هر صورت نمایش داده شده است.
 */
export default function useNotificationSound() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    function onMessage(event) {
      if (event.data?.kind !== 'PUSH_RECEIVED') return
      const src = SOUND_MAP[event.data.notifType]
      if (!src) return
      new Audio(src).play().catch(() => {})
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])
}
