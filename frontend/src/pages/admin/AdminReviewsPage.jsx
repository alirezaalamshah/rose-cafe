import { useState, useEffect } from 'react'
import { MdCheck, MdClose, MdDoneAll } from 'react-icons/md'
import toast from 'react-hot-toast'
import { reviewsAPI } from '../../api/reviews.js'
import Button from '../../components/common/Button/Button.jsx'
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
  const [bulkApproving, setBulkApproving] = useState(false)

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
      const res = type === 'menu'
        ? await reviewsAPI.adminApproveReview(id)
        : await reviewsAPI.adminApproveCafeReview(id)
      const setter = type === 'menu' ? setReviews : setCafeReviews
      setter((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: res.is_approved } : r))
      toast.success(res.is_approved ? 'نظر تایید شد' : 'تایید نظر لغو شد')
    } catch {
      toast.error('خطا در عملیات')
    } finally {
      setApproving(null)
    }
  }

  const currentReviews = tab === 'menu' ? reviews : cafeReviews
  const pendingCount = currentReviews.filter((r) => !r.is_approved).length

  async function handleBulkApprove() {
    setBulkApproving(true)
    try {
      if (tab === 'menu') {
        const res = await reviewsAPI.adminBulkApproveReviews()
        setReviews((prev) => prev.map((r) => ({ ...r, is_approved: true })))
        toast.success(`${res.updated} نظر تایید شد`)
      } else {
        const res = await reviewsAPI.adminBulkApproveCafeReviews()
        setCafeReviews((prev) => prev.map((r) => ({ ...r, is_approved: true })))
        toast.success(`${res.updated} نظر تایید شد`)
      }
    } catch { toast.error('خطا در تایید گروهی نظرات') }
    finally { setBulkApproving(false) }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت نظرات</h1>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            className="admin-action-btn"
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
        {pendingCount > 0 && (
          <Button variant="ghost" size="sm" loading={bulkApproving} onClick={handleBulkApprove}>
            <MdDoneAll size={16} /> تایید همه نظرات در انتظار ({pendingCount})
          </Button>
        )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {review.user_name || review.user?.phone || 'کاربر'}
                    </span>
                    <StarRating value={review.rating} readonly size="sm" />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatDate(review.created_at)}
                    </span>
                    {tab === 'menu' && review.menu_item_name && (
                      <span style={{ fontSize: '0.78rem', background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                        {review.menu_item_name}
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
                    <button
                      className="admin-action-btn"
                      disabled={approving === review.id}
                      onClick={() => handleApprove(review.id, tab)}
                      style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                    >
                      <MdClose size={14} /> لغو تایید
                    </button>
                  ) : (
                    <button
                      className="admin-action-btn"
                      disabled={approving === review.id}
                      onClick={() => handleApprove(review.id, tab)}
                    >
                      <MdCheck size={14} /> تایید
                    </button>
                  )}
                  <span className={`status-badge ${review.is_approved ? 'status-confirmed' : 'status-pending'}`}>
                    {review.is_approved ? 'تایید شده' : 'در انتظار'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
