import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  MdCoffee, MdShoppingCart, MdPerson, MdLogout,
  MdAdminPanelSettings, MdHistory, MdTableBar, MdRateReview
} from 'react-icons/md'
import useAuthStore from '../../../store/authStore.js'
import useCartStore from '../../../store/cartStore.js'
import './Header.css'

export default function Header() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const items = useCartStore((s) => s.items)
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleLogout() {
    logout()
    setDropdownOpen(false)
    navigate('/')
  }

  return (
    <header className="header">
      <Link to="/" className="header__logo">
        <MdCoffee className="header__logo-icon" />
        کافه ما
      </Link>

      <div className="header__spacer" />

      <nav className="header__nav">
        <NavLink to="/" end className={({ isActive }) => `header__nav-link${isActive ? ' active' : ''}`}>
          منو
        </NavLink>
        <NavLink to="/reservations" className={({ isActive }) => `header__nav-link${isActive ? ' active' : ''}`}>
          <MdTableBar size={17} /> رزرو
        </NavLink>
        <NavLink to="/reviews" className={({ isActive }) => `header__nav-link${isActive ? ' active' : ''}`}>
          <MdRateReview size={17} /> نظرات
        </NavLink>
      </nav>

      <Link to="/cart" className="header__cart-btn">
        <MdShoppingCart size={19} />
        <span className="header__cart-label">سبد</span>
        {totalItems > 0 && (
          <span className="header__cart-badge">{totalItems}</span>
        )}
      </Link>

      {isAuthenticated ? (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            className="header__user-btn"
            onClick={() => setDropdownOpen((p) => !p)}
          >
            <MdPerson size={19} />
            <span className="header__user-name">
              {user?.full_name?.split(' ')[0] || String(user?.phone || '').slice(-4) || 'من'}
            </span>
          </button>
          {dropdownOpen && (
            <div className="header__dropdown">
              <Link to="/profile" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                <MdPerson size={17} /> پروفایل
              </Link>
              <Link to="/orders" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                <MdHistory size={17} /> سفارشات
              </Link>
              <Link to="/reservations" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                <MdTableBar size={17} /> رزروها
              </Link>
              {user?.is_staff && (
                <Link to="/admin" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <MdAdminPanelSettings size={17} /> پنل ادمین
                </Link>
              )}
              <button className="header__dropdown-item danger" onClick={handleLogout}>
                <MdLogout size={17} /> خروج
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link to="/login" className="header__nav-link">
          <MdPerson size={19} />
          <span className="header__cart-label">ورود</span>
        </Link>
      )}
    </header>
  )
}
