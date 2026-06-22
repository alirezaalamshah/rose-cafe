import { useState, useEffect } from 'react'
import { MdCheck, MdStar } from 'react-icons/md'
import toast from 'react-hot-toast'
import { reviewsAPI } from '../../api/reviews.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import StarRating from '../../components/common/StarRating/StarRating.jsx'
import { formatDate } from '../../utils/helpers.js'
import './AdminOrdersPage.css'

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [cafeReviews, setCafeReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('menu')
  const [approving, setApproving] = useState(null)

  useEffect(() => {
    Promise.all([
      reviewsAPI.adminGetReviews(),
      reviewsAPI.adminGetCafeReviews(),
    ]).then(([r, cr]) => {
      setReviews(Array.isArray(r) ? r : (r.results || []))
      setCafeReviews(Array.isArray(cr) ? cr : (cr.results || []))
    }).finally(() => setLoading(false))
  }, [])

  async function handleApprove(id, type) {
    setApproving(id)
    try {
      if (type === 'menu') {
        await reviewsAPI.adminApproveReview(id)
        setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: true } : r))
      } else {
        await reviewsAPI.adminApproveCafeReview(id)
        setCafeReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: true } : r))
      }
      toast.success('نظر تایید شد')
    } catch {
      toast.error('خطا در تایید نظر')
    } finally {
      setApproving(null)
    }
  }

  const currentReviews = tab === 'menu' ? reviews : cafeReviews

  if (loading) return <Loading />

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت نظرات</h1>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
        <button
          className={`admin-action-btn ${tab === 'menu' ? '' : ''}`}
          style={tab === 'menu' ? { background: 'var(--primary)', color: '#1a1205', borderColor: 'var(--primary)' } : {}}
          onClick={() => setTab('menu')}
        >
          نظرات منو ({reviews.length})
        </button>
        <button
          className="admin-action-btn"
          style={tab === 'cafe' ? { background: 'var(--primary)', color: '#1a1205', borderColor: 'var(--primary)' } : {}}
          onClick={() => setTab('cafe')}
        >
          نظرات کافه ({cafeReviews.length})
        </button>
      </div>

      {currentReviews.length === 0 ? (
        <div className="empty-state">
          <div className="icon">💬</div>
          <h3>نظری یافت نشد</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {currentReviews.map((review) => (
            <div key={review.id} className="neu-card-sm" style={{ padding: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {review.user_name || review.user?.phone || 'کاربر'}
                    </span>
                    <StarRating value={review.rating} readonly size="sm" />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatDate(review.created_at)}
                    </span>
                    {tab === 'menu' && review.menu_item && (
                      <span style={{ fontSize: '0.78rem', background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                        {review.menu_item.name}
                      </span>
                    )}
                  </div>
                  {review.comment && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {review.comment}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  {review.is_approved ? (
                    <span className="status-badge status-confirmed">✓ تایید شده</span>
                  ) : (
                    <button
                      className="admin-action-btn"
                      disabled={approving === review.id}
                      onClick={() => handleApprove(review.id, tab)}
                    >
                      <MdCheck size={14} /> تایید
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
