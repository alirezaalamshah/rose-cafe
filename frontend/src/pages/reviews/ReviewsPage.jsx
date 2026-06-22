import { useState, useEffect } from 'react'
import { MdStar, MdRateReview } from 'react-icons/md'
import toast from 'react-hot-toast'
import { reviewsAPI } from '../../api/reviews.js'
import useAuthStore from '../../store/authStore.js'
import StarRating from '../../components/common/StarRating/StarRating.jsx'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Textarea } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatDate } from '../../utils/helpers.js'
import './ReviewsPage.css'

export default function ReviewsPage() {
  const { isAuthenticated } = useAuthStore()
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      reviewsAPI.getCafeReviews(),
      reviewsAPI.getCafeStats(),
    ]).then(([reviewData, statsData]) => {
      setReviews(Array.isArray(reviewData) ? reviewData : (reviewData.results || []))
      setStats(statsData)
    }).finally(() => setLoading(false))
  }, [])

  async function handleSubmitReview() {
    if (!rating) { toast.error('لطفاً امتیاز را انتخاب کنید'); return }
    setSubmitting(true)
    try {
      await reviewsAPI.createCafeReview({ rating, comment })
      toast.success('نظر شما با موفقیت ثبت شد و پس از تایید نمایش داده می‌شود.')
      setModalOpen(false)
      setRating(5)
      setComment('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در ثبت نظر')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading />

  const avgRating = stats?.average_rating || 0
  const totalReviews = stats?.total_reviews || reviews.length
  const ratingDist = stats?.rating_distribution || {}

  return (
    <div className="reviews-page">
      <div className="page-header">
        <h1>نظرات کاربران</h1>
        <p>آنچه مشتریان درباره کافه ما می‌گویند</p>
      </div>

      {/* Stats */}
      <div className="reviews-stats neu-card">
        <div className="reviews-stats__main">
          <div className="reviews-stats__avg">{avgRating ? avgRating.toFixed(1) : '—'}</div>
          <StarRating value={Math.round(avgRating)} readonly size="lg" />
          <p className="reviews-stats__count">{totalReviews} نظر</p>
        </div>
        <div className="reviews-stats__bars">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingDist[star] || 0
            const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0
            return (
              <div key={star} className="reviews-stats__bar-row">
                <span className="reviews-stats__bar-label">{star} ★</span>
                <div className="reviews-stats__bar-track">
                  <div
                    className="reviews-stats__bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="reviews-stats__bar-count">{count}</span>
              </div>
            )
          })}
        </div>
        <div className="reviews-stats__action">
          {isAuthenticated ? (
            <Button onClick={() => setModalOpen(true)} size="lg">
              <MdRateReview size={18} />
              ثبت نظر
            </Button>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              برای ثبت نظر ابتدا وارد شوید
            </p>
          )}
        </div>
      </div>

      {/* Reviews List */}
      <div className="reviews-list">
        {reviews.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💬</div>
            <h3>هنوز نظری ثبت نشده</h3>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="review-card neu-card-sm">
              <div className="review-card__header">
                <div className="review-card__user">
                  <div className="review-card__avatar">
                    {review.user_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="review-card__name">{review.user_name || 'کاربر'}</p>
                    <p className="review-card__date">{formatDate(review.created_at)}</p>
                  </div>
                </div>
                <StarRating value={review.rating} readonly size="sm" />
              </div>
              {review.comment && (
                <p className="review-card__comment">{review.comment}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Submit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="ثبت نظر درباره کافه"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>انصراف</Button>
            <Button onClick={handleSubmitReview} loading={submitting}>ثبت نظر</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div>
            <p style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              امتیاز شما
            </p>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <Textarea
            label="نظر شما (اختیاری)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="تجربه خود از کافه را بنویسید..."
            rows={4}
          />
        </div>
      </Modal>
    </div>
  )
}
