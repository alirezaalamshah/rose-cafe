import toast from 'react-hot-toast'
import { MdNotificationsActive, MdNotifications } from 'react-icons/md'
import usePushNotifications from '../../../hooks/usePushNotifications.js'

export default function NotificationToggleButton({ className = '', iconSize = 20, showLabel = true, title }) {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()

  // مرورگر/دستگاه اصلاً پشتیبانی نمی‌کند (مثلاً سافاری در تب معمولی، نه نصب‌شده روی صفحه اصلی)
  if (!supported) return null

  async function handleClick() {
    if (subscribed) {
      await unsubscribe()
      toast.success('اعلان‌ها غیرفعال شد')
      return
    }
    if (permission === 'denied') {
      toast.error('اجازه‌ی نوتیفیکیشن قبلاً رد شده — باید از تنظیمات مرورگر/گوشی دوباره فعالش کنید')
      return
    }
    const ok = await subscribe()
    if (ok) toast.success('اعلان‌ها فعال شد')
    else toast.error('فعال‌سازی اعلان‌ها انجام نشد')
  }

  const Icon = subscribed ? MdNotificationsActive : MdNotifications

  return (
    <button className={className} onClick={handleClick} disabled={loading} title={title}>
      <Icon size={iconSize} />
      {showLabel && <span>{subscribed ? 'اعلان‌ها فعاله' : 'فعال‌سازی اعلان‌ها'}</span>}
    </button>
  )
}
