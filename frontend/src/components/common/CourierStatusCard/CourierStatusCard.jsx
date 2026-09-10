import { useState, useEffect, useRef } from 'react'
import { MdDeliveryDining, MdPhone } from 'react-icons/md'
import { snappAPI } from '../../../api/snapp.js'
import ReadOnlyMap from '../ReadOnlyMap/ReadOnlyMap.jsx'
import './CourierStatusCard.css'

const LOCATION_POLL_MS = 30000

const STATUS_COLOR = {
  PENDING: 'muted', PREPENDING: 'muted', BATCHED: 'muted', RESERVED: 'muted', BIDDING: 'muted',
  ACCEPTED: 'primary', PICKED_UP: 'primary', VERIFICATION: 'primary',
  DELIVERED: 'success',
  CANCELLED: 'error', FAILED: 'error',
}

/**
 * کارت وضعیت پیک اسنپ‌باکس — برای نمایش به خود مشتری در صفحه‌ی سفارشاتش.
 * courier: خروجی SnappCourierOrderSerializer (از فیلد order.snapp_courier).
 * اگر پیک قابل‌رهگیری باشد (ACCEPTED/PICKED_UP)، هر ۳۰ ثانیه موقعیت لحظه‌ای را
 * پول می‌کند (فقط وقتی این کارت روی صفحه است، نه در پس‌زمینه).
 */
export default function CourierStatusCard({ orderId, courier: initialCourier }) {
  const [courier, setCourier] = useState(initialCourier)
  const timerRef = useRef(null)

  useEffect(() => { setCourier(initialCourier) }, [initialCourier])

  useEffect(() => {
    if (!courier?.is_trackable) return
    function poll() {
      snappAPI.getCourierLocation(orderId).then(setCourier).catch(() => {})
    }
    poll()
    timerRef.current = setInterval(poll, LOCATION_POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [orderId, courier?.is_trackable])

  if (!courier) return null

  const color = STATUS_COLOR[courier.status] || 'muted'

  return (
    <div className={`courier-card courier-card--${color}`}>
      <div className="courier-card__header">
        <MdDeliveryDining size={18} />
        <span className="courier-card__title">وضعیت پیک: {courier.status_label}</span>
      </div>

      {courier.biker_name && (
        <div className="courier-card__biker">
          {courier.biker_photo_url && <img src={courier.biker_photo_url} alt={courier.biker_name} />}
          <div className="courier-card__biker-info">
            <span>{courier.biker_name}</span>
            {courier.biker_phone && (
              <a href={`tel:${courier.biker_phone}`} className="courier-card__biker-phone">
                <MdPhone size={13} /> <span dir="ltr">{courier.biker_phone}</span>
              </a>
            )}
          </div>
        </div>
      )}

      {courier.is_trackable && courier.current_latitude && courier.current_longitude && (
        <ReadOnlyMap latitude={courier.current_latitude} longitude={courier.current_longitude} height="160px" />
      )}
    </div>
  )
}
