import { useState, useEffect, useCallback } from 'react'

function detectPlatform() {
  const ua = window.navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function detectStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

/**
 * مدیریت وضعیت نصب PWA — رویداد beforeinstallprompt را می‌گیرد (فقط کروم/اندروید و
 * دسکتاپ‌های مبتنی بر Chromium این رویداد را می‌دهند؛ سافاری/iOS اصلاً همچین API ای ندارد،
 * پس UI باید برای iOS راهنمای دستی نشان بدهد نه دکمه‌ی نصب خودکار).
 */
export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(detectStandalone)
  const [platform] = useState(detectPlatform)

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    function onAppInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }, [deferredPrompt])

  return { platform, installed, canPromptNative: !!deferredPrompt, promptInstall }
}
