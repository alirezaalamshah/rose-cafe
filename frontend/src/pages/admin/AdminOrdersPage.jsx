import { useState, useEffect, useCallback } from 'react'
import {
  MdRefresh, MdShoppingBag, MdPerson, MdAccessTime, MdTableRestaurant, MdHistory, MdBolt,
  MdChevronRight, MdChevronLeft, MdCalendarToday,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { ordersAPI } from '../../api/orders.js'
import { Select } from '../../components/common/Input/Input.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import usePolling from '../../hooks/usePolling.js'
import { formatPrice, formatDateTime, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import { formatJalali, isoToJalali, toPersianNum, MONTH_NAMES } from '../../utils/jalali.js'
import './AdminOrdersPage.css'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// شیفت روزانه روی تاریخ گرگوری ISO — چون یک روز فارغ از تقویم (شمسی/میلادی) همیشه یک روز است،
// فقط نمایش با formatJalali به شمسی تبدیل می‌شود
function shiftIsoDate(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// نسخه‌ی کوتاه بدون سال — برای نوار ۷ روزه جای کافی روی موبایل ندارد
function formatJalaliShort(isoDate) {
  const j = isoToJalali(isoDate)
  if (!j) return '—'
  return `${toPersianNum(j.jd)} ${MONTH_NAMES[j.jm - 1]}`
}

const POLL_INTERVAL_MS = 10000

const STATUSES = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'waiting_payment', label: 'در انتظار پرداخت' },
  { value: 'paid', label: 'پرداخت شده' },
  { value: 'preparing', label: 'در حال آماده‌سازی' },
  { value: 'ready', label: 'آماده تحویل' },
  { value: 'delivered', label: 'تحویل داده شد' },
  { value: 'cancelled', label: 'لغو شده' },
]

const NEXT_STATUS = {
  paid: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

const DELIVERY_LABEL = {
  delivery: '🛵 پیک',
  dine_in: '🍽️ سرو در کافه',
  takeaway: '🥡 برون‌بر',
}

const PAYMENT_FILTERS = [
  { value: '', label: 'همه روش‌های پرداخت' },
  { value: 'online', label: 'آنلاین' },
  { value: 'cash', label: 'نقدی' },
]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [updating, setUpdating] = useState(null)
  const [confirmingCash, setConfirmingCash] = useState(null)
  const [view, setView] = useState('active') // 'active' | 'archive'
  const [archiveDate, setArchiveDate] = useState(todayIso())
  const [jumping, setJumping] = useState(null) // 'prev' | 'next' | null
  const [datePickerModal, setDatePickerModal] = useState(false)

  const fetchOrders = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const params = {}
    if (filterStatus) params.status = filterStatus
    if (view === 'archive') params.date = archiveDate
    ordersAPI.adminGetOrders(params)
      .then((data) => setOrders(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [filterStatus, view, archiveDate])

  // سفارشات جاری هر ۱۰ ثانیه بی‌صدا به‌روز می‌شوند تا سفارش تازه بدون فشردن دکمه دیده شود
  usePolling(() => fetchOrders(true), POLL_INTERVAL_MS, view === 'active')

  async function jumpToNearestOrderDate(direction) {
    setJumping(direction)
    try {
      const res = await ordersAPI.adminNearestOrderDate(archiveDate, direction)
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

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleStatusUpdate(id, newStatus) {
    setUpdating(id)
    try {
      await ordersAPI.adminUpdateStatus(id, newStatus)
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o))
      toast.success(`وضعیت به "${getStatusLabel(newStatus)}" تغییر یافت`)
    } catch {
      toast.error('خطا در تغییر وضعیت')
    } finally {
      setUpdating(null)
    }
  }

  async function handleConfirmCash(id) {
    setConfirmingCash(id)
    try {
      await ordersAPI.confirmCashPayment(id)
      const orderNumber = orders.find((o) => o.id === id)?.order_number || id
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, is_paid: true } : o))
      toast.success(`وجه سفارش #${orderNumber} تأیید شد`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تأیید دریافت وجه')
    } finally {
      setConfirmingCash(null)
    }
  }

  const displayOrders = filterPayment
    ? orders.filter((o) => o.payment_method === filterPayment)
    : orders

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت سفارشات</h1>
      </div>

      <div className="admin-orders__view-toggle">
        <button
          className={`admin-orders__view-btn ${view === 'active' ? 'active' : ''}`}
          onClick={() => setView('active')}
        >
          <MdBolt size={16} /> سفارشات جاری
        </button>
        <button
          className={`admin-orders__view-btn ${view === 'archive' ? 'active' : ''}`}
          onClick={() => setView('archive')}
        >
          <MdHistory size={16} /> بایگانی
        </button>
      </div>

      {view === 'archive' && (
        <div className="admin-orders__archive-nav">
          <div className="admin-orders__day-strip">
            {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
              const iso = shiftIsoDate(archiveDate, offset)
              return (
                <button
                  key={iso}
                  className={`admin-orders__day-btn ${offset === 0 ? 'active' : ''}`}
                  onClick={() => setArchiveDate(iso)}
                >
                  {formatJalaliShort(iso)}
                </button>
              )
            })}
          </div>

          <button
            className="admin-orders__archive-skip admin-orders__archive-skip--prev"
            onClick={() => jumpToNearestOrderDate('prev')}
            disabled={jumping !== null}
            title="نزدیک‌ترین روز قبلی که سفارش دارد"
          >
            <MdChevronRight size={18} />
            {jumping === 'prev' ? '...' : 'روز قبل'}
          </button>

          <button
            className="admin-orders__archive-skip admin-orders__archive-skip--next"
            onClick={() => jumpToNearestOrderDate('next')}
            disabled={jumping !== null}
            title="نزدیک‌ترین روز بعدی که سفارش دارد"
          >
            {jumping === 'next' ? '...' : 'روز بعد'}
            <MdChevronLeft size={18} />
          </button>

          <button
            className="admin-orders__archive-jump-btn"
            onClick={() => setDatePickerModal(true)}
            title="پرش به تاریخ خاص"
            aria-label="پرش به تاریخ خاص"
          >
            <MdCalendarToday size={18} />
          </button>
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

      <div className="admin-orders__filters">
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 200 }}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <Select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          style={{ width: 180 }}
        >
          {PAYMENT_FILTERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
        <button className="admin-orders__refresh" onClick={() => fetchOrders()}>
          <MdRefresh size={18} /> بروزرسانی
        </button>
      </div>

      {loading ? <Loading /> : displayOrders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <h3>{view === 'archive' ? `سفارشی برای ${formatJalali(archiveDate)} یافت نشد` : 'سفارشی یافت نشد'}</h3>
        </div>
      ) : (
        <div className="admin-order-list">
          {displayOrders.map((order) => {
            const nextStatus = NEXT_STATUS[order.status]
            return (
              <div key={order.id} className="admin-order-card neu-card">
                {/* ردیف سرصفحه */}
                <div className="admin-order-card__header">
                  <div className="admin-order-card__id">
                    <MdShoppingBag size={16} color="var(--primary)" />
                    سفارش #{order.order_number || order.id}
                  </div>
                  <div className="admin-order-card__header-meta">
                    <span className="admin-order-card__user">
                      <MdPerson size={14} />
                      {order.user_phone || order.user?.phone || '—'}
                    </span>
                    <span className="admin-order-card__time">
                      <MdAccessTime size={13} />
                      {formatDateTime(order.created_at)}
                    </span>
                    <span className="admin-order-card__delivery">
                      {DELIVERY_LABEL[order.delivery_type] || order.delivery_type}
                      {order.delivery_type === 'dine_in' && order.table_detail?.number
                        ? ` — میز ${order.table_detail.number}`
                        : ''}
                    </span>
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    {order.payment_method === 'cash' ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem', fontWeight: 700,
                        background: order.is_paid ? 'var(--success-bg)' : 'rgba(251,191,36,0.15)',
                        color: order.is_paid ? 'var(--success)' : '#f59e0b',
                        border: `1px solid ${order.is_paid ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      }}>
                        💵 {order.is_paid ? 'نقدی — وصول شد' : 'نقدی — در انتظار'}
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem', fontWeight: 700,
                        background: 'rgba(99,179,237,0.1)', color: '#63b3ed',
                        border: '1px solid rgba(99,179,237,0.3)',
                      }}>
                        💳 آنلاین
                      </span>
                    )}
                  </div>
                </div>

                {/* ریز آیتم‌ها */}
                <div className="admin-order-card__items">
                  {order.items?.map((item) => (
                    <div key={item.id} className="admin-order-card__item">
                      <span className="admin-order-card__item-name">
                        {item.menu_item_detail?.name || '—'}
                        {item.variant_name && (
                          <span className="admin-order-card__item-variant"> ({item.variant_name})</span>
                        )}
                        {item.addons?.length > 0 && (
                          <span className="admin-order-card__item-variant"> + {item.addons.map((a) => a.name).join('، ')}</span>
                        )}
                      </span>
                      <span className="admin-order-card__item-qty">×{item.quantity}</span>
                      <span className="admin-order-card__item-price">
                        {formatPrice(item.subtotal || item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* یادداشت سفارش */}
                {order.note && (
                  <div className="admin-order-card__note">
                    📝 {order.note}
                  </div>
                )}

                {/* ردیف پایین: مبلغ + عملیات */}
                <div className="admin-order-card__footer">
                  <div className="admin-order-card__totals">
                    {order.discount_amount > 0 && (
                      <span className="admin-order-card__discount">
                        تخفیف: −{formatPrice(order.discount_amount)}
                      </span>
                    )}
                    {order.delivery_cost > 0 && (
                      <span className="admin-order-card__delivery-cost">
                        ارسال: {formatPrice(order.delivery_cost)}
                      </span>
                    )}
                    {order.packaging_cost > 0 && (
                      <span className="admin-order-card__delivery-cost">
                        بسته‌بندی: {formatPrice(order.packaging_cost)}
                      </span>
                    )}
                    <span className="admin-order-card__total">
                      جمع: <strong className="price">{formatPrice(order.final_price)}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {order.payment_method === 'cash' && !order.is_paid && (
                      <button
                        className="admin-action-btn"
                        style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'rgba(74,222,128,0.4)' }}
                        disabled={confirmingCash === order.id}
                        onClick={() => handleConfirmCash(order.id)}
                      >
                        {confirmingCash === order.id ? '...' : '💵 تأیید وصول وجه'}
                      </button>
                    )}
                    {nextStatus && (
                      <button
                        className="admin-action-btn"
                        disabled={updating === order.id}
                        onClick={() => handleStatusUpdate(order.id, nextStatus)}
                      >
                        {updating === order.id ? '...' : `→ ${getStatusLabel(nextStatus)}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
