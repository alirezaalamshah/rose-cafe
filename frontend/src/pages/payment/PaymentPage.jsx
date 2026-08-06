import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdHistory, MdPayment } from 'react-icons/md'
import { paymentsAPI } from '../../api/payments.js'
import Button from '../../components/common/Button/Button.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, formatDate } from '../../utils/helpers.js'
import './PaymentPage.css'

export default function PaymentPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    paymentsAPI.getHistory()
      .then((data) => setHistory(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  return (
    <div className="payment-page">
      <div className="page-header">
        <h1>تاریخچه پرداخت‌ها</h1>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><MdHistory size={48} /></div>
          <h3>تاریخچه‌ای موجود نیست</h3>
          <Button onClick={() => navigate('/')} style={{ marginTop: 16 }}>رفتن به منو</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {history.map((p) => (
            <div key={p.id} className="payment-history-item neu-card-sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MdPayment size={20} color="var(--primary)" />
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    پرداخت سفارش #{p.order_number || p.order_id}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatDate(p.created_at)}
                    {p.ref_id && p.ref_id !== 'FREE' && p.ref_id !== `CASH-${p.order_id}`
                      ? ` — کد پیگیری: ${p.ref_id}` : ''}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <span className="price">{formatPrice(p.amount)}</span>
                <span className={`status-badge ${p.status === 'success' ? 'status-confirmed' : p.status === 'cancelled' ? 'status-cancelled' : 'status-pending'}`}>
                  {p.status === 'success' ? 'موفق' : p.status === 'cancelled' ? 'لغو شده' : 'ناموفق'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
