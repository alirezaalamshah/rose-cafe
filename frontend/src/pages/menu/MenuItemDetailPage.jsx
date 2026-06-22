import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MdArrowBack, MdTimer, MdLocalFireDepartment, MdAdd, MdRemove } from 'react-icons/md'
import { menuAPI } from '../../api/menu.js'
import { reviewsAPI } from '../../api/reviews.js'
import useCartStore from '../../store/cartStore.js'
import StarRating from '../../components/common/StarRating/StarRating.jsx'
import Button from '../../components/common/Button/Button.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, formatDate, getMediaUrl } from '../../utils/helpers.js'
import './MenuItemDetailPage.css'

export default function MenuItemDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const { items, addItem, updateQuantity } = useCartStore()
  const cartItem = items.find((i) => i.id === item?.id)
  const quantity = cartItem?.quantity || 0

  useEffect(() => {
    Promise.all([
      menuAPI.getItem(slug),
    ]).then(([itemData]) => {
      setItem(itemData)
      return reviewsAPI.getMenuItemReviews(itemData.id)
    }).then((reviewData) => {
      const results = Array.isArray(reviewData) ? reviewData : (reviewData.results || [])
      setReviews(results)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <Loading text="در حال بارگذاری..." />
  if (!item) return (
    <div className="empty-state">
      <div className="icon">😕</div>
      <h3>آیتم مورد نظر یافت نشد</h3>
    </div>
  )

  return (
    <div className="item-detail">
      <button className="item-detail__back" onClick={() => navigate(-1)}>
        <MdArrowBack size={18} /> بازگشت به منو
      </button>

      <div className="item-detail__card neu-card">
        <div className="item-detail__grid">
          <div className="item-detail__image-wrap">
            {item.image ? (
              <img
                src={getMediaUrl(item.image)}
                alt={item.name}
                className="item-detail__image"
              />
            ) : (
              <div className="item-detail__image-placeholder">☕</div>
            )}
            <div className="item-detail__image-badges">
              {item.is_featured && (
                <span className="menu-card__badge menu-card__badge--featured">⭐ ویژه</span>
              )}
              {item.is_vegetarian && (
                <span className="menu-card__badge menu-card__badge--vegetarian">🌱 گیاهی</span>
              )}
            </div>
          </div>

          <div className="item-detail__info">
            <div className="item-detail__category">{item.category?.name}</div>
            <h1 className="item-detail__name">{item.name}</h1>

            {item.average_rating && (
              <div className="item-detail__rating">
                <StarRating value={Math.round(item.average_rating)} readonly size="sm" />
                <span className="item-detail__rating-text">
                  {item.average_rating} از ۵ ({item.review_count} نظر)
                </span>
              </div>
            )}

            {item.description && (
              <p className="item-detail__description">{item.description}</p>
            )}

            <div className="item-detail__meta">
              {item.preparation_time && (
                <div className="item-detail__meta-item">
                  <MdTimer size={18} color="var(--primary)" />
                  <span>{item.preparation_time} دقیقه</span>
                </div>
              )}
              {item.calories && (
                <div className="item-detail__meta-item">
                  <MdLocalFireDepartment size={18} color="var(--primary)" />
                  <span>{item.calories} کالری</span>
                </div>
              )}
            </div>

            <div className="item-detail__price-row">
              <div>
                <div className="item-detail__price">
                  {formatPrice(item.discounted_price || item.price)}
                </div>
                {item.discounted_price && item.discounted_price < item.price && (
                  <div className="item-detail__price-original">
                    {formatPrice(item.price)}
                  </div>
                )}
              </div>

              {item.status === 'available' ? (
                quantity > 0 ? (
                  <div className="item-detail__qty">
                    <button onClick={() => updateQuantity(item.id, quantity + 1)}>
                      <MdAdd size={20} />
                    </button>
                    <span>{quantity}</span>
                    <button onClick={() => updateQuantity(item.id, quantity - 1)}>
                      <MdRemove size={20} />
                    </button>
                  </div>
                ) : (
                  <Button size="lg" onClick={() => addItem(item)}>
                    <MdAdd size={18} /> افزودن به سبد
                  </Button>
                )
              ) : (
                <Button size="lg" disabled>
                  {item.status === 'coming_soon' ? 'به زودی' : 'ناموجود'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="item-detail__reviews">
          <h2 className="section-title">نظرات کاربران</h2>
          {reviews.map((review) => (
            <div key={review.id} className="review-item neu-card-sm">
              <div className="review-item__header">
                <div className="review-item__user">
                  <div className="review-item__avatar">
                    {review.user_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="review-item__name">{review.user_name || 'کاربر'}</p>
                    <p className="review-item__date">{formatDate(review.created_at)}</p>
                  </div>
                </div>
                <StarRating value={review.rating} readonly size="sm" />
              </div>
              {review.comment && (
                <p className="review-item__comment">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
