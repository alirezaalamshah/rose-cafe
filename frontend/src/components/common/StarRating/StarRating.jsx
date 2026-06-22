import { useState } from 'react'
import './StarRating.css'

export default function StarRating({ value = 0, onChange, readonly = false, size = 'md' }) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className={`star-rating star-rating--${size} ${readonly ? 'star-rating--readonly' : ''}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${(hovered || value) >= star ? 'star--filled' : ''}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          disabled={readonly}
        >
          ★
        </button>
      ))}
      {value > 0 && readonly && (
        <span className="star-value">{value}</span>
      )}
    </div>
  )
}
