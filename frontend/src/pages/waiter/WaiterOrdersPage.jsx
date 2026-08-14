import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MdRefresh, MdCheckCircle, MdCancel, MdRestaurant, MdTakeoutDining,
  MdDeliveryDining, MdAttachMoney, MdCreditCard,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { waiterAPI } from '../../api/waiter.js'
import { ordersAPI } from '../../api/orders.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { Textarea } from '../../components/common/Input/Input.jsx'
import { confirm } from '../../store/confirmStore.js'
import usePolling from '../../hooks/usePolling.js'
import { formatDateTime, formatPrice, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './WaiterOrdersPage.css'

const POLL_INTERVAL_MS = 10000

const STATUS_TABS = [
  { value: '', label: 'همه' },
  { value: 'pending_confirmation', label: 'در انتظار تأیید' },
  { value: 'paid', label: 'تأیید شده' },
  { value: 'preparing', label: 'در حال آماده‌سازی' },
  { value: 'ready', label: 'آماده تحویل' },
  { value: 'delivered', label: 'تحویل داده شد' },
]

const NEXT_STATUS = {
  paid: { value: 'preparing', label: 'شروع آماده‌سازی', color: 'accent' },
  preparing: { value: 'ready', label: 'آماده شد', color: 'success' },
  ready: { value: 'delivered', label: 'تحویل داده شد', color: 'primary' },
}

const DELIVERY_TYPE_META = {
  dine_in: { Icon: MdRestaurant, label: (order) => `میز ${order.table_detail?.number ?? '—'}` },
  takeaway: { Icon: MdTakeoutDining, label: () => 'بیرون‌بر' },
  delivery: { Icon: MdDeliveryDining, label: () => 'ارسال' },
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

export default function WaiterOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [confirmingCash, setConfirmingCash] = useState(null)
  const [approving, setApproving] = useState(null)
  const [rejectModal, setRejectModal] = useState(null) // order being rejected
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const activeTab = searchParams.get('status') || ''

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = {}
      if (activeTab) params.status = activeTab
      const data = await waiterAPI.getOrders(params)
      setOrders(Array.isArray(data) ? data : (data?.results || []))
    } catch {
      toast.error('خطا در بارگذاری سفارشات')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  // سفارشات جاری هر ۱۰ ثانیه بی‌صدا به‌روز می‌شوند تا سفارش تازه بدون فشردن دکمه دیده شود
  usePolling(() => load(true), POLL_INTERVAL_MS)

  async function handleConfirmCash(order) {
    setConfirmingCash(order.id)
    try {
      await ordersAPI.confirmCashPayment(order.id)
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, is_paid: true } : o))
      toast.success(`وجه سفارش #${order.order_number || order.id} دریافت و تأیید شد`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تأیید دریافت وجه')
      // سفارش شاید همین الان به گارسون دیگری اختصاص یافته باشد — لیست را برای هماهنگی رفرش کن
      load(true)
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
      // احتمالاً گارسون دیگری زودتر این سفارش را تأیید/رد کرده — از لیست حذفش کن
      load(true)
    } finally {
      setApproving(null)
    }
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
      load(true)
    } finally {
      setRejecting(false)
    }
  }

  async function handleStatusUpdate(order, newStatus) {
    setUpdating(order.id)
    try {
      const updated = await waiterAPI.updateOrderStatus(order.id, newStatus)
      setOrders((prev) => prev.map((o) => o.id === order.id ? updated : o))
      toast.success(`وضعیت سفارش #${order.order_number || order.id} به ${getStatusLabel(newStatus)} تغییر کرد`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در بروزرسانی وضعیت')
      load(true)
    } finally {
      setUpdating(null)
    }
  }

  const displayOrders = orders

  return (
    <div className="waiter-orders">
      <div className="waiter-page-header">
        <h1>سفارشات</h1>
        <button className="waiter-refresh-btn" onClick={() => load()} disabled={loading} aria-label="بروزرسانی لیست سفارشات">
          <MdRefresh size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

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
          <h3>سفارشی یافت نشد</h3>
        </div>
      ) : (
        <div className="waiter-order-grid">
          {displayOrders.map((order) => {
            const next = NEXT_STATUS[order.status]
            const badge = paymentBadge(order)
            const deliveryMeta = DELIVERY_TYPE_META[order.delivery_type] || DELIVERY_TYPE_META.delivery
            return (
              <div key={order.id} className={`waiter-order-card neu-card-sm waiter-order-card--${order.status}`}>
                <div className="waiter-order-card__top">
                  <span className="waiter-order-card__id">#{order.order_number || order.id}</span>
                  <span className={`status-badge ${getStatusClass(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="waiter-order-card__meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <deliveryMeta.Icon size={14} /> {deliveryMeta.label(order)}
                  </span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    fontSize: '0.78rem', fontWeight: 700,
                    background: badge.paid ? 'var(--success-bg)' : 'rgba(251,191,36,0.15)',
                    color: badge.paid ? 'var(--success)' : '#f59e0b',
                    border: `1px solid ${badge.paid ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  }}>
                    <badge.Icon size={13} /> {badge.text}
                  </span>
                </div>

                {order.items?.length > 0 && (
                  <div className="waiter-order-card__items">
                    {order.items.map((item, i) => (
                      <div key={i} className="waiter-order-card__item">
                        <div className="waiter-order-card__item-row">
                          <span className="waiter-order-card__qty">×{item.quantity}</span>
                          <span>{item.menu_item_detail?.name || '—'}</span>
                          {item.variant_name && <span className="waiter-order-card__variant">({item.variant_name})</span>}
                          {item.addons?.length > 0 && (
                            <span className="waiter-order-card__variant">+ {item.addons.map((a) => a.name).join('، ')}</span>
                          )}
                        </div>
                        <div className="waiter-order-card__item-price">
                          {formatPrice(item.unit_price)} × {item.quantity} = {formatPrice(item.subtotal)}
                        </div>
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
                    {order.payment_method === 'cash' && !order.is_paid && order.status !== 'rejected' && order.status !== 'cancelled' && (
                      <button
                        className="waiter-action-btn waiter-action-btn--success"
                        disabled={confirmingCash === order.id}
                        onClick={() => handleConfirmCash(order)}
                      >
                        {confirmingCash === order.id ? '...' : <><MdAttachMoney size={15} /> وصول وجه</>}
                      </button>
                    )}
                    {order.status === 'pending_confirmation' && (
                      <>
                        <button
                          className="waiter-action-btn waiter-action-btn--success"
                          disabled={approving === order.id}
                          onClick={() => handleApprove(order)}
                        >
                          <MdCheckCircle size={15} /> {approving === order.id ? '...' : 'تأیید سفارش'}
                        </button>
                        <button
                          className="waiter-action-btn waiter-action-btn--accent"
                          onClick={() => openRejectModal(order)}
                        >
                          <MdCancel size={15} /> رد سفارش
                        </button>
                      </>
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
    </div>
  )
}
