import { useState, useEffect } from 'react'
import { MdRestaurantMenu, MdEventNote, MdTableBar, MdPending, MdOutdoorGrill, MdDoneAll } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import { waiterAPI } from '../../api/waiter.js'
import { formatJalali, jalaliToIso, getTodayJalali } from '../../utils/jalali.js'
import './WaiterDashboardPage.css'

export default function WaiterDashboardPage() {
  const { user } = useAuthStore()
  const perms = user?.waiter_permissions || {}
  const navigate = useNavigate()

  const [orderStats, setOrderStats] = useState({ pending: 0, preparing: 0, ready: 0 })
  const [resStats, setResStats] = useState({ total: 0, confirmed: 0 })
  const [loading, setLoading] = useState(true)

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

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'صبح بخیر'
    if (h < 17) return 'ظهر بخیر'
    return 'عصر بخیر'
  }

  return (
    <div className="waiter-dashboard">
      <div className="waiter-dashboard__greeting">
        <h1>{greeting()}، {user?.full_name || 'گارسون عزیز'} 👋</h1>
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
        </div>
      </div>
    </div>
  )
}
