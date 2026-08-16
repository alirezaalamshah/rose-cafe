import { useState, useEffect, useCallback } from 'react'
import { MdCalendarToday, MdCheckCircle, MdCancel, MdPayments, MdCreditCard, MdTimer, MdPending } from 'react-icons/md'
import { waiterAPI } from '../../api/waiter.js'
import Modal from '../../components/common/Modal/Modal.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice } from '../../utils/helpers.js'
import { formatJalali } from '../../utils/jalali.js'
import './WaiterOrdersPage.css'
import './WaiterPerformancePage.css'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PRESETS = [
  { label: 'امروز', from: () => todayIso(), to: () => todayIso() },
  { label: '۷ روز اخیر', from: () => daysAgoIso(6), to: () => todayIso() },
  { label: '۳۰ روز اخیر', from: () => daysAgoIso(29), to: () => todayIso() },
]

function formatMinutes(m) {
  if (m === null || m === undefined) return '—'
  if (m < 60) return `${Math.round(m)} دقیقه`
  const hours = Math.floor(m / 60)
  const minutes = Math.round(m % 60)
  return minutes > 0 ? `${hours} ساعت و ${minutes} دقیقه` : `${hours} ساعت`
}

export default function WaiterPerformancePage() {
  const [dateFrom, setDateFrom] = useState(daysAgoIso(6))
  const [dateTo, setDateTo] = useState(todayIso())
  const [pickerModal, setPickerModal] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(() => {
    setLoading(true)
    waiterAPI.getMyPerformance({ from: dateFrom, to: dateTo })
      .then(setStats)
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <div className="waiter-performance">
      <div className="waiter-page-header">
        <h1>عملکرد من</h1>
      </div>

      <div className="waiter-performance__filters">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`waiter-tab ${dateFrom === p.from() && dateTo === p.to() ? 'waiter-tab--active' : ''}`}
            onClick={() => { setDateFrom(p.from()); setDateTo(p.to()) }}
          >
            {p.label}
          </button>
        ))}
        <button className="waiter-archive-jump-btn waiter-archive-jump-btn--wide" onClick={() => setPickerModal('from')}>
          <MdCalendarToday size={16} /> از {formatJalali(dateFrom)}
        </button>
        <button className="waiter-archive-jump-btn waiter-archive-jump-btn--wide" onClick={() => setPickerModal('to')}>
          <MdCalendarToday size={16} /> تا {formatJalali(dateTo)}
        </button>
      </div>

      <Modal
        isOpen={!!pickerModal}
        onClose={() => setPickerModal(null)}
        title={pickerModal === 'from' ? 'از تاریخ' : 'تا تاریخ'}
        size="sm"
      >
        <PersianDatePicker
          inline
          value={pickerModal === 'from' ? dateFrom : dateTo}
          onChange={(v) => {
            if (pickerModal === 'from') setDateFrom(v)
            else setDateTo(v)
            setPickerModal(null)
          }}
        />
      </Modal>

      {loading || !stats ? <Loading /> : (
        <div className="waiter-performance__cards">
          <div className="waiter-stat-card waiter-stat-card--pending">
            <div className="waiter-stat-card__icon"><MdCheckCircle size={28} /></div>
            <div className="waiter-stat-card__info">
              <div className="waiter-stat-card__num">{stats.approved_count}</div>
              <div className="waiter-stat-card__label">سفارش تأییدشده</div>
            </div>
          </div>
          <div className="waiter-stat-card waiter-stat-card--res">
            <div className="waiter-stat-card__icon"><MdCancel size={28} /></div>
            <div className="waiter-stat-card__info">
              <div className="waiter-stat-card__num">{stats.rejected_count}</div>
              <div className="waiter-stat-card__label">سفارش ردشده</div>
            </div>
          </div>
          <div className="waiter-stat-card waiter-stat-card--preparing">
            <div className="waiter-stat-card__icon"><MdPayments size={28} /></div>
            <div className="waiter-stat-card__info">
              <div className="waiter-stat-card__num" style={{ fontSize: '1rem' }}>{formatPrice(stats.cash_collected)}</div>
              <div className="waiter-stat-card__label">نقدی وصول‌شده</div>
            </div>
          </div>
          <div className="waiter-stat-card waiter-stat-card--ready">
            <div className="waiter-stat-card__icon"><MdCreditCard size={28} /></div>
            <div className="waiter-stat-card__info">
              <div className="waiter-stat-card__num" style={{ fontSize: '1rem' }}>{formatPrice(stats.online_collected)}</div>
              <div className="waiter-stat-card__label">آنلاین وصول‌شده</div>
            </div>
          </div>
          <div className="waiter-stat-card waiter-stat-card--pending">
            <div className="waiter-stat-card__icon"><MdTimer size={28} /></div>
            <div className="waiter-stat-card__info">
              <div className="waiter-stat-card__num" style={{ fontSize: '1rem' }}>{formatMinutes(stats.avg_delivery_minutes)}</div>
              <div className="waiter-stat-card__label">میانگین تأیید تا تحویل</div>
            </div>
          </div>
          <div className="waiter-stat-card waiter-stat-card--res">
            <div className="waiter-stat-card__icon"><MdPending size={28} /></div>
            <div className="waiter-stat-card__info">
              <div className="waiter-stat-card__num">{stats.current_active_orders}</div>
              <div className="waiter-stat-card__label">سفارش‌های جاری الان</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
