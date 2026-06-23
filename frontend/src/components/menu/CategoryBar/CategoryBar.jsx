import { useState, useEffect } from 'react'
import { menuAPI } from '../../../api/menu.js'
import './CategoryBar.css'

const CATEGORY_ICONS = {
  'قهوه': '☕', 'نوشیدنی': '🥤', 'کیک': '🎂',
  'ساندویچ': '🥪', 'سالاد': '🥗', 'دسر': '🍮',
  'صبحانه': '🍳', 'پیش‌غذا': '🍽️',
}

function getIcon(cat) {
  if (cat.icon) return cat.icon
  for (const [key, val] of Object.entries(CATEGORY_ICONS)) {
    if (cat.name.includes(key)) return val
  }
  return '🍽️'
}

export default function CategoryBar({ activeCategory, onCategoryChange, activeFilters, onFilterChange }) {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    menuAPI.getCategories()
      .then((data) => setCategories(Array.isArray(data) ? data : (data.results || [])))
  }, [])

  return (
    <div className="category-bar">
      <div className="category-bar__scroll">
        <button
          className={`category-bar__chip ${!activeCategory ? 'active' : ''}`}
          onClick={() => onCategoryChange(null)}
        >
          🍽️ همه
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-bar__chip ${activeCategory === cat.slug ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat.slug)}
          >
            {getIcon(cat)} {cat.name}
          </button>
        ))}

        <div className="category-bar__sep" />

        <button
          className={`category-bar__chip ${activeFilters?.featured ? 'active' : ''}`}
          onClick={() => onFilterChange?.('featured', !activeFilters?.featured)}
        >
          ⭐ ویژه
        </button>
        <button
          className={`category-bar__chip ${activeFilters?.vegetarian ? 'active' : ''}`}
          onClick={() => onFilterChange?.('vegetarian', !activeFilters?.vegetarian)}
        >
          🌱 گیاهی
        </button>
      </div>
    </div>
  )
}
