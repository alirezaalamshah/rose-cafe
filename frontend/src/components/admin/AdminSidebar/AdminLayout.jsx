import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  MdCoffee, MdDashboard, MdShoppingBag, MdRestaurantMenu,
  MdTableBar, MdRateReview, MdLogout, MdArrowForward,
  MdPeople, MdLocalOffer, MdPayments, MdCategory, MdMenu,
  MdChevronLeft,
} from 'react-icons/md'
import useAuthStore from '../../../store/authStore.js'
import './AdminSidebar.css'

const NAV_GROUPS = [
  {
    title: 'نظارت',
    items: [
      { to: '/admin', icon: MdDashboard, label: 'داشبورد', end: true },
      { to: '/admin/orders', icon: MdShoppingBag, label: 'سفارشات' },
      { to: '/admin/payments', icon: MdPayments, label: 'تراکنش‌ها' },
    ],
  },
  {
    title: 'منو',
    items: [
      { to: '/admin/menu', icon: MdRestaurantMenu, label: 'آیتم‌های منو' },
      { to: '/admin/categories', icon: MdCategory, label: 'دسته‌بندی‌ها' },
    ],
  },
  {
    title: 'رزروها و میزها',
    items: [
      { to: '/admin/tables', icon: MdTableBar, label: 'میزها' },
      { to: '/admin/reservations', icon: MdMenu, label: 'رزروها' },
    ],
  },
  {
    title: 'کاربران و تخفیف',
    items: [
      { to: '/admin/users', icon: MdPeople, label: 'کاربران' },
      { to: '/admin/discounts', icon: MdLocalOffer, label: 'کدهای تخفیف' },
    ],
  },
  {
    title: 'نظرات',
    items: [
      { to: '/admin/reviews', icon: MdRateReview, label: 'نظرات' },
    ],
  },
]

export default function AdminLayout() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${collapsed ? 'admin-sidebar--collapsed' : ''}`}>
        <div className="admin-sidebar__top">
          <NavLink to="/" className="admin-sidebar__logo">
            <MdCoffee size={22} />
            {!collapsed && <span>کافه ما</span>}
          </NavLink>
          <button
            className="admin-sidebar__collapse-btn"
            onClick={() => setCollapsed((p) => !p)}
            title={collapsed ? 'بازکردن' : 'بستن'}
          >
            <MdChevronLeft size={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        <nav className="admin-sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="admin-sidebar__group">
              {!collapsed && <p className="admin-sidebar__section-title">{group.title}</p>}
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `admin-sidebar__link ${isActive ? 'active' : ''}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={20} />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <NavLink to="/" className="admin-sidebar__link" title={collapsed ? 'بازگشت به سایت' : undefined}>
            <MdArrowForward size={20} />
            {!collapsed && <span>بازگشت به سایت</span>}
          </NavLink>
          <button className="admin-sidebar__logout" onClick={handleLogout} title={collapsed ? 'خروج' : undefined}>
            <MdLogout size={18} />
            {!collapsed && <span>خروج از سیستم</span>}
          </button>
        </div>
      </aside>

      <main className={`admin-content ${collapsed ? 'admin-content--collapsed' : ''}`}>
        <div className="admin-content__main">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
