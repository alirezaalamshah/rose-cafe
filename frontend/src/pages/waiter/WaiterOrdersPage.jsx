import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MdRefresh, MdBolt, MdHistory, MdChevronRight, MdChevronLeft, MdCalendarToday,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { waiterAPI } from '../../api/waiter.js'
import { ordersAPI } from '../../api/orders.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import usePolling from '../../hooks/usePolling.js'
import { formatDateTime, formatPrice, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import { formatJalali, isoToJalali, toPersianNum, MONTH_NAMES } from '../../utils/jalali.js'
import './WaiterOrdersPage.css'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftIsoDate(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatJalaliShort(isoDate) {
  const j = isoToJalali(isoDate)
  if (!j) return '—'
  return `${toPersianNum(j.jd)} ${MONTH_NAMES[j.jm - 1]}`
}

const POLL_INTERVAL_MS = 10000

const STATUS_TABS = [
  { value: '', label: 'همه' },
  { value: 'paid', label: 'پرداخت شده' },
  { value: 'preparing', label: 'در حال آماده‌سازی' },
  { value: 'ready', label: 'آماده تحویل' },
  { value: 'delivered', label: 'تحویل داده شد' },
]

const NEXT_STATUS = {
  paid: { value: 'preparing', label: 'شروع آماده‌سازی', color: 'accent' },
  preparing: { value: 'ready', label: 'آماده شد', color: 'success' },
  ready: { value: 'delivered', label: 'تحویل داده شد', color: 'primary' },
}

export default function WaiterOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [confirmingCash, setConfirmingCash] = useState(null)
  const [view, setView] = useState('active') // 'active' | 'archive'
  const [archiveDate, setArchiveDate] = useState(todayIso())
  const [jumping, setJumping] = useState(null) // 'prev' | 'next' | null
  const [datePickerModal, setDatePickerModal] = useState(false)

  const activeTab = searchParams.get('status') || ''

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = {}
      if (activeTab) params.status = activeTab
      if (view === 'archive') params.date = archiveDate
      const data = await waiterAPI.getOrders(params)
      setOrders(Array.isArray(data) ? data : (data?.results || []))
    } catch {
      toast.error('خطا در بارگذاری سفارشات')
    } finally {
      setLoading(false)
    }
  }, [activeTab, view, archiveDate])

  useEffect(() => { load() }, [load])

  // سفارشات جاری هر ۱۰ ثانیه بی‌صدا به‌روز می‌شوند تا سفارش تازه بدون فشردن دکمه دیده شود
  usePolling(() => load(true), POLL_INTERVAL_MS, view === 'active')

  async function jumpToNearestOrderDate(direction) {
    setJumping(direction)
    try {
      const res = await waiterAPI.nearestOrderDate(archiveDate, direction)
      if (res.date) {
        setArchiveDate(res.date)
      } else {
        toast.error(direction === 'prev' ? 'سفارش قدیمی‌تری در بایگانی نیست' : 'سفارش جدیدتری در بایگانی نیست')
      }
    } catch {
      toast.error('خطا در جستجوی روز قبل/بعد')
    } finally {
      setJumping(null)
    }
  }

  async function handleConfirmCash(order) {
    setConfirmingCash(order.id)
    try {
      await ordersAPI.confirmCashPayment(order.id)
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, is_paid: true } : o))
      toast.success(`وجه سفارش #${order.order_number || order.id} دریافت و تأیید شد`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تأیید دریافت وجه')
    } finally {
      setConfirmingCash(null)
    }
  }

  async function handleStatusUpdate(order, newStatus) {
    setUpdating(order.id)
    try {
      const updated = await waiterAPI.updateOrderStatus(order.id, newStatus)
      setOrders((prev) => prev.map((o) => o.id === order.id ? updated : o))
      toast.success(`وضعیت سفارش #${order.order_number || order.id} به ${getStatusLabel(newStatus)} تغییر کرد`)
    } catch {
      toast.error('خطا در بروزرسانی وضعیت')
    } finally {
      setUpdating(null)
    }
  }

  const displayOrders = orders

  return (
    <div className="waiter-orders">
      <div className="waiter-page-header">
        <h1>سفارشات</h1>
        <button className="waiter-refresh-btn" onClick={() => load()} disabled={loading}>
          <MdRefresh size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* جاری / بایگانی */}
      <div className="waiter-view-toggle">
        <button
          className={`waiter-view-btn ${view === 'active' ? 'waiter-view-btn--active' : ''}`}
          onClick={() => setView('active')}
        >
          <MdBolt size={15} /> جاری
        </button>
        <button
          className={`waiter-view-btn ${view === 'archive' ? 'waiter-view-btn--active' : ''}`}
          onClick={() => setView('archive')}
        >
          <MdHistory size={15} /> بایگانی
        </button>
      </div>

      {view === 'archive' && (
        <div className="waiter-archive-nav">
          <div className="waiter-day-strip">
            {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
              const iso = shiftIsoDate(archiveDate, offset)
              return (
                <button
                  key={iso}
                  className={`waiter-day-btn ${offset === 0 ? 'active' : ''}`}
                  onClick={() => setArchiveDate(iso)}
                >
                  {formatJalaliShort(iso)}
                </button>
              )
            })}
          </div>

          <button
            className="waiter-archive-skip waiter-archive-skip--prev"
            onClick={() => jumpToNearestOrderDate('prev')}
            disabled={jumping !== null}
            title="نزدیک‌ترین روز قبلی که سفارش دارد"
          >
            <MdChevronRight size={18} />
            {jumping === 'prev' ? '...' : 'روز قبل'}
          </button>

          <button
            className="waiter-archive-skip waiter-archive-skip--next"
            onClick={() => jumpToNearestOrderDate('next')}
            disabled={jumping !== null}
            title="نزدیک‌ترین روز بعدی که سفارش دارد"
          >
            {jumping === 'next' ? '...' : 'روز بعد'}
            <MdChevronLeft size={18} />
          </button>

          <button
            className="waiter-archive-jump-btn"
            onClick={() => setDatePickerModal(true)}
            title="پرش به تاریخ خاص"
            aria-label="پرش به تاریخ خاص"
          >
            <MdCalendarToday size={18} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="waiter-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`waiter-tab ${activeTab === tab.value ? 'waiter-tab--active' : ''}`}
            onClick={() => setSearchParams(tab.value ? { status: tab.value } : {})}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : displayOrders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>{view === 'archive' ? `سفارشی برای ${formatJalali(archiveDate)} یافت نشد` : 'سفارشی یافت نشد'}</h3>
        </div>
      ) : (
        <div className="waiter-order-grid">
          {displayOrders.map((order) => {
            const next = NEXT_STATUS[order.status]
            return (
              <div key={order.id} className={`waiter-order-card neu-card-sm waiter-order-card--${order.status}`}>
                <div className="waiter-order-card__top">
                  <span className="waiter-order-card__id">#{order.order_number || order.id}</span>
                  <span className={`status-badge ${getStatusClass(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="waiter-order-card__meta">
                  <span>
                    {order.delivery_type === 'dine_in'
                      ? `🍽️ میز ${order.table_detail?.number ?? '—'}`
                      : order.delivery_type === 'takeaway' ? '🥡 برون‌بر' : '🚚 ارسال'}
                  </span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>

                {order.payment_method === 'cash' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem', fontWeight: 700,
                      background: order.is_paid ? 'var(--success-bg)' : 'rgba(251,191,36,0.15)',
                      color: order.is_paid ? 'var(--success)' : '#f59e0b',
                      border: `1px solid ${order.is_paid ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}>
                      💵 {order.is_paid ? 'نقدی — وصول شد' : 'نقدی — در انتظار وصول'}
                    </span>
                  </div>
                )}

                {order.items?.length > 0 && (
                  <div className="waiter-order-card__items">
                    {order.items.map((item, i) => (
                      <div key={i} className="waiter-order-card__item">
                        <span className="waiter-order-card__qty">×{item.quantity}</span>
                        <span>{item.menu_item_detail?.name || '—'}</span>
                        {item.variant_name && <span className="waiter-order-card__variant">({item.variant_name})</span>}
                        {item.addons?.length > 0 && (
                          <span className="waiter-order-card__variant">+ {item.addons.map((a) => a.name).join('، ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {order.note && (
                  <div className="waiter-order-card__note">📝 {order.note}</div>
                )}

                <div className="waiter-order-card__footer">
                  <span className="waiter-order-card__total">{formatPrice(order.final_price)}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {order.payment_method === 'cash' && !order.is_paid && (
                      <button
                        className="waiter-action-btn waiter-action-btn--success"
                        disabled={confirmingCash === order.id}
                        onClick={() => handleConfirmCash(order)}
                      >
                        {confirmingCash === order.id ? '...' : '💵 وصول وجه'}
                      </button>
                    )}
                    {next && (
                      <button
                        className={`waiter-action-btn waiter-action-btn--${next.color}`}
                        disabled={updating === order.id}
                        onClick={() => handleStatusUpdate(order, next.value)}
                      >
                        {updating === order.id ? '...' : next.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={datePickerModal}
        onClose={() => setDatePickerModal(false)}
        title="پرش به تاریخ خاص"
        size="sm"
      >
        <PersianDatePicker
          inline
          value={archiveDate}
          onChange={(v) => { setArchiveDate(v); setDatePickerModal(false) }}
        />
      </Modal>
    </div>
  )
}
