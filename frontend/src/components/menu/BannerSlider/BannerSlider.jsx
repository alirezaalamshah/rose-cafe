import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { businessAPI } from '../../../api/business.js'
import { getMediaUrl } from '../../../utils/helpers.js'
import './BannerSlider.css'

const AUTO_ADVANCE_MS = 5000
const DRAG_THRESHOLD = 40

export default function BannerSlider() {
  const [banners, setBanners] = useState([])
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const timerRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    businessAPI.getBanners()
      .then((data) => setBanners(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => setBanners([]))
  }, [])

  const goTo = useCallback((i) => {
    setIndex((prev) => {
      const n = banners.length
      if (n === 0) return 0
      return ((i % n) + n) % n
    })
  }, [banners.length])

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (banners.length > 1) {
      timerRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % banners.length)
      }, AUTO_ADVANCE_MS)
    }
  }, [banners.length])

  useEffect(() => {
    restartTimer()
    return () => clearInterval(timerRef.current)
  }, [restartTimer])

  function handlePointerDown(e) {
    dragRef.current = { startX: e.clientX, moved: false }
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    if (Math.abs(e.clientX - dragRef.current.startX) > 6) dragRef.current.moved = true
  }

  function handlePointerUp(e) {
    if (!dragRef.current) return
    const delta = e.clientX - dragRef.current.startX
    if (Math.abs(delta) > DRAG_THRESHOLD) {
      goTo(index + (delta < 0 ? 1 : -1))
      restartTimer()
    }
    // dragRef با تأخیر پاک می‌شود تا onClick بعدی (که بلافاصله بعد از pointerup شلیک می‌شود) بتواند moved را ببیند
    setTimeout(() => { dragRef.current = null }, 0)
  }

  function handleSlideClick(banner) {
    if (dragRef.current?.moved) return // این یک swipe بود نه کلیک
    if (!banner.link) return
    if (/^https?:\/\//.test(banner.link)) {
      window.location.href = banner.link
    } else {
      navigate(banner.link)
    }
  }

  if (banners.length === 0) return null

  return (
    <div className="banner-slider">
      <div
        className="banner-slider__track"
        style={{ transform: `translateX(-${index * 100}%)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            className={`banner-slider__slide ${banner.link ? 'banner-slider__slide--clickable' : ''}`}
            onClick={() => handleSlideClick(banner)}
          >
            <img
              src={getMediaUrl(banner.image)}
              alt={banner.title || 'بنر تبلیغاتی'}
              style={{ objectPosition: `${banner.focal_x}% ${banner.focal_y}%` }}
              draggable={false}
            />
            {banner.title && <div className="banner-slider__caption">{banner.title}</div>}
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="banner-slider__dots">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={`banner-slider__dot ${i === index ? 'active' : ''}`}
              onClick={() => { goTo(i); restartTimer() }}
              aria-label={`اسلاید ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
