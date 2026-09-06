import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { MdMyLocation, MdWarningAmber } from 'react-icons/md'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { snappAPI } from '../../../api/snapp.js'
import './MapLocationPicker.css'

// آیکون پیش‌فرض Leaflet با مسیرهای اسمبل‌شده‌ی webpack کار می‌کند نه Vite —
// بدون این تنظیم دستی، پین نقشه اصلاً نمایش داده نمی‌شود
const markerIconDefault = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// مرکز پیش‌فرض نقشه — دزفول (وقتی هنوز مختصاتی انتخاب نشده)
const DEFAULT_CENTER = [32.3825, 48.4047]

// فاصله‌ی خط مستقیم بین دو مختصات (کیلومتر) — نسخه‌ی فرانت همان فرمول
// apps.common.utils.haversine_distance_km در بک‌اند، فقط برای پیش‌نمایش زنده؛
// تأیید نهایی همیشه سمت سرور انجام می‌شود (این فقط UX است، نه لایه‌ی امنیتی)
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dPhi = toRad(lat2 - lat1)
  const dLambda = toRad(lng2 - lng1)
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// این تنظیمات تقریباً هیچ‌وقت تغییر نمی‌کنند (فقط با تغییر دستی ادمین) — کش کوتاه‌مدت
// در localStorage از یک درخواست تکراری در هر بار باز شدن مودال/mount شدن نقشه جلوگیری می‌کند
const ZONE_CACHE_KEY = 'snapp:delivery-zone-cache'
const ZONE_CACHE_TTL_MS = 10 * 60 * 1000 // ۱۰ دقیقه

function readZoneCache() {
  try {
    const raw = localStorage.getItem(ZONE_CACHE_KEY)
    if (!raw) return null
    const { value, cachedAt } = JSON.parse(raw)
    if (Date.now() - cachedAt > ZONE_CACHE_TTL_MS) return null
    return value
  } catch {
    return null
  }
}

