import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import './ReadOnlyMap.css'

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// آیکون‌های اختصاصی برای هر نوع نشانگر — به‌جای پین یکسان لیفلت، با divIcon و
// ایموجی داخل یک دایره‌ی رنگی، تا مبدا/پیک/مقصد در نگاه اول از هم قابل‌تشخیص باشند
const DIVICON_BY_TYPE = {
  store: { emoji: '☕', color: '#f0d684' },
  courier: { emoji: '🛵', color: '#4ade80' },
  customer: { emoji: '🏠', color: '#60a5fa' },
}

function buildDivIcon(type) {
  const { emoji, color } = DIVICON_BY_TYPE[type] || DIVICON_BY_TYPE.customer
  return L.divIcon({
    className: 'readonly-map__marker',
    html: `<span class="readonly-map__marker-badge" style="background:${color}">${emoji}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

const ICON_CACHE = {}
function iconFor(type) {
  if (!ICON_CACHE[type]) ICON_CACHE[type] = buildDivIcon(type)
  return ICON_CACHE[type]
}

function toPosition(latitude, longitude) {
  const lat = parseFloat(latitude)
  const lng = parseFloat(longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
  return null
}

// مسیر منحنی (کمانی) بین دو نقطه — یک منحنی درجه‌دوم بزیه با نقطه‌ی کنترلی که
// عمود بر خط مستقیم بین مبدا/مقصد و کمی جابه‌جا شده است، تا به‌جای خط صاف، انگار
// از روی نقشه «بلند شده» و به مقصد نشسته باشد (دقیقاً چیزی که کاربر خواسته).
// محاسبه مستقیم روی lat/lng انجام می‌شود (نه با پروجکشن مرکاتور) — در مقیاس یک
// شهر/محدوده‌ی تحویل، این ساده‌سازی از نظر بصری تفاوت محسوسی با پروجکشن ندارد
// و وابستگی به API داخلی لیفلت (که ممکن است بین نسخه‌ها فرق کند) را حذف می‌کند.
function curvedPath(from, to, segments = 32) {
  const [lat1, lng1] = from
  const [lat2, lng2] = to
  const dLat = lat2 - lat1
  const dLng = lng2 - lng1
  const dist = Math.sqrt(dLat * dLat + dLng * dLng)
  if (dist === 0) return [from, to]

  // نقطه‌ی کنترلی: وسط مسیر + جابه‌جایی عمودی به اندازه‌ی ۲۵٪ فاصله — انحنای ملایم
  const mLat = (lat1 + lat2) / 2
  const mLng = (lng1 + lng2) / 2
  const nLat = -dLng / dist
  const nLng = dLat / dist
  const bow = dist * 0.25
  const cLat = mLat + nLat * bow
  const cLng = mLng + nLng * bow

  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const lat = (1 - t) ** 2 * lat1 + 2 * (1 - t) * t * cLat + t ** 2 * lat2
    const lng = (1 - t) ** 2 * lng1 + 2 * (1 - t) * t * cLng + t ** 2 * lng2
    points.push([lat, lng])
  }
  return points
}

// نشانگر فلش در نوک منحنی — زاویه‌اش از دو نقطه‌ی آخر مسیر محاسبه می‌شود تا همیشه
// هم‌جهت با انتهای واقعی کمان باشد (نه خط مستقیم مبدا-مقصد). چرخش با CSS transform
// داخل خودِ html نوشته می‌شود، چون Marker خالص react-leaflet پراپ rotationAngle ندارد
// (آن مال پلاگین جدا leaflet-rotatedmarker است که این پروژه نصب نکرده).
function buildArrowIcon(color, angleDeg) {
  return L.divIcon({
    className: 'readonly-map__arrowhead-wrap',
    html: `<svg class="readonly-map__arrowhead" style="transform:rotate(${angleDeg}deg)" width="18" height="18" viewBox="0 0 18 18">
      <path d="M9 1 L16 15 L9 11 L2 15 Z" fill="${color}" stroke="#fff" stroke-width="1"/>
    </svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function bearingDeg([lat1, lng1], [lat2, lng2]) {
  const toRad = (d) => (d * Math.PI) / 180
  const toDeg = (r) => (r * 180) / Math.PI
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * مسیر کمانی پیک -> مقصدِ فعلی (مبدا هنگام ARRIVED_AT_PICK_UP/قبلش، مقصدِ مشتری
 * هنگام PICKED_UP/ARRIVED_AT_DROP_OFF) — یک Polyline منحنی + فلش چرخان در انتها،
 * تا بدون خواندن متن وضعیت هم جهت حرکت پیک بصری مشخص باشد.
 */
function DirectionArrow({ from, to, color }) {
  const path = useMemo(() => curvedPath(from, to), [from, to])
  const arrowIcon = useMemo(() => {
    const [a, b] = path.slice(-2)
    return buildArrowIcon(color, bearingDeg(a, b))
  }, [path, color])

  return (
    <>
      {/* یک لایه‌ی زیرین تیره‌ی نازک برای کنتراست، تا خط سبز روی پس‌زمینه‌ی روشن
          نقشه (جاده‌های نارنجی OSM) گم نشود — سپس خط ممتد اصلی روی آن */}
      <Polyline positions={path} pathOptions={{ color: '#1a1a1a', weight: 4, opacity: 0.4, lineCap: 'round' }} />
      <Polyline positions={path} pathOptions={{ color, weight: 2.5, opacity: 1, lineCap: 'round' }} />
      <Marker position={path[path.length - 1]} icon={arrowIcon} interactive={false} />
    </>
  )
}

/**
 * نمایش فقط‌خواندنی موقعیت(های) جغرافیایی روی نقشه — بدون کلیک/درگ (برخلاف
 * MapLocationPicker). دو حالت استفاده دارد:
 *  ۱) تک‌نقطه‌ای قدیمی: latitude/longitude مستقیم (مثلاً نمایش پین یک آدرس تنها).
 *  ۲) چندنشانگری: prop «markers» — آرایه‌ای از {latitude, longitude, type, label}
 *     با type یکی از store/courier/customer؛ برای رهگیری سفارش پیک که هم‌زمان
 *     مبدا (کافه)، مقصد (آدرس مشتری) و موقعیت زنده‌ی پیک را نشان می‌دهد.
 * directionArrow (اختیاری): {from: [lat,lng], to: [lat,lng], color} — یک مسیر کمانی
 * با فلش در انتها، برای نمایش بصری جهت حرکت پیک (به‌سمت مبدا یا مقصد) بدون نیاز
 * به خواندن متن وضعیت.
 * نقشه طوری زوم می‌شود که همه‌ی نشانگرهای معتبر داخل کادر دیده شوند.
 */
export default function ReadOnlyMap({ latitude, longitude, height, markers, directionArrow }) {
  const points = useMemo(() => {
    if (Array.isArray(markers)) {
      return markers
        .map((m) => {
          const position = toPosition(m.latitude, m.longitude)
          return position ? { ...m, position } : null
        })
        .filter(Boolean)
    }
    const single = toPosition(latitude, longitude)
    return single ? [{ position: single, type: 'customer' }] : []
  }, [markers, latitude, longitude])

  if (points.length === 0) return null

  const center = points[0].position
  const bounds = points.length > 1 ? points.map((p) => p.position) : null

  return (
    <div className="readonly-map" style={height ? { height } : undefined}>
      <MapContainer
        center={center}
        bounds={bounds || undefined}
        boundsOptions={bounds ? { padding: [30, 30] } : undefined}
        zoom={bounds ? undefined : 15}
        className="readonly-map__box"
        key={points.map((p) => `${p.type}:${p.position[0]},${p.position[1]}`).join('|')}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {directionArrow && (
          <DirectionArrow from={directionArrow.from} to={directionArrow.to} color={directionArrow.color || '#4ade80'} />
        )}
        {points.map((p, i) => (
          <Marker key={i} position={p.position} icon={p.type ? iconFor(p.type) : pinIcon}>
            {p.label && <Popup>{p.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
