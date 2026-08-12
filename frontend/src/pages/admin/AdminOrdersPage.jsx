import { useState, useEffect, useCallback } from 'react'
import {
  MdRefresh, MdShoppingBag, MdPerson, MdAccessTime, MdTableRestaurant, MdHistory, MdBolt,
  MdChevronRight, MdChevronLeft, MdCalendarToday, MdCheckCircle, MdCancel, MdBadge,
  MdRestaurant, MdTakeoutDining, MdDeliveryDining, MdAttachMoney, MdCreditCard,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { ordersAPI } from '../../api/orders.js'
import { staffActivityAPI } from '../../api/staffActivity.js'
import { Select, Textarea } from '../../components/common/Input/Input.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Button from '../../components/common/Button/Button.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { confirm } from '../../store/confirmStore.js'
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
  { value: 'pending_confirmation', label: 'در انتظار تأیید کافه' },
  { value: 'paid', label: 'تأیید شده' },
  { value: 'preparing', label: 'در حال آماده‌سازی' },
  { value: 'ready', label: 'آماده تحویل' },
  { value: 'delivered', label: 'تحویل داده شد' },
  { value: 'rejected', label: 'رد شده' },
  { value: 'cancelled', label: 'لغو شده' },
]

const NEXT_STATUS = {
  paid: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

const DELIVERY_TYPE_META = {
  delivery: { Icon: MdDeliveryDining, label: 'پیک' },
  dine_in: { Icon: MdRestaurant, label: 'سرو در کافه' },
  takeaway: { Icon: MdTakeoutDining, label: 'برون‌بر' },
}

// نشان وضعیت واقعی پرداخت — تنها منبع درست این اطلاعات، فارغ از وضعیت کلی سفارش
// (چون سفارش نقدی بلافاصله به‌خاطر آشپزخانه «تأیید شده» می‌شود، حتی قبل از وصول وجه)
function paymentBadge(order) {
  const paid = !!order.is_paid
  if (order.payment_method === 'cash') {
    return { Icon: MdAttachMoney, text: paid ? 'نقدی — وصول شد' : 'نقدی — در انتظار وصول', paid }
  }
  return { Icon: MdCreditCard, text: paid ? 'آنلاین — پرداخت موفق' : 'آنلاین — در انتظار پرداخت', paid }
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
  const [approving, setApproving] = useState(null)
  const [rejectModal, setRejectModal] = useState(null) // order being rejected
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [view, setView] = useState('active') // 'active' | 'archive'
  const [archiveDate, setArchiveDate] = useState(todayIso())
  const [jumping, setJumping] = useState(null) // 'prev' | 'next' | null
  const [datePickerModal, setDatePickerModal] = useState(false)
  const [historyOrder, setHistoryOrder] = useState(null)
  const [historyLogs, setHistoryLogs] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

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

  async function handleApprove(order) {
    if (!(await confirm('این سفارش را تأیید می‌کنید؟ سفارش به صف آماده‌سازی می‌رود.', {
      title: 'تأیید سفارش', danger: false, confirmLabel: 'تأیید سفارش',
    }))) return
    setApproving(order.id)
    try {
      const updated = await ordersAPI.approveOrder(order.id)
      setOrders((prev) => prev.map((o) => o.id === order.id ? updated : o))
      toast.success(`سفارش #${order.order_number || order.id} تأیید شد`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تأیید سفارش')
    } finally {
      setApproving(null)
    }
  }

  function openHistory(order) {
    setHistoryOrder(order)
    setHistoryLoading(true)
    staffActivityAPI.getLog({ order: order.id })
      .then((data) => setHistoryLogs(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setHistoryLoading(false))
  }

  function openRejectModal(order) {
    setRejectReason('')
    setRejectModal(order)
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error('دلیل رد سفارش الزامی است')
      return
    }
    setRejecting(true)
    try {
      const updated = await ordersAPI.rejectOrder(rejectModal.id, rejectReason.trim())
      setOrders((prev) => prev.map((o) => o.id === rejectModal.id ? updated : o))
      toast.success(`سفارش #${rejectModal.order_number || rejectModal.id} رد شد`)
      setRejectModal(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در رد سفارش')
    } finally {
      setRejecting(false)
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

      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title={`رد سفارش #${rejectModal?.order_number || rejectModal?.id || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal(null)}>انصراف</Button>
            <Button onClick={handleReject} loading={rejecting}>رد سفارش</Button>
          </>
        }
      >
        <Textarea
          label="دلیل رد سفارش *"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="مثلاً: تمام شدن یکی از مواد اولیه"
          rows={3}
        />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
          این دلیل به‌صورت پیامک به مشتری اطلاع داده می‌شود.
        </p>
      </Modal>

      <Modal
        isOpen={!!historyOrder}
        onClose={() => setHistoryOrder(null)}
        title={`تاریخچه‌ی سفارش #${historyOrder?.order_number || historyOrder?.id || ''}`}
        size="sm"
      >
        {historyLoading ? <Loading /> : historyLogs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>هنوز اکشنی روی این سفارش ثبت نشده.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historyLogs.map((log) => (
              <div key={log.id} style={{
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>{log.user_name}</span>
                  <span>{formatDateTime(log.created_at)}</span>
                </div>
                <div style={{ fontSize: '0.85rem' }}>{log.detail}</div>
              </div>
            ))}
          </div>
        )}
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
            const badge = paymentBadge(order)
            const deliveryMeta = DELIVERY_TYPE_META[order.delivery_type]
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
                    <span className="admin-order-card__delivery" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {deliveryMeta && <deliveryMeta.Icon size={13} />}
                      {deliveryMeta?.label || order.delivery_type}
                      {order.delivery_type === 'dine_in' && order.table_detail?.number
                        ? ` — میز ${order.table_detail.number}`
                        : ''}
                    </span>
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem', fontWeight: 700,
                      background: badge.paid ? 'var(--success-bg)' : 'rgba(251,191,36,0.15)',
                      color: badge.paid ? 'var(--success)' : '#f59e0b',
                      border: `1px solid ${badge.paid ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}>
                      <badge.Icon size={13} /> {badge.text}
                    </span>
                    {order.assigned_waiter_name && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem', fontWeight: 600,
                        background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}>
                        <MdBadge size={13} /> {order.assigned_waiter_name}
                      </span>
                    )}
                    <button
                      className="admin-orders__archive-jump-btn"
                      onClick={() => openHistory(order)}
                      title="تاریخچه‌ی این سفارش"
                      aria-label="تاریخچه‌ی این سفارش"
                      style={{ width: 28, height: 28 }}
                    >
                      <MdHistory size={15} />
                    </button>
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
                    {order.payment_method === 'cash' && !order.is_paid && order.status !== 'rejected' && order.status !== 'cancelled' && (
                      <button
                        className="admin-action-btn"
                        style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'rgba(74,222,128,0.4)' }}
                        disabled={confirmingCash === order.id}
                        onClick={() => handleConfirmCash(order.id)}
                      >
                        {confirmingCash === order.id ? '...' : <><MdAttachMoney size={15} /> تأیید وصول وجه</>}
                      </button>
                    )}
                    {order.status === 'pending_confirmation' && (
                      <>
                        <button
                          className="admin-action-btn"
                          style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'rgba(74,222,128,0.4)' }}
                          disabled={approving === order.id}
                          onClick={() => handleApprove(order)}
                        >
                          <MdCheckCircle size={15} /> {approving === order.id ? '...' : 'تأیید سفارش'}
                        </button>
                        <button
                          className="admin-action-btn"
                          style={{ background: 'rgba(171,77,53,0.1)', color: 'var(--accent)', borderColor: 'rgba(171,77,53,0.3)' }}
                          onClick={() => openRejectModal(order)}
                        >
                          <MdCancel size={15} /> رد سفارش
                        </button>
                      </>
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
