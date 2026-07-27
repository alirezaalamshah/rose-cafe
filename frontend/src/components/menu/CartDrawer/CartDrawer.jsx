import { useNavigate } from 'react-router-dom'
import { MdClose, MdShoppingCart, MdDelete } from 'react-icons/md'
import useCartStore from '../../../store/cartStore.js'
import Button from '../../common/Button/Button.jsx'
import { formatPrice, getMediaUrl, itemUnitPrice } from '../../../utils/helpers.js'
import './CartDrawer.css'

export default function CartDrawer({ isOpen, onClose }) {
  // سلکتورهای محدود: با تغییر discountCode/deliveryType (که در همین استور هستند ولی
  // به سبد ربطی ندارند) دیگر کل دراور ری‌رندر نمی‌شود
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const subtotal = items.reduce((s, i) => s + itemUnitPrice(i) * i.quantity, 0)
  const navigate = useNavigate()

  if (!isOpen) return null

  return (
    <>
      <div className="cart-drawer-overlay" onClick={onClose} />
      <div className="cart-drawer">
        <div className="cart-drawer__header">
          <div className="cart-drawer__title">
            <MdShoppingCart size={20} />
            سبد خرید
            {items.length > 0 && (
              <span className="cart-drawer__count">{items.length} آیتم</span>
            )}
          </div>
          <button className="cart-drawer__close" onClick={onClose}>
            <MdClose size={18} />
          </button>
        </div>

        <div className="cart-drawer__body">
          {items.length === 0 ? (
            <div className="cart-drawer__empty">
              <div className="cart-drawer__empty-icon">🛒</div>
              <p>سبد خرید شما خالی است</p>
            </div>
          ) : (
            items.map((item) => {
              const key = item.cartKey || String(item.id)
              return (
                <div key={key} className="cart-item">
                  <div className="cart-item__image">
                    {item.image ? (
                      <img
                        src={getMediaUrl(item.image_thumbnail || item.image)}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
                      />
                    ) : '☕'}
                  </div>
                  <div className="cart-item__info">
                    <p className="cart-item__name">{item.name}</p>
                    {item.variantName && (
                      <p className="cart-item__variant">{item.variantName}</p>
                    )}
                    {item.addons?.length > 0 && (
                      <p className="cart-item__variant">+ {item.addons.map((a) => a.name).join('، ')}</p>
                    )}
                    {item.slug && (
                      <button
                        className="cart-item__customize-link"
                        onClick={() => { onClose(); navigate(`/menu/${item.slug}`) }}
                      >
                        افزودن با گزینه‌های متفاوت
                      </button>
                    )}
                    <span className="cart-item__price">
                      {formatPrice(itemUnitPrice(item) * item.quantity)}
                    </span>
                    <div className="cart-item__controls">
                      <button
                        className="cart-item__qty-btn"
                        onClick={() => updateQuantity(key, item.quantity + 1)}
                      >+</button>
                      <span className="cart-item__qty">{item.quantity}</span>
                      <button
                        className="cart-item__qty-btn"
                        onClick={() => updateQuantity(key, item.quantity - 1)}
                      >−</button>
                      <button
                        className="cart-item__delete"
                        onClick={() => removeItem(key)}
                      >
                        <MdDelete size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer__footer">
            <div className="cart-drawer__summary-row">
              <span>جمع</span>
              <span className="price">{formatPrice(subtotal)}</span>
            </div>
            <div className="cart-drawer__summary-row total">
              <span>مبلغ قابل پرداخت</span>
              <span className="price">{formatPrice(subtotal)}</span>
            </div>
            <Button
              fullWidth
              onClick={() => { onClose(); navigate('/cart') }}
            >
              ادامه و تکمیل سفارش
            </Button>
            <Button variant="ghost" fullWidth onClick={clearCart} size="sm">
              خالی کردن سبد
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
