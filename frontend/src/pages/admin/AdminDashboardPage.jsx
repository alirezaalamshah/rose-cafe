import { useState, useEffect } from 'react'
import {
  MdShoppingBag, MdPeople, MdPayments,
  MdTableBar, MdPending, MdOutdoorGrill
} from 'react-icons/md'
import api from '../../api/axios.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice } from '../../utils/helpers.js'
import './AdminDashboardPage.css'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/')
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const today = stats?.today || {}
  const total = stats?.total || {}

  const CARDS = [
    { label: 'سفارشات امروز', value: today.orders_count || 0, icon: MdShoppingBag, color: 'var(--primary)' },
    { label: 'درآمد امروز', value: formatPrice(today.revenue || 0), icon: MdPayments, color: 'var(--success)' },
    { label: 'در انتظار', value: today.pending_orders || 0, icon: MdPending, color: 'var(--warning)' },
    { label: 'در حال آماده‌سازی', value: today.preparing_orders || 0, icon: MdOutdoorGrill, color: 'var(--info)' },
    { label: 'رزروهای امروز', value: today.reservations || 0, icon: MdTableBar, color: 'var(--accent)' },
    { label: 'کل کاربران', value: total.users || 0, icon: MdPeople, color: 'var(--primary)' },
    { label: 'کل سفارشات', value: total.orders || 0, icon: MdShoppingBag, color: 'var(--text-secondary)' },
    { label: 'کل درآمد', value: formatPrice(total.revenue || 0), icon: MdPayments, color: 'var(--success)' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>داشبورد مدیریت</h1>
        <p>خلاصه عملکرد کافه</p>
      </div>

      <h2 className="section-title">امروز</h2>
      <div className="admin-stats-grid">
        {CARDS.slice(0, 5).map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <h2 className="section-title" style={{ marginTop: 'var(--space-xl)' }}>کلی</h2>
      <div className="admin-stats-grid">
        {CARDS.slice(5).map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="admin-stat-card neu-card">
      <div className="admin-stat-card__icon" style={{ background: `${color}18`, color }}>
        <Icon size={26} />
      </div>
      <div className="admin-stat-card__body">
        <p className="admin-stat-card__label">{label}</p>
        <p className="admin-stat-card__value" style={{ color }}>{value}</p>
      </div>
    </div>
  )
}
