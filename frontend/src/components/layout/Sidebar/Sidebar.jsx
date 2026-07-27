import { useState, useEffect } from 'react'
import { menuAPI } from '../../../api/menu.js'
import './Sidebar.css'

const CATEGORY_ICONS = {
  'قهوه': '☕',
  'نوشیدنی': '🥤',
  'کیک': '🎂',
  'ساندویچ': '🥪',
  'سالاد': '🥗',
  'دسر': '🍮',
  'صبحانه': '🍳',
  'پیش‌غذا': '🍽️',
}

export default function Sidebar({ isOpen, onClose, activeCategory, onCategoryChange, onFilterChange, activeFilters }) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    menuAPI.getCategories()
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.results || [])
        setCategories(items)
      })
      .finally(() => setLoading(false))
  }, [])

  function getCategoryIcon(name) {
    for (const key of Object.keys(CATEGORY_ICONS)) {
      if (name.includes(key)) return CATEGORY_ICONS[key]
    }
    return '🍽️'
  }

  return (
    <>
      {isOpen && <div className="sidebar__overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <p className="sidebar__title">دسته‌بندی‌ها</p>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton sidebar__skeleton" />
          ))
        ) : (
          <>
            <button
              className={`sidebar__category ${!activeCategory ? 'active' : ''}`}
              onClick={() => { onCategoryChange(null); onClose?.() }}
            >
              <span className="sidebar__category-icon">🍽️</span>
              همه آیتم‌ها
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`sidebar__category ${activeCategory === cat.slug ? 'active' : ''}`}
                onClick={() => { onCategoryChange(cat.slug); onClose?.() }}
              >
                <span className="sidebar__category-icon">
                  {cat.icon || getCategoryIcon(cat.name)}
                </span>
                {cat.name}
                {cat.item_count > 0 && (
                  <span className="sidebar__category-count">{cat.item_count}</span>
                )}
              </button>
            ))}
          </>
        )}

        {/* <div className="sidebar__divider" />

        <div className="sidebar__filter-section">
          <p className="sidebar__filter-title">فیلترها</p>
          <div className="sidebar__filter-chips">
            <button
              className={`sidebar__filter-chip ${activeFilters?.featured ? 'active' : ''}`}
              onClick={() => onFilterChange?.('featured', !activeFilters?.featured)}
            >
              ⭐ ویژه
            </button>
            <button
              className={`sidebar__filter-chip ${activeFilters?.vegetarian ? 'active' : ''}`}
              onClick={() => onFilterChange?.('vegetarian', !activeFilters?.vegetarian)}
            >
              🌱 گیاهی
            </button>
            <button
              className={`sidebar__filter-chip ${activeFilters?.available ? 'active' : ''}`}
              onClick={() => onFilterChange?.('available', !activeFilters?.available)}
            >
              ✅ موجود
            </button>
          </div>
        </div> */}
      </aside>
    </>
  )
}
