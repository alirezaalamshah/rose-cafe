import { useState, useEffect } from 'react'
import { MdShoppingBag, MdAccessTime, MdPayment } from 'react-icons/md'
import toast from 'react-hot-toast'
import { ordersAPI } from '../../api/orders.js'
import { paymentsAPI } from '../../api/payments.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { formatPrice, formatDate, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './OrdersPage.css'

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)
  const [retryingPayment, setRetryingPayment] = useState(null)

  useEffect(() => {
    ordersAPI.getOrders()
      .then((data) => setOrders(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  async function handleRetryPayment(orderId) {
    setRetryingPayment(orderId)
    try {
      const res = await paymentsAPI.requestPayment(orderId)
      if (res.payment_url) {
        window.location.href = res.payment_url
      } else {
        toast.success('پرداخت شبیه‌سازی شده — سفارش تایید شد!')
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'paid' } : o))
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در اتصال به درگاه پرداخت')
    } finally {
      setRetryingPayment(null)
    }
  }

  async function handleCancel(id) {
    setCancelling(id)
    try {
      await ordersAPI.cancelOrder(id)
      setOrders((prev) =>
        prev.map((o) => o.id === id ? { ...o, status: 'cancelled' } : o)
      )
      toast.success('سفارش لغو شد')
    } catch {
      toast.error('خطا در لغو سفارش')
    } finally {
      setCancelling(null)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1>سفارشات من</h1>
        <p>تاریخچه و وضعیت سفارشات شما</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <h3>هنوز سفارشی ثبت نشده</h3>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card neu-card">
              <div className="order-card__header">
                <div className="order-card__id">
                  <MdShoppingBag size={18} color="var(--primary)" />
                  سفارش #{order.order_number || order.id}
                </div>
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>

              <div className="order-card__items">
                {order.items?.map((item) => (
                  <div key={item.id} className="order-card__item">
                    <span className="order-card__item-name">
                      {item.menu_item_detail?.name || '—'}
                      {item.variant_name && (
                        <span className="order-card__item-variant"> ({item.variant_name})</span>
                      )}
                    </span>
                    <span className="order-card__item-qty">×{item.quantity}</span>
                    <span className="order-card__item-price">
                      {formatPrice((item.subtotal || item.unit_price * item.quantity))}
                    </span>
                  </div>
                ))}
              </div>

              {order.note && (
                <div style={{ margin: 'var(--space-sm) 0 0', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                  📝 {order.note}
                </div>
              )}

              {/* بنر دلیل رد سفارش */}
              {order.status === 'rejected' && order.rejection_reason && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  padding: '10px 14px', marginTop: 'var(--space-sm)',
                  background: 'rgba(248,113,113,0.1)', borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(248,113,113,0.3)',
                }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--error)', fontWeight: 600 }}>
                    ❌ دلیل رد سفارش: {order.rejection_reason}
                  </span>
                  {order.payment_method === 'online' && order.is_paid && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      به زودی وجه شما عودت داده خواهد شد.
                    </span>
                  )}
                </div>
              )}

              {/* بنر پرداخت نشده برای سفارشات آنلاین pending */}
              {order.status === 'waiting_payment' && order.payment_method === 'online' && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '10px 14px', marginTop: 'var(--space-sm)',
                  background: 'rgba(251,191,36,0.1)', borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}>
                  <span style={{ fontSize: '0.82rem', color: '#f59e0b', fontWeight: 600 }}>
                    ⏳ این سفارش منتظر پرداخت است
                  </span>
                  <Button
                    size="sm"
                    loading={retryingPayment === order.id}
                    onClick={() => handleRetryPayment(order.id)}
                  >
                    <MdPayment size={15} />
                    پرداخت سفارش
                  </Button>
                </div>
              )}

              <div className="order-card__footer">
                <div className="order-card__meta">
                  <span className="order-card__date">
                    <MdAccessTime size={14} />
                    {formatDate(order.created_at)}
                  </span>
                  <span className="order-card__type">
                    {order.delivery_type === 'delivery'
                      ? '🛵 ارسال با پیک'
                      : order.delivery_type === 'dine_in'
                        ? `🍽️ سرو در کافه — میز ${order.table_detail?.number ?? ''}`
                        : '🏪 بیرون‌بر'}
                  </span>
                </div>
                <div className="order-card__total">
                  <span className="order-card__total-label">مبلغ نهایی:</span>
                  <span className="price">{formatPrice(order.final_price)}</span>
                </div>
                {order.status === 'waiting_payment' && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={cancelling === order.id}
                    onClick={() => handleCancel(order.id)}
                  >
                    لغو سفارش
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
