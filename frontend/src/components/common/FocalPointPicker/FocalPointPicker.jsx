import { useRef, useCallback, useState, useEffect } from 'react'
import { MdZoomIn } from 'react-icons/md'
import './FocalPointPicker.css'

/**
 * پیش‌نمایش عکس با قاب ثابت (نسبت بنر) + یک نقطه‌ی قابل‌درگ برای انتخاب
 * بخشی از عکس که همیشه باید داخل قاب دیده شود (focal point) + قابلیت زوم
 * برای انتخاب دقیق‌تر روی جزئیات ریز عکس.
 */
export default function FocalPointPicker({ imageUrl, focalX = 50, focalY = 50, onChange }) {
  const boxRef = useRef(null)
  const [zoom, setZoom] = useState(1)

  // با عوض شدن عکس، زوم به حالت اول برگردد
  useEffect(() => { setZoom(1) }, [imageUrl])

  const updateFromPoint = useCallback((clientX, clientY) => {
    const rect = boxRef.current.getBoundingClientRect()
    const px = (clientX - rect.left) / rect.width
    const py = (clientY - rect.top) / rect.height
    // معکوس تبدیل scale (که حول نقطه‌ی کانونی فعلی انجام می‌شود) — تا در حالت زوم‌شده
    // هم کلیک دقیقاً به مختصات درست روی تصویر اصلی نگاشت شود
    const ox = focalX / 100
    const oy = focalY / 100
    let x = (ox + (px - ox) / zoom) * 100
    let y = (oy + (py - oy) / zoom) * 100
    x = Math.min(100, Math.max(0, Math.round(x)))
    y = Math.min(100, Math.max(0, Math.round(y)))
    onChange(x, y)
  }, [onChange, zoom, focalX, focalY])

  function handlePointerDown(e) {
    e.preventDefault()
    boxRef.current.setPointerCapture?.(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerMove(e) {
    if (e.buttons !== 1) return
    updateFromPoint(e.clientX, e.clientY)
  }

  if (!imageUrl) return null

  return (
    <div className="focal-picker">
      <div
        className="focal-picker__box"
        ref={boxRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <img
          src={imageUrl}
          alt="پیش‌نمایش بنر"
          style={{
            objectPosition: `${focalX}% ${focalY}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${focalX}% ${focalY}%`,
          }}
          draggable={false}
        />
        <div className="focal-picker__marker" style={{ left: `${focalX}%`, top: `${focalY}%` }} />
      </div>

      <div className="focal-picker__zoom">
        <MdZoomIn size={18} />
        <input
          type="range"
          min="1" max="3" step="0.1"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </div>

      <p className="focal-picker__hint">روی تصویر کلیک یا آن را بکشید — با اسلایدر زوم کنید تا دقیق‌تر انتخاب کنید</p>
    </div>
  )
}
