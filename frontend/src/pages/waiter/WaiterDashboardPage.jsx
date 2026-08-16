import { useState, useEffect } from 'react'
import {
  MdRestaurantMenu, MdEventNote, MdTableBar, MdPending, MdOutdoorGrill, MdDoneAll,
  MdInventory, MdBarChart, MdPowerSettingsNew, MdLockOpen,
} from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore.js'
import { waiterAPI } from '../../api/waiter.js'
import { businessAPI } from '../../api/business.js'
import { confirm } from '../../store/confirmStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { formatJalali, jalaliToIso, getTodayJalali } from '../../utils/jalali.js'
import './WaiterDashboardPage.css'

export default function WaiterDashboardPage() {
  const { user } = useAuthStore()
  const perms = user?.waiter_permissions || {}
  const navigate = useNavigate()

  const [orderStats, setOrderStats] = useState({ pending: 0, preparing: 0, ready: 0 })
  const [resStats, setResStats] = useState({ total: 0, confirmed: 0 })
  const [loading, setLoading] = useState(true)
  const [cafeStatus, setCafeStatus] = useState(null)
  const [togglingCafe, setTogglingCafe] = useState(false)

  const { jy, jm, jd } = getTodayJalali()
  const todayIso = jalaliToIso(jy, jm, jd)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const promises = []

      if (perms.can_manage_orders) {
        promises.push(
          waiterAPI.getOrders().then((data) => {
            const list = Array.isArray(data) ? data : (data?.results || [])
            setOrderStats({
              pending: list.filter((o) => o.status === 'paid').length,
              preparing: list.filter((o) => o.status === 'preparing').length,
              ready: list.filter((o) => o.status === 'ready').length,
            })
          }).catch(() => {})
        )
      }

      if (perms.can_manage_reservations) {
        promises.push(
          waiterAPI.getReservations({ date: todayIso }).then((data) => {
            const list = Array.isArray(data) ? data : (data?.results || [])
            setResStats({
              total: list.length,
              confirmed: list.filter((r) => r.status === 'confirmed').length,
            })
          }).catch(() => {})
        )
      }

      await Promise.all(promises)
      setLoading(false)
    }
    load()
  }, [perms.can_manage_orders, perms.can_manage_reservations, todayIso])

  useEffect(() => {
    if (!perms.can_force_close_cafe) return
    businessAPI.getCafeStatus().then(setCafeStatus).catch(() => {})
  }, [perms.can_force_close_cafe])

  const isForceClosed = cafeStatus?.reason === 'special_closed'

  async function handleToggleForceClose() {
    const closing = !isForceClosed
    const msg = closing
      ? 'کافه از همین الان تا پایان امروز بسته می‌شود (فردا طبق ساعات معمول باز خواهد شد). ادامه می‌دهید؟'
      : 'کافه دوباره طبق ساعات کاری تعریف‌شده باز می‌شود. ادامه می‌دهید؟'
    if (!(await confirm(msg, { title: closing ? 'بستن فوری کافه' : 'باز کردن کافه', danger: closing }))) return

    setTogglingCafe(true)
    try {
      const st = closing ? await waiterAPI.forceCloseCafe() : await waiterAPI.reopenCafe()
      setCafeStatus(st)
      toast.success(closing ? 'کافه بسته شد' : 'کافه باز شد')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تغییر وضعیت کافه')
    } finally {
      setTogglingCafe(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'صبح بخیر'
    if (h < 17) return 'ظهر بخیر'
    return 'عصر بخیر'
  }

  return (
    <div className="waiter-dashboard">
      <div className="waiter-dashboard__greeting">
        <h1>{greeting()}، {user?.full_name || 'سرپرست عزیز'} 👋</h1>
        <p className="waiter-dashboard__date">{formatJalali(todayIso)}</p>
      </div>

      <div className="waiter-dashboard__cards">
        {perms.can_manage_orders && (
          <>
            <div className="waiter-stat-card waiter-stat-card--pending" onClick={() => navigate('/waiter/orders?status=pending')}>
              <div className="waiter-stat-card__icon"><MdPending size={28} /></div>
              <div className="waiter-stat-card__info">
                <div className="waiter-stat-card__num">{loading ? '...' : orderStats.pending}</div>
                <div className="waiter-stat-card__label">سفارش در انتظار</div>
              </div>
            </div>
            <div className="waiter-stat-card waiter-stat-card--preparing" onClick={() => navigate('/waiter/orders?status=preparing')}>
              <div className="waiter-stat-card__icon"><MdOutdoorGrill size={28} /></div>
              <div className="waiter-stat-card__info">
                <div className="waiter-stat-card__num">{loading ? '...' : orderStats.preparing}</div>
                <div className="waiter-stat-card__label">در حال آماده‌سازی</div>
              </div>
            </div>
            <div className="waiter-stat-card waiter-stat-card--ready" onClick={() => navigate('/waiter/orders?status=ready')}>
              <div className="waiter-stat-card__icon"><MdDoneAll size={28} /></div>
              <div className="waiter-stat-card__info">
                <div className="waiter-stat-card__num">{loading ? '...' : orderStats.ready}</div>
                <div className="waiter-stat-card__label">آماده تحویل</div>
              </div>
            </div>
          </>
        )}

        {perms.can_manage_reservations && (
          <div className="waiter-stat-card waiter-stat-card--res" onClick={() => navigate('/waiter/reservations')}>
            <div className="waiter-stat-card__icon"><MdEventNote size={28} /></div>
            <div className="waiter-stat-card__info">
              <div className="waiter-stat-card__num">{loading ? '...' : resStats.confirmed}</div>
              <div className="waiter-stat-card__label">رزرو تأیید‌شده امروز</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="waiter-dashboard__actions">
        <h2>دسترسی سریع</h2>
        <div className="waiter-dashboard__action-grid">
          {perms.can_manage_orders && (
            <button className="waiter-quick-btn" onClick={() => navigate('/waiter/orders')}>
              <MdRestaurantMenu size={24} />
              مدیریت سفارشات
            </button>
          )}
          {perms.can_manage_reservations && (
            <button className="waiter-quick-btn" onClick={() => navigate('/waiter/reservations')}>
              <MdEventNote size={24} />
              رزروهای امروز
            </button>
          )}
          {perms.can_manage_tables && (
            <button className="waiter-quick-btn" onClick={() => navigate('/waiter/tables')}>
              <MdTableBar size={24} />
              وضعیت میزها
            </button>
          )}
          {perms.can_manage_menu_availability && (
            <button className="waiter-quick-btn" onClick={() => navigate('/waiter/menu')}>
              <MdInventory size={24} />
              موجودی منو
            </button>
          )}
          {perms.can_view_own_performance && (
            <button className="waiter-quick-btn" onClick={() => navigate('/waiter/performance')}>
              <MdBarChart size={24} />
              عملکرد من
            </button>
          )}
        </div>
      </div>

      {perms.can_force_close_cafe && cafeStatus && (
        <div className={`waiter-cafe-status ${isForceClosed ? 'waiter-cafe-status--closed' : ''}`}>
          <div className="waiter-cafe-status__info">
            <p className="waiter-cafe-status__title">
              {cafeStatus.is_open ? 'کافه هم‌اکنون باز است' : 'کافه هم‌اکنون بسته است'}
            </p>
            <p className="waiter-cafe-status__note">
              {isForceClosed ? 'به‌صورت دستی بسته شده — تا پایان امروز بسته می‌ماند' : (cafeStatus.message || '')}
            </p>
          </div>
          {isForceClosed ? (
            <Button size="sm" onClick={handleToggleForceClose} loading={togglingCafe}>
              <MdLockOpen size={16} /> باز کردن کافه
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              style={{ color: 'var(--error)', borderColor: 'rgba(248,113,113,0.3)' }}
              onClick={handleToggleForceClose}
              loading={togglingCafe}
            >
              <MdPowerSettingsNew size={16} /> بستن فوری کافه
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
