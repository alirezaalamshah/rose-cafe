import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { businessAPI } from '../../../api/business.js'
import {
  MdDashboard, MdShoppingBag, MdRestaurantMenu,
  MdTableBar, MdRateReview, MdLogout, MdArrowForward,
  MdPeople, MdLocalOffer, MdPayments, MdCategory, MdMenu,
  MdChevronLeft, MdAccessTime, MdSettings, MdClose, MdViewCarousel,
  MdHistory,
} from 'react-icons/md'
import useAuthStore from '../../../store/authStore.js'
import InstallAppButton from '../../common/InstallAppButton/InstallAppButton.jsx'
import NotificationToggleButton from '../../common/NotificationToggleButton/NotificationToggleButton.jsx'
import useNotificationSound from '../../../hooks/useNotificationSound.js'
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
      { to: '/admin/banners', icon: MdViewCarousel, label: 'بنرهای تبلیغاتی' },
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
    title: 'کارکنان',
    items: [
      { to: '/admin/activity', icon: MdHistory, label: 'عملکرد سرپرست‌های سالن' },
    ],
  },
  {
    title: 'نظرات',
    items: [
      { to: '/admin/reviews', icon: MdRateReview, label: 'نظرات' },
    ],
  },
  {
    title: 'تنظیمات',
    items: [
      { to: '/admin/business', icon: MdAccessTime, label: 'ساعات کاری' },
      { to: '/admin/settings', icon: MdSettings, label: 'تنظیمات سایت' },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export default function AdminLayout() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cafeName, setCafeName] = useState('')
  useNotificationSound()

  useEffect(() => {
    businessAPI.getCafeInfo()
      .then((data) => setCafeName(data.name || ''))
      .catch(() => {})
  }, [])

  // بستن کشو هنگام تغییر مسیر
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // قفل اسکرول صفحه وقتی کشو باز است
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // بستن با Escape
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // عنوان صفحه فعلی برای هدر موبایل
  const currentItem = ALL_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )
  const pageTitle = currentItem?.label || 'پنل مدیریت'

  return (
    <div className="admin-layout">
      {/* هدر موبایل */}
      <header className="admin-mobile-header">
        <button
          className="admin-mobile-header__menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="باز کردن منو"
        >
          <MdMenu size={24} />
        </button>
        <h1 className="admin-mobile-header__title">{pageTitle}</h1>
        <NavLink to="/" className="admin-mobile-header__logo">
          <img src="/ECUC9864.JPEG" alt={cafeName || 'کافه'} />
        </NavLink>
      </header>

      {/* backdrop موبایل */}
      {mobileOpen && (
        <div
          className="admin-sidebar__backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`admin-sidebar ${collapsed ? 'admin-sidebar--collapsed' : ''} ${mobileOpen ? 'admin-sidebar--open' : ''}`}
      >
        <div className="admin-sidebar__top">
          <NavLink to="/" className="admin-sidebar__logo">
            <img src="/ECUC9864.JPEG" alt={cafeName || 'کافه'} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />
            {!collapsed && <span>{cafeName || 'کافه'}</span>}
          </NavLink>
          <button
            className="admin-sidebar__collapse-btn admin-sidebar__collapse-btn--desktop"
            onClick={() => setCollapsed((p) => !p)}
            title={collapsed ? 'بازکردن' : 'بستن'}
          >
            <MdChevronLeft size={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          <button
            className="admin-sidebar__collapse-btn admin-sidebar__close-btn--mobile"
            onClick={() => setMobileOpen(false)}
            aria-label="بستن منو"
          >
            <MdClose size={22} />
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
          <NotificationToggleButton
            className="admin-sidebar__link"
            showLabel={!collapsed}
            title={collapsed ? 'فعال‌سازی اعلان‌ها' : undefined}
          />
          <InstallAppButton
            className="admin-sidebar__link"
            showLabel={!collapsed}
            title={collapsed ? 'نصب اپلیکیشن' : undefined}
          />
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
