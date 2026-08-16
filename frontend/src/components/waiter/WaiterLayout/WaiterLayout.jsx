import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  MdRestaurantMenu, MdTableBar, MdEventNote, MdLogout, MdDashboard, MdArrowForward,
  MdInventory, MdBarChart,
} from 'react-icons/md'
import useAuthStore from '../../../store/authStore.js'
import InstallAppButton from '../../common/InstallAppButton/InstallAppButton.jsx'
import NotificationToggleButton from '../../common/NotificationToggleButton/NotificationToggleButton.jsx'
import useNotificationSound from '../../../hooks/useNotificationSound.js'
import './WaiterLayout.css'

export default function WaiterLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const perms = user?.waiter_permissions || {}
  useNotificationSound()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="waiter-layout">
      {/* Top Bar */}
      <header className="waiter-header">
        <div className="waiter-header__brand">
          <img src="/ECUC9864.JPEG" alt="لوگوی کافه" className="waiter-header__logo" />
          <span className="waiter-header__title">پنل سرپرست سالن</span>
        </div>
        <div className="waiter-header__user">
          <span className="waiter-header__name">{user?.full_name || user?.phone}</span>
        </div>
      </header>

      <div className="waiter-body">
        {/* Sidebar */}
        <nav className="waiter-nav">
          <div className="waiter-nav__links">
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

            {perms.can_manage_menu_availability && (
              <NavLink to="/waiter/menu" className={({ isActive }) => `waiter-nav__item ${isActive ? 'waiter-nav__item--active' : ''}`}>
                <MdInventory size={22} />
                <span>موجودی منو</span>
              </NavLink>
            )}

            {perms.can_view_own_performance && (
              <NavLink to="/waiter/performance" className={({ isActive }) => `waiter-nav__item ${isActive ? 'waiter-nav__item--active' : ''}`}>
                <MdBarChart size={22} />
                <span>عملکرد من</span>
              </NavLink>
            )}
          </div>

          <div className="waiter-nav__footer">
            <NotificationToggleButton className="waiter-nav__item" iconSize={22} />
            <InstallAppButton className="waiter-nav__item" iconSize={22} />
            <NavLink to="/" className="waiter-nav__item">
              <MdArrowForward size={22} />
              <span>بازگشت به سایت</span>
            </NavLink>
            <button className="waiter-nav__item waiter-nav__item--logout" onClick={handleLogout}>
              <MdLogout size={20} />
              <span>خروج از سیستم</span>
            </button>
          </div>
        </nav>

        {/* Content */}
        <main className="waiter-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
