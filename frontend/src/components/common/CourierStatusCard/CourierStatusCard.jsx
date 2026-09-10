import { useState, useEffect, useRef, useMemo } from 'react'
import { MdDeliveryDining, MdPhone } from 'react-icons/md'
import { snappAPI } from '../../../api/snapp.js'
import ReadOnlyMap from '../ReadOnlyMap/ReadOnlyMap.jsx'
import './CourierStatusCard.css'

const LOCATION_POLL_MS = 30000

const STATUS_COLOR = {
  PENDING: 'muted', PREPENDING: 'muted', BATCHED: 'muted', RESERVED: 'muted', BIDDING: 'muted',
  ACCEPTED: 'primary', ARRIVED_AT_PICK_UP: 'primary', PICKED_UP: 'primary',
  ARRIVED_AT_DROP_OFF: 'primary', VERIFICATION: 'primary',
  DELIVERED: 'success',
  CANCELLED: 'error', FAILED: 'error',
}

/**
 * کارت وضعیت پیک اسنپ‌باکس — برای نمایش به خود مشتری در صفحه‌ی سفارشاتش، و به
 * پرسنل/ادمین در پنل مدیریت سفارشات.
 * courier: خروجی SnappCourierOrderSerializer (از فیلد order.snapp_courier).
 * destination: خروجی AddressSerializer (order.address_detail) — مقصد مشتری،
 * برای نمایش روی نقشه در کنار مبدا و موقعیت زنده‌ی پیک؛ اختیاری است (اگر داده
 * نشود، فقط مبدا+پیک نمایش داده می‌شود).
 * اگر پیک قابل‌رهگیری باشد (ACCEPTED/PICKED_UP)، هر ۳۰ ثانیه موقعیت لحظه‌ای را
 * پول می‌کند (فقط وقتی این کارت روی صفحه است، نه در پس‌زمینه).
 */
export default function CourierStatusCard({ orderId, courier: initialCourier, destination }) {
  const [courier, setCourier] = useState(initialCourier)
  const [storeLocation, setStoreLocation] = useState(null)
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

  // مبدا (مختصات کافه) — همان endpoint عمومی که فرم آدرس مشتری هم استفاده می‌کند
  useEffect(() => {
    if (!courier?.is_trackable) return
    snappAPI.getDeliveryZone().then(setStoreLocation).catch(() => {})
  }, [courier?.is_trackable])

  const mapMarkers = useMemo(() => {
    const markers = []
    if (storeLocation?.store_latitude && storeLocation?.store_longitude) {
      markers.push({
        type: 'store', label: 'کافه (مبدا)',
        latitude: storeLocation.store_latitude, longitude: storeLocation.store_longitude,
      })
    }
    if (destination?.latitude && destination?.longitude) {
      markers.push({
        type: 'customer', label: 'آدرس مشتری (مقصد)',
        latitude: destination.latitude, longitude: destination.longitude,
      })
    }
    if (courier?.current_latitude && courier?.current_longitude) {
      markers.push({
        type: 'courier', label: courier.biker_name ? `پیک: ${courier.biker_name}` : 'موقعیت پیک',
        latitude: courier.current_latitude, longitude: courier.current_longitude,
      })
    }
    return markers
  }, [storeLocation, destination, courier])

  // جهت حرکت پیک به‌صورت فلش کمانی روی نقشه: قبل از رسیدن به کافه -> فلش به‌سمت
  // مبدا؛ بعد از تحویل‌گرفتن بسته و قبل از رسیدن به مقصد -> فلش به‌سمت مشتری.
  // در لحظه‌ی «رسیده» (ARRIVED_AT_PICK_UP/ARRIVED_AT_DROP_OFF) پیک همان‌جاست، فلش لازم نیست.
  const directionArrow = useMemo(() => {
    const courierPos = courier?.current_latitude && courier?.current_longitude
      ? [parseFloat(courier.current_latitude), parseFloat(courier.current_longitude)]
      : null
    if (!courierPos) return null

    if (courier.status === 'ACCEPTED' && storeLocation?.store_latitude && storeLocation?.store_longitude) {
      return {
        from: courierPos,
        to: [parseFloat(storeLocation.store_latitude), parseFloat(storeLocation.store_longitude)],
        color: '#4ade80',
      }
    }
    if (courier.status === 'PICKED_UP' && destination?.latitude && destination?.longitude) {
      return {
        from: courierPos,
        to: [parseFloat(destination.latitude), parseFloat(destination.longitude)],
        color: '#4ade80',
      }
    }
    return null
  }, [courier, storeLocation, destination])

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

      {courier.is_trackable && mapMarkers.length > 0 && (
        <ReadOnlyMap markers={mapMarkers} directionArrow={directionArrow} height="200px" />
      )}
    </div>
  )
}
