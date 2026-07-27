import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdAdd, MdRemove, MdTimer, MdLocalFireDepartment, MdTune } from 'react-icons/md'
import useCartStore from '../../../store/cartStore.js'
import { formatPrice, getMediaUrl } from '../../../utils/helpers.js'
import './MenuCard.css'

function toPersian(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
}

function getDiscountPct(item) {
  if (item.variants?.length > 0) {
    const pcts = item.variants
      .filter((v) => v.has_discount && v.is_available)
      .map((v) => Math.round((1 - v.discounted_price / v.price) * 100))
    return pcts.length > 0 ? Math.max(...pcts) : null
  }
  if (item.discounted_price && item.discounted_price < item.price) {
    return Math.round((1 - item.discounted_price / item.price) * 100)
  }
  return null
}

function MenuCard({ item }) {
  const navigate = useNavigate()
  const isUnavailable = item.status !== 'available'
  const hasVariants = item.variants?.length > 0
  const discountPct = getDiscountPct(item)

  // سلکتورهای محدود: با تغییر آیتم دیگری در سبد، این کارت (و بقیه‌ی کارت‌ها) ری‌رندر نمی‌شوند
  // چون addItem/updateQuantity در map() فقط رفرنس همان آیتم تغییریافته را عوض می‌کنند
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  // For items without variants, look up cart by item id
  const cartItem = useCartStore((s) =>
    !hasVariants ? s.items.find((i) => (i.cartKey || String(i.id)) === String(item.id)) : null
  )
  const quantity = cartItem?.quantity || 0

  // For variant items — any variant of this item currently in cart?
  const variantInCart = useCartStore((s) =>
    hasVariants ? s.items.some((i) => String(i.id) === String(item.id)) : false
  )

  // Min price from available variants
  const minVariantPrice = hasVariants
    ? Math.min(...item.variants.filter((v) => v.is_available).map((v) => v.final_price))
    : null

  function handleAdd(e) {
    e.stopPropagation()
    if (!isUnavailable) addItem(item)
  }

  function handleIncrease(e) {
    e.stopPropagation()
    updateQuantity(String(item.id), quantity + 1)
  }

  function handleDecrease(e) {
    e.stopPropagation()
    updateQuantity(String(item.id), quantity - 1)
  }

  function handleSelectVariant(e) {
    e.stopPropagation()
    navigate(`/menu/${item.slug}`)
  }

  return (
    <div className="menu-card" onClick={() => navigate(`/menu/${item.slug}`)}>
      <div className="menu-card__image">
        {item.image ? (
          <img src={getMediaUrl(item.image_thumbnail || item.image)} alt={item.name} loading="lazy" />
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

        {discountPct && !isUnavailable && (
          <div className="menu-card__stamp">
            <span className="menu-card__stamp-pct">{toPersian(discountPct)}٪</span>
            <span className="menu-card__stamp-label">تخفیف</span>
          </div>
        )}

        {variantInCart && (
          <div className="menu-card__in-cart">
            <span>در سبد</span>
          </div>
        )}
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
          {hasVariants && (
            <span className="menu-card__meta-item">
              <MdTune size={14} />
              {item.variants.length} نوع
            </span>
          )}
          {item.addons?.some((a) => a.is_available) && (
            <span className="menu-card__meta-item">
              <MdAdd size={14} />
              افزودنی
            </span>
          )}
        </div>

        <div className="menu-card__footer">
          <div className="menu-card__price">
            {hasVariants ? (
              <span className="menu-card__price-current">
                از {formatPrice(minVariantPrice)}
              </span>
            ) : (
              <>
                <span className="menu-card__price-current">
                  {formatPrice(item.discounted_price || item.price)}
                </span>
                {item.discounted_price && item.discounted_price < item.price && (
                  <span className="menu-card__price-original">
                    {formatPrice(item.price)}
                  </span>
                )}
              </>
            )}
          </div>

          {hasVariants ? (
            <button
              className="menu-card__add-btn menu-card__add-btn--variant"
              onClick={handleSelectVariant}
              disabled={isUnavailable}
            >
              <MdTune size={16} />
              {isUnavailable ? 'ناموجود' : 'انتخاب'}
            </button>
          ) : quantity > 0 ? (
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

export default memo(MenuCard)
