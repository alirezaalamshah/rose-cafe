import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MdShoppingCart } from 'react-icons/md'
import { menuAPI } from '../../api/menu.js'
import MenuCard from '../../components/menu/MenuCard/MenuCard.jsx'
import CartDrawer from '../../components/menu/CartDrawer/CartDrawer.jsx'
import useCartStore from '../../store/cartStore.js'
import './MenuPage.css'

function SkeletonCard() {
  return (
    <div className="menu-page__skeleton-card">
      <div className="skeleton menu-page__skeleton-image" />
      <div className="menu-page__skeleton-body">
        <div className="skeleton menu-page__skeleton-line" style={{ height: 20, width: '70%' }} />
        <div className="skeleton menu-page__skeleton-line" style={{ height: 14, width: '90%' }} />
        <div className="skeleton menu-page__skeleton-line" style={{ height: 14, width: '60%' }} />
        <div className="skeleton menu-page__skeleton-line" style={{ height: 36, marginTop: 8 }} />
      </div>
    </div>
  )
}

export default function MenuPage() {
  const context = useOutletContext() || {}
  const { activeCategory, searchQuery, activeFilters } = context
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('order')
  const [cartOpen, setCartOpen] = useState(false)
  const cartItems = useCartStore((s) => s.items)
  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0)

  const fetchItems = useCallback(() => {
    setLoading(true)
    const params = {}
    if (activeCategory) params.category = activeCategory
    if (searchQuery) params.search = searchQuery
    if (activeFilters?.vegetarian) params.is_vegetarian = true
    if (activeFilters?.featured) params.is_featured = true
    if (activeFilters?.available) params.status = 'available'
    if (sort) params.ordering = sort

    menuAPI.getItems(params)
      .then((data) => {
        const results = Array.isArray(data) ? data : (data.results || [])
        setItems(results)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [activeCategory, searchQuery, activeFilters, sort])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const categoryLabel = activeCategory
    ? items[0]?.category?.name
    : 'همه آیتم‌ها'

  return (
    <div>
      <div className="menu-page__topbar">
        <div>
          <h1 className="menu-page__title">
            {searchQuery ? (
              <>نتایج جستجو برای "<span>{searchQuery}</span>"</>
            ) : (
              <>منوی <span>کافه</span></>
            )}
          </h1>
          {!loading && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
              {items.length} آیتم
            </p>
          )}
        </div>
        <div className="menu-page__topbar-actions">
          <select
            className="menu-page__sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="order">ترتیب پیش‌فرض</option>
            <option value="price">ارزان‌ترین</option>
            <option value="-price">گران‌ترین</option>
            <option value="-created_at">جدیدترین</option>
          </select>
        </div>
      </div>

      <div className="menu-page__grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : items.length === 0
          ? (
            <div className="menu-page__no-results">
              <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.3 }}>🔍</div>
              <p>آیتمی یافت نشد</p>
            </div>
          )
          : items.map((item) => <MenuCard key={item.id} item={item} />)
        }
      </div>

      {totalItems > 0 && (
        <div className="menu-page__cart-float">
          <button
            className="menu-page__cart-float-btn"
            onClick={() => setCartOpen(true)}
          >
            <MdShoppingCart size={20} />
            سبد خرید
            <span className="menu-page__cart-float-badge">{totalItems}</span>
          </button>
        </div>
      )}

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
