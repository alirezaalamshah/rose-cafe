import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MdRestaurantMenu, MdTableBar, MdEventNote, MdLogout, MdDashboard } from 'react-icons/md'
import useAuthStore from '../../../store/authStore.js'
import './WaiterLayout.css'

export default function WaiterLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const perms = user?.waiter_permissions || {}

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="waiter-layout">
      {/* Top Bar */}
      <header className="waiter-header">
        <div className="waiter-header__brand">
          <img src="/ECUC9864.JPEG" alt="است" className="waiter-header__logo" />
          <span className="waiter-header__title">پنل گارسون</span>
        </div>
        <div className="waiter-header__user">
          <span className="waiter-header__name">{user?.full_name || user?.phone}</span>
          <button className="waiter-header__logout" onClick={handleLogout} title="خروج">
            <MdLogout size={18} />
          </button>
        </div>
      </header>

      <div className="waiter-body">
        {/* Sidebar */}
        <nav className="waiter-nav">
          <NavLink to="/waiter" end className={({ isActive }) => `waiter-nav__item ${isActive ? 'waiter-nav__item--active' : ''}`}>
            <MdDashboard size={22} />
            <span>خلاصه</span>
          </NavLink>

          {perms.can_manage_orders && (
            <NavLink to="/waiter/orders" className={({ isActive }) => `waiter-nav__item ${isActive ? 'waiter-nav__item--active' : ''}`}>
              <MdRestaurantMenu size={22} />
              <span>سفارشات</span>
            </NavLink>
          )}

          {perms.can_manage_reservations && (
            <NavLink to="/waiter/reservations" className={({ isActive }) => `waiter-nav__item ${isActive ? 'waiter-nav__item--active' : ''}`}>
              <MdEventNote size={22} />
              <span>رزروها</span>
            </NavLink>
          )}

          {perms.can_manage_tables && (
            <NavLink to="/waiter/tables" className={({ isActive }) => `waiter-nav__item ${isActive ? 'waiter-nav__item--active' : ''}`}>
              <MdTableBar size={22} />
              <span>میزها</span>
            </NavLink>
          )}
        </nav>

        {/* Content */}
        <main className="waiter-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