function writeZoneCache(value) {
  try {
    localStorage.setItem(ZONE_CACHE_KEY, JSON.stringify({ value, cachedAt: Date.now() }))
  } catch {
    // localStorage گاهی در دسترس نیست (حالت خصوصی و ...) — بی‌اهمیت، فقط کش رد می‌شود
  }
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/**
 * نقشه را به موقعیت جدید می‌برد — فقط وقتی موقعیت از بیرون (نتیجه‌ی جست‌وجو،
 * «موقعیت من») تغییر کرده، نه وقتی خودِ کاربر دارد پین را روی نقشه می‌کشد
 * (وگرنه هر فریم درگ، نقشه را زیر دست کاربر جابه‌جا می‌کرد).
 */
function RecenterOnExternalChange({ position, trigger }) {
  const map = useMap()
  const lastTrigger = useRef(trigger)

  useEffect(() => {
    if (!position || trigger === lastTrigger.current) return
    lastTrigger.current = trigger
    map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [position, trigger, map])

  return null
}

/**
 * انتخاب موقعیت جغرافیایی روی نقشه (Leaflet/OpenStreetMap) — برای آدرس مشتری
 * (مقصد سفارش پیک) و مبدا کافه در تنظیمات ادمین. کلیک/درگ پین، مقدار را از
 * طریق onChange(lat, lng) به‌صورت رشته (هم‌فرمت با فیلدهای مدل) برمی‌گرداند.
 * showDeliveryZoneWarning: وقتی true (پیش‌فرض، برای فرم آدرس مشتری)، فاصله تا
 * مبدای کافه را زنده نشان می‌دهد و اگر خارج از شعاع مجاز بود هشدار می‌دهد —
 * تأیید نهایی همیشه سمت سرور است، این فقط بازخورد فوری به کاربر قبل از ذخیره است.
 * radiusKm: اگر داده شود، یک دایره به همین شعاع حول پین رسم می‌شود — برای تنظیمات
 * ادمین (مبدای کافه) تا محدوده‌ی پوشش را قبل از ذخیره‌ی شعاع، بصری ببیند.
 * recenterSignal: هر بار عوض شود (مثلاً با انتخاب یک نتیجه‌ی جست‌وجو در کامپوننت
 * والد)، نقشه به موقعیت جدید پرواز می‌کند — برخلاف درگ/کلیک خودِ کاربر روی نقشه
 * که نباید باعث جابه‌جایی خودکار نقشه زیر دستش شود.
 */
export default function MapLocationPicker({
  latitude, longitude, onChange, showDeliveryZoneWarning = true, radiusKm, recenterSignal,
}) {
  const [locating, setLocating] = useState(false)
  const [zone, setZone] = useState(null)

  useEffect(() => {
    if (!showDeliveryZoneWarning) return
    const cached = readZoneCache()
    if (cached) {
      setZone(cached)
      return
    }
    snappAPI.getDeliveryZone().then((data) => {
      setZone(data)
      writeZoneCache(data)
    }).catch(() => {})
  }, [showDeliveryZoneWarning])

  const position = useMemo(() => {
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
    return null
  }, [latitude, longitude])

  const storePosition = useMemo(() => {
    if (!zone?.store_latitude || !zone?.store_longitude) return null
    return [parseFloat(zone.store_latitude), parseFloat(zone.store_longitude)]
  }, [zone])

  const distanceInfo = useMemo(() => {
    if (!position || !storePosition) return null
    const km = haversineKm(position[0], position[1], storePosition[0], storePosition[1])
    return { km, exceeds: km > zone.max_delivery_radius_km }
  }, [position, storePosition, zone])

  const handlePick = useCallback((lat, lng) => {
    onChange(lat.toFixed(6), lng.toFixed(6))
  }, [onChange])

  // با شعاع بزرگ‌تر، زوم پیش‌فرض باید بازتر باشد تا کل دایره داخل قاب دیده شود —
  // radiusKm برای حالت ادمین (رسم دایره حول خود پین)، max_delivery_radius_km برای
  // حالت مشتری (نمایش محدوده‌ی مجاز حول مبدا، حتی قبل از انتخاب پین)
  const effectiveRadius = radiusKm || zone?.max_delivery_radius_km
  const zoomForRadius = useMemo(() => {
    if (!effectiveRadius) return position ? 16 : 13
    if (effectiveRadius <= 5) return 13
    if (effectiveRadius <= 15) return 11
    if (effectiveRadius <= 30) return 10
    return 9
  }, [effectiveRadius, position])

  // شمارنده‌ی داخلی برای «موقعیت من» — همان نقش recenterSignal بیرونی را دارد
  const [internalRecenterTick, setInternalRecenterTick] = useState(0)

  function handleUseMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePick(pos.coords.latitude, pos.coords.longitude)
        setInternalRecenterTick((t) => t + 1)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="map-picker">
      <div className="map-picker__box">
        <MapContainer
          center={position || storePosition || DEFAULT_CENTER}
          zoom={zoomForRadius}
          className="map-picker__map"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ClickHandler onPick={handlePick} />
          <RecenterOnExternalChange position={position} trigger={`${recenterSignal ?? 0}:${internalRecenterTick}`} />
          {position && radiusKm > 0 && (
            <Circle
              center={position}
              radius={radiusKm * 1000}
              pathOptions={{ color: '#f0d684', fillColor: '#f0d684', fillOpacity: 0.08, weight: 2 }}
            />
          )}
          {storePosition && zone?.max_delivery_radius_km > 0 && (
            <Circle
              center={storePosition}
              radius={zone.max_delivery_radius_km * 1000}
              pathOptions={
                distanceInfo?.exceeds
                  ? { color: '#f87171', fillColor: '#f87171', fillOpacity: 0.06, weight: 2 }
                  : { color: '#4ade80', fillColor: '#4ade80', fillOpacity: 0.06, weight: 2 }
              }
            />
          )}
          {position && (
            <Marker
              position={position}
              icon={markerIconDefault}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng()
                  handlePick(lat, lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {distanceInfo && (
        <div className={`map-picker__zone-info ${distanceInfo.exceeds ? 'map-picker__zone-info--warning' : ''}`}>
          {distanceInfo.exceeds && <MdWarningAmber size={15} />}
          {distanceInfo.exceeds
            ? `این موقعیت حدود ${Math.round(distanceInfo.km)} کیلومتر با کافه فاصله دارد — بیش از حد مجاز (${zone.max_delivery_radius_km} کیلومتر) است`
            : `فاصله تا کافه: حدود ${Math.round(distanceInfo.km)} کیلومتر`}
        </div>
      )}

      <div className="map-picker__actions">
        <button type="button" className="map-picker__locate-btn" onClick={handleUseMyLocation} disabled={locating}>
          <MdMyLocation size={15} /> {locating ? 'در حال یافتن موقعیت...' : 'استفاده از موقعیت من'}
        </button>
        <span className="map-picker__hint">
          {position ? 'برای تغییر، پین را بکشید یا روی نقطه‌ی جدید کلیک کنید' : 'روی نقشه کلیک کنید تا موقعیت مشخص شود'}
        </span>
      </div>
    </div>
  )
}
