import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// توجه: نیازی به addEventListener('fetch', ...) دستی نیست — precacheAndRoute از
// workbox-routing خودش این هندلر را ثبت می‌کند؛ اضافه کردن یک هندلر دیگر که
// event.respondWith() صدا بزند با آن تداخل می‌کند (خطای «respondWith از قبل صدا زده شده»)

// نوتیفیکیشن Push — بدنه‌ی پیام JSON است: { title, body, url, type }
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'رز کافه', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'رز کافه'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'fa',
    data: { url: data.url || '/' },
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // اگر تبی از اپ همین الان باز است، به‌جای صدای پیش‌فرض سیستم‌عامل، صدای
      // اختصاصی خودمان (بر اساس data.type) را در همان تب پخش کن
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => client.postMessage({ kind: 'PUSH_RECEIVED', notifType: data.type || '' }))
      }),
    ]),
  )
})

// کلیک روی نوتیفیکیشن — اگر تبی از سایت باز است همان‌جا فوکوس کن، وگرنه یک تب جدید باز کن
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientPath = new URL(client.url).pathname
        const targetPath = new URL(targetUrl, self.location.origin).pathname
        if (clientPath === targetPath && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      return undefined
    }),
  )
})
