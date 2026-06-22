import { useState, useEffect } from 'react'
import { MdShoppingBag, MdAccessTime } from 'react-icons/md'
import toast from 'react-hot-toast'
import { ordersAPI } from '../../api/orders.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { formatPrice, formatDate, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './OrdersPage.css'

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => {
    ordersAPI.getOrders()
      .then((data) => setOrders(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

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
                  سفارش #{order.id}
                </div>
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>

              <div className="order-card__items">
                {order.items?.map((item) => (
                  <div key={item.id} className="order-card__item">
                    <span className="order-card__item-name">
                      {item.menu_item?.name || 'آیتم'}
                    </span>
                    <span className="order-card__item-qty">×{item.quantity}</span>
                    <span className="order-card__item-price">
                      {formatPrice(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="order-card__footer">
                <div className="order-card__meta">
                  <span className="order-card__date">
                    <MdAccessTime size={14} />
                    {formatDate(order.created_at)}
                  </span>
                  <span className="order-card__type">
                    {order.delivery_type === 'delivery' ? '🛵 ارسال با پیک' : '🏪 تحویل در محل'}
                  </span>
                </div>
                <div className="order-card__total">
                  <span className="order-card__total-label">مبلغ نهایی:</span>
                  <span className="price">{formatPrice(order.final_price)}</span>
                </div>
                {['pending', 'confirmed'].includes(order.status) && (
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
