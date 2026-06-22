import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdDelete, MdShoppingCart, MdLocalOffer, MdHome, MdStorefront } from 'react-icons/md'
import toast from 'react-hot-toast'
import useCartStore from '../../store/cartStore.js'
import useAuthStore from '../../store/authStore.js'
import { ordersAPI } from '../../api/orders.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea, Select } from '../../components/common/Input/Input.jsx'
import { formatPrice, getMediaUrl } from '../../utils/helpers.js'
import './CartPage.css'

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, deliveryType, setDeliveryType } = useCartStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const subtotal = items.reduce((s, i) => s + (i.discounted_price || i.price) * i.quantity, 0)
  const deliveryCost = deliveryType === 'delivery' ? 15000 : 0
  const total = subtotal + deliveryCost - discountAmount

  async function handleSubmitOrder() {
    if (items.length === 0) return
    setSubmitting(true)
    try {
      const orderData = {
        items: items.map((i) => ({ menu_item: i.id, quantity: i.quantity })),
        delivery_type: deliveryType,
        note,
        discount_code: discountCode,
      }
      const order = await ordersAPI.createOrder(orderData)
      clearCart()
      toast.success('سفارش با موفقیت ثبت شد!')
      navigate(`/payment?order_id=${order.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در ثبت سفارش')
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <div className="page-header">
          <h1>سبد خرید</h1>
        </div>
        <div className="empty-state">
          <div className="icon">🛒</div>
          <h3>سبد خرید شما خالی است</h3>
          <p>از منو آیتم‌های مورد علاقه‌تان را اضافه کنید</p>
          <Button onClick={() => navigate('/')} style={{ marginTop: 16 }}>
            رفتن به منو
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="page-header">
        <h1>سبد خرید</h1>
        <p>{items.length} آیتم در سبد شما</p>
      </div>

      <div className="cart-layout">
        <div className="cart-items-section">
          <div className="neu-card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>آیتم‌های سفارش</h2>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={clearCart}
              >
                <MdDelete size={16} /> خالی کردن سبد
              </button>
            </div>
            {items.map((item) => (
              <div key={item.id} className="cart-page__item">
                <div className="cart-page__item-image">
                  {item.image
                    ? <img src={getMediaUrl(item.image)} alt={item.name} />
                    : <span>☕</span>
                  }
                </div>
                <div className="cart-page__item-info">
                  <p className="cart-page__item-name">{item.name}</p>
                  <p className="cart-page__item-unit">
                    {formatPrice(item.discounted_price || item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="cart-page__item-controls">
                  <div className="cart-page__qty">
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                  </div>
                  <p className="cart-page__item-total">
                    {formatPrice((item.discounted_price || item.price) * item.quantity)}
                  </p>
                  <button className="cart-page__remove" onClick={() => removeItem(item.id)}>
                    <MdDelete size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Delivery Type */}
          <div className="neu-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>نحوه دریافت سفارش</h2>
            <div className="cart-page__delivery-types">
              <button
                className={`cart-page__delivery-btn ${deliveryType === 'takeaway' ? 'active' : ''}`}
                onClick={() => setDeliveryType('takeaway')}
              >
                <MdStorefront size={24} />
                <span>تحویل در محل</span>
                <small>رایگان</small>
              </button>
              <button
                className={`cart-page__delivery-btn ${deliveryType === 'delivery' ? 'active' : ''}`}
                onClick={() => setDeliveryType('delivery')}
              >
                <MdHome size={24} />
                <span>ارسال با پیک</span>
                <small>{formatPrice(15000)}</small>
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="neu-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
            <Textarea
              label="توضیحات سفارش (اختیاری)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: بدون پیاز، قهوه اضافه..."
              rows={3}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="cart-summary">
          <div className="neu-card" style={{ padding: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>خلاصه سفارش</h2>

            <div className="cart-summary__rows">
              <div className="cart-summary__row">
                <span>جمع کالاها</span>
                <span className="price">{formatPrice(subtotal)}</span>
              </div>
              {deliveryCost > 0 && (
                <div className="cart-summary__row">
                  <span>هزینه ارسال</span>
                  <span className="price">{formatPrice(deliveryCost)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="cart-summary__row" style={{ color: 'var(--success)' }}>
                  <span>تخفیف</span>
                  <span>−{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="cart-summary__row cart-summary__row--total">
                <span>مبلغ نهایی</span>
                <span className="price">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Discount */}
            <div className="cart-summary__discount">
              <Input
                label="کد تخفیف"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="کد تخفیف را وارد کنید"
                iconLeft={<MdLocalOffer size={18} />}
              />
            </div>

            <Button
              fullWidth
              size="lg"
              onClick={handleSubmitOrder}
              loading={submitting}
              style={{ marginTop: 'var(--space-lg)' }}
            >
              <MdShoppingCart size={18} />
              ثبت سفارش و پرداخت
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
