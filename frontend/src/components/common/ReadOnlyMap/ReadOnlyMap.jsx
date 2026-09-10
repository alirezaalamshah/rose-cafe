import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
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

/**
 * نمایش فقط‌خواندنی یک موقعیت جغرافیایی روی نقشه — بدون کلیک/درگ (برخلاف
 * MapLocationPicker). برای رهگیری زنده‌ی پیک و نمایش پین آدرس مشتری استفاده
 * می‌شود؛ چون هردو فقط «این نقطه را نشان بده» می‌خواهند، نه انتخاب موقعیت.
 */
export default function ReadOnlyMap({ latitude, longitude, height }) {
  const position = useMemo(() => {
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
    return null
  }, [latitude, longitude])

  if (!position) return null

  return (
    <div className="readonly-map" style={height ? { height } : undefined}>
      <MapContainer center={position} zoom={15} className="readonly-map__box" key={`${position[0]},${position[1]}`}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={position} icon={pinIcon} />
      </MapContainer>
    </div>
  )
}
