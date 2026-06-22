import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  MdCoffee, MdDashboard, MdShoppingBag, MdRestaurantMenu,
  MdTableBar, MdRateReview, MdLogout, MdArrowForward
} from 'react-icons/md'
import useAuthStore from '../../../store/authStore.js'
import './AdminSidebar.css'

const NAV = [
  { to: '/admin', icon: MdDashboard, label: 'داشبورد', end: true },
  { to: '/admin/orders', icon: MdShoppingBag, label: 'سفارشات' },
  { to: '/admin/menu', icon: MdRestaurantMenu, label: 'منو' },
  { to: '/admin/reservations', icon: MdTableBar, label: 'رزروها' },
  { to: '/admin/reviews', icon: MdRateReview, label: 'نظرات' },
]

export default function AdminLayout() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <NavLink to="/" className="admin-sidebar__logo">
          <MdCoffee size={24} />
          کافه ما
        </NavLink>

        <p className="admin-sidebar__section-title">مدیریت</p>

        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `admin-sidebar__link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}

        <p className="admin-sidebar__section-title">عمومی</p>
        <NavLink to="/" className="admin-sidebar__link">
          <MdArrowForward size={20} />
          بازگشت به سایت
        </NavLink>

        <div className="admin-sidebar__footer">
          <button className="admin-sidebar__logout" onClick={handleLogout}>
            <MdLogout size={18} />
            خروج از سیستم
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <div className="admin-content__main">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
