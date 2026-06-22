import { useNavigate } from 'react-router-dom'
import { MdAdd, MdRemove, MdTimer, MdLocalFireDepartment } from 'react-icons/md'
import useCartStore from '../../../store/cartStore.js'
import { formatPrice, getMediaUrl } from '../../../utils/helpers.js'
import './MenuCard.css'

export default function MenuCard({ item }) {
  const { items, addItem, updateQuantity } = useCartStore()
  const navigate = useNavigate()
  const cartItem = items.find((i) => i.id === item.id)
  const quantity = cartItem?.quantity || 0
  const isUnavailable = item.status !== 'available'

  function handleAdd(e) {
    e.stopPropagation()
    if (!isUnavailable) addItem(item)
  }

  function handleIncrease(e) {
    e.stopPropagation()
    updateQuantity(item.id, quantity + 1)
  }

  function handleDecrease(e) {
    e.stopPropagation()
    updateQuantity(item.id, quantity - 1)
  }

  return (
    <div className="menu-card" onClick={() => navigate(`/menu/${item.slug}`)}>
      <div className="menu-card__image">
        {item.image ? (
          <img src={getMediaUrl(item.image)} alt={item.name} loading="lazy" />
        ) : (
          <div className="menu-card__image-placeholder">☕</div>
        )}
        <div className="menu-card__badges">
          {item.is_featured && (
            <span className="menu-card__badge menu-card__badge--featured">⭐ ویژه</span>
          )}
          {item.is_vegetarian && (
            <span className="menu-card__badge menu-card__badge--vegetarian">🌱 گیاهی</span>
          )}
          {isUnavailable && (
            <span className="menu-card__badge menu-card__badge--unavailable">
              {item.status === 'coming_soon' ? 'به زودی' : 'ناموجود'}
            </span>
          )}
        </div>
      </div>

      <div className="menu-card__body">
        <div className="menu-card__header">
          <h3 className="menu-card__name">{item.name}</h3>
          {item.average_rating && (
            <div className="menu-card__rating">
              <span className="menu-card__rating-star">★</span>
              <span className="menu-card__rating-value">{item.average_rating}</span>
            </div>
          )}
        </div>

        {item.description && (
          <p className="menu-card__description">{item.description}</p>
        )}

        <div className="menu-card__meta">
          {item.preparation_time && (
            <span className="menu-card__meta-item">
              <MdTimer size={14} />
              {item.preparation_time} دقیقه
            </span>
          )}
          {item.calories && (
            <span className="menu-card__meta-item">
              <MdLocalFireDepartment size={14} />
              {item.calories} کالری
            </span>
          )}
        </div>

        <div className="menu-card__footer">
          <div className="menu-card__price">
            <span className="menu-card__price-current">
              {formatPrice(item.discounted_price || item.price)}
            </span>
            {item.discounted_price && item.discounted_price < item.price && (
              <span className="menu-card__price-original">
                {formatPrice(item.price)}
              </span>
            )}
          </div>

          {quantity > 0 ? (
            <div
              className="menu-card__quantity"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="menu-card__qty-btn" onClick={handleIncrease}>+</button>
              <span className="menu-card__qty-value">{quantity}</span>
              <button className="menu-card__qty-btn" onClick={handleDecrease}>−</button>
            </div>
          ) : (
            <button
              className="menu-card__add-btn"
              onClick={handleAdd}
              disabled={isUnavailable}
            >
              <MdAdd size={16} />
              {isUnavailable ? 'ناموجود' : 'افزودن'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
