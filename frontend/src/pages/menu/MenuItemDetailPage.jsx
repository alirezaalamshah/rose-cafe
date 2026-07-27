import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MdArrowBack, MdTimer, MdLocalFireDepartment, MdAdd, MdRemove, MdTune, MdRateReview } from 'react-icons/md'
import toast from 'react-hot-toast'
import { menuAPI } from '../../api/menu.js'
import { reviewsAPI } from '../../api/reviews.js'
import useCartStore, { getCartKey } from '../../store/cartStore.js'
import useAuthStore from '../../store/authStore.js'
import StarRating from '../../components/common/StarRating/StarRating.jsx'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { Textarea } from '../../components/common/Input/Input.jsx'
import { formatPrice, formatDate, getMediaUrl } from '../../utils/helpers.js'
import './MenuItemDetailPage.css'
import '../../components/menu/MenuCard/MenuCard.css'

export default function MenuItemDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [selectedAddonIds, setSelectedAddonIds] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const { items, addItem, updateQuantity } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()
  const canReview = isAuthenticated && !user?.is_staff

  const [reviewModal, setReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    Promise.all([menuAPI.getItem(slug)])
      .then(([itemData]) => {
        setItem(itemData)
        // Auto-select first available variant
        if (itemData.variants?.length > 0) {
          const first = itemData.variants.find((v) => v.is_available) || itemData.variants[0]
          setSelectedVariant(first)
        }
        setSelectedImage(itemData.image || null)
        return reviewsAPI.getMenuItemReviews(itemData.id)
      })
      .then((reviewData) => {
        setReviews(Array.isArray(reviewData) ? reviewData : (reviewData.results || []))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <Loading text="در حال بارگذاری..." />
  if (!item) return (
    <div className="empty-state">
      <div className="icon">😕</div>
      <h3>آیتم مورد نظر یافت نشد</h3>
    </div>
  )

  const hasVariants = item.variants?.length > 0

  function getDiscountPct() {
    if (hasVariants) {
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
  const discountPct = getDiscountPct()
  const toPersian = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

  const availableAddons = (item.addons || []).filter((a) => a.is_available)
  const selectedAddons = availableAddons.filter((a) => selectedAddonIds.includes(a.id))
  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0)

  function toggleAddon(addonId) {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    )
  }

  // Effective price based on selected variant or item defaults + افزودنی‌های انتخابی
  const effectivePrice = (selectedVariant
    ? (selectedVariant.discounted_price || selectedVariant.price)
    : (item.discounted_price || item.price)) + addonsTotal
  const effectiveOriginal = selectedVariant
    ? (selectedVariant.has_discount ? selectedVariant.price : null)
    : (item.has_discount ? item.price : null)

  // Cart key for current selection
  const cartKey = getCartKey(item.id, selectedVariant?.id, selectedAddonIds)
  const cartItem = items.find((i) => (i.cartKey || String(i.id)) === cartKey)
  const quantity = cartItem?.quantity || 0

  function handleAddToCart() {
    addItem(item, hasVariants ? selectedVariant : null, selectedAddons)
  }

  async function handleSubmitReview() {
    if (!reviewRating) { return }
    setSubmittingReview(true)
    try {
      await reviewsAPI.createReview({ menu_item: item.id, rating: reviewRating, comment: reviewComment })
      setReviewModal(false)
      setReviewRating(5)
      setReviewComment('')
      toast.success('نظر شما ثبت شد و پس از تایید نمایش داده می‌شود')
    } catch (err) {
      const msg = err.response?.data?.detail
        || (Array.isArray(err.response?.data) ? err.response.data[0] : null)
        || Object.values(err.response?.data || {})?.[0]?.[0]
        || 'خطا در ثبت نظر'
      toast.error(msg)
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <div className="item-detail">
      <button className="item-detail__back" onClick={() => navigate(-1)}>
        <MdArrowBack size={18} /> بازگشت به منو
      </button>

      <div className="item-detail__card neu-card">
        <div className="item-detail__grid">
          <div className="item-detail__image-col">
            <div className="item-detail__image-wrap">
            {selectedImage ? (
              <img
                src={getMediaUrl(selectedImage)}
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
            {discountPct && item.status === 'available' && (
              <div className="menu-card__stamp menu-card__stamp--lg">
                <span className="menu-card__stamp-pct">{toPersian(discountPct)}٪</span>
                <span className="menu-card__stamp-label">تخفیف</span>
              </div>
            )}
            </div>

            {/* Extra images gallery */}
            {item.extra_images?.length > 0 && (
              <div className="item-detail__gallery">
                {item.image && (
                  <button
                    className={`item-detail__thumb ${selectedImage === item.image ? 'item-detail__thumb--active' : ''}`}
                    onClick={() => setSelectedImage(item.image)}
                  >
                    <img src={getMediaUrl(item.image_thumbnail || item.image)} alt={item.name} loading="lazy" width="64" height="64" />
                  </button>
                )}
                {item.extra_images.map((img) => (
                  <button
                    key={img.id}
                    className={`item-detail__thumb ${selectedImage === img.image ? 'item-detail__thumb--active' : ''}`}
                    onClick={() => setSelectedImage(img.image)}
                  >
                    <img src={getMediaUrl(img.image_thumbnail || img.image)} alt={`${item.name} تصویر ${img.id}`} loading="lazy" width="64" height="64" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="item-detail__info">
            <div className="item-detail__category">{item.category_name || item.category?.name}</div>
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

            {/* Variant Selector */}
            {hasVariants && (
              <div className="item-detail__variants">
                <div className="item-detail__variants-label">
                  <MdTune size={16} color="var(--primary)" />
                  <span>انتخاب نوع</span>
                </div>
                <div className="item-detail__variants-list">
                  {item.variants.map((v) => (
                    <button
                      key={v.id}
                      className={`variant-btn ${selectedVariant?.id === v.id ? 'variant-btn--selected' : ''} ${!v.is_available ? 'variant-btn--unavailable' : ''}`}
                      onClick={() => v.is_available && setSelectedVariant(v)}
                      disabled={!v.is_available}
                    >
                      <span className="variant-btn__name">{v.name}</span>
                      <span className="variant-btn__price">
                        {formatPrice(v.final_price)}
                      </span>
                      {v.has_discount && (
                        <span className="variant-btn__original">{formatPrice(v.price)}</span>
                      )}
                      {!v.is_available && <span className="variant-btn__sold">ناموجود</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Addons Selector — افزودنی‌های اختیاری */}
            {availableAddons.length > 0 && (
              <div className="item-detail__addons">
                <div className="item-detail__variants-label">
                  <MdAdd size={16} color="var(--primary)" />
                  <span>افزودنی‌ها (اختیاری)</span>
                </div>
                <div className="item-detail__addons-list">
                  {availableAddons.map((a) => (
                    <label key={a.id} className="addon-check">
                      <input
                        type="checkbox"
                        checked={selectedAddonIds.includes(a.id)}
                        onChange={() => toggleAddon(a.id)}
                      />
                      <span className="addon-check__name">{a.name}</span>
                      <span className="addon-check__price">+{formatPrice(a.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="item-detail__price-row">
              <div>
                <div className="item-detail__price">
                  {formatPrice(effectivePrice)}
                </div>
                {effectiveOriginal && (
                  <div className="item-detail__price-original">
                    {formatPrice(effectiveOriginal)}
                  </div>
                )}
              </div>

              {item.status === 'available' ? (
                quantity > 0 ? (
                  <div className="item-detail__qty">
                    <button onClick={() => updateQuantity(cartKey, quantity + 1)}>
                      <MdAdd size={20} />
                    </button>
                    <span>{quantity}</span>
                    <button onClick={() => updateQuantity(cartKey, quantity - 1)}>
                      <MdRemove size={20} />
                    </button>
                  </div>
                ) : (
                  <Button size="lg" onClick={handleAddToCart} disabled={hasVariants && !selectedVariant}>
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

      <div className="item-detail__reviews">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>نظرات کاربران</h2>
          {canReview && (
            <Button size="sm" variant="secondary" onClick={() => setReviewModal(true)}>
              <MdRateReview size={16} /> ثبت نظر
            </Button>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-xl) 0' }}>
            <div className="icon" style={{ fontSize: '2rem' }}>💬</div>
            <h3>هنوز نظری ثبت نشده</h3>
            {canReview && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                اولین نفری باشید که نظر می‌دهید
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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

      <Modal
        isOpen={reviewModal}
        onClose={() => setReviewModal(false)}
        title={`ثبت نظر — ${item.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewModal(false)}>انصراف</Button>
            <Button onClick={handleSubmitReview} loading={submittingReview}>ثبت نظر</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div>
            <p style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>امتیاز شما</p>
            <StarRating value={reviewRating} onChange={setReviewRating} size="lg" />
          </div>
          <Textarea
            label="نظر شما (اختیاری)"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder={`تجربه خود از ${item.name} را بنویسید...`}
            rows={4}
          />
        </div>
      </Modal>
    </div>
  )
}
