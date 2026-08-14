import { useState, useEffect, useCallback } from 'react'
import { notificationsAPI } from '../api/notifications.js'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/**
 * فعال/غیرفعال‌سازی نوتیفیکیشن Push — پیش‌نیاز: مرورگر باید از Service Worker و
 * Push API پشتیبانی کند (سافاری فقط از iOS 16.4 به بعد، و فقط برای PWA نصب‌شده).
 */
export default function usePushNotifications() {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [supported])

  const subscribe = useCallback(async () => {
    if (!supported) return false
    setLoading(true)
    try {
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)
      if (permissionResult !== 'granted') return false

      const { publicKey } = await notificationsAPI.getVapidPublicKey()
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      await notificationsAPI.subscribe(subscription.toJSON())
      setSubscribed(true)
      return true
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [supported])

  const unsubscribe = useCallback(async () => {
    if (!supported) return
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await notificationsAPI.unsubscribe(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [supported])

  return { supported, permission, subscribed, loading, subscribe, unsubscribe }
}
