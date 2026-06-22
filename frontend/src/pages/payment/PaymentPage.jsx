import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MdCheckCircle, MdError, MdPayment, MdHistory } from 'react-icons/md'
import toast from 'react-hot-toast'
import { paymentsAPI } from '../../api/payments.js'
import { ordersAPI } from '../../api/orders.js'
import Button from '../../components/common/Button/Button.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, formatDate } from '../../utils/helpers.js'
import './PaymentPage.css'

export default function PaymentPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderId = searchParams.get('order_id')
  const status = searchParams.get('status')

  const [order, setOrder] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(!!orderId)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (orderId) {
      ordersAPI.getOrder(orderId)
        .then(setOrder)
        .finally(() => setLoading(false))
    } else {
      setLoading(true)
      paymentsAPI.getHistory()
        .then((data) => setHistory(Array.isArray(data) ? data : (data.results || [])))
        .finally(() => setLoading(false))
    }
  }, [orderId])

  async function handlePay() {
    setPaying(true)
    try {
      const res = await paymentsAPI.requestPayment(orderId)
      if (res.payment_url) {
        window.location.href = res.payment_url
      } else {
        toast.success('پرداخت شبیه‌سازی شده — سفارش تایید شد!')
        navigate('/orders')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در پرداخت')
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <Loading />

  if (status === 'success') {
    return (
      <div className="payment-page">
        <div className="payment-result payment-result--success neu-card">
          <div className="payment-result__icon">
            <MdCheckCircle size={64} color="var(--success)" />
          </div>
          <h1>پرداخت موفق!</h1>
          <p>سفارش شما با موفقیت ثبت و پرداخت شد.</p>
          <div className="payment-result__actions">
            <Button onClick={() => navigate('/orders')}>مشاهده سفارشات</Button>
            <Button variant="secondary" onClick={() => navigate('/')}>بازگشت به منو</Button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="payment-page">
        <div className="payment-result payment-result--error neu-card">
          <div className="payment-result__icon">
            <MdError size={64} color="var(--error)" />
          </div>
          <h1>پرداخت ناموفق</h1>
          <p>متأسفانه پرداخت شما انجام نشد. لطفاً دوباره امتحان کنید.</p>
          <div className="payment-result__actions">
            <Button onClick={() => navigate(-1)}>تلاش مجدد</Button>
            <Button variant="secondary" onClick={() => navigate('/orders')}>سفارشات من</Button>
          </div>
        </div>
      </div>
    )
  }

  if (orderId && order) {
    return (
      <div className="payment-page">
        <div className="page-header">
          <h1>پرداخت سفارش</h1>
          <p>سفارش #{order.id}</p>
        </div>

        <div className="payment-card neu-card">
          <div className="payment-card__icon">
            <MdPayment size={48} color="var(--primary)" />
          </div>
          <h2>تأیید و پرداخت</h2>

          <div className="payment-card__details">
            <div className="payment-card__row">
              <span>شماره سفارش</span>
              <span>#{order.id}</span>
            </div>
            <div className="payment-card__row">
              <span>تعداد آیتم</span>
              <span>{order.items?.length || 0} آیتم</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="payment-card__row" style={{ color: 'var(--success)' }}>
                <span>تخفیف</span>
                <span>−{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            {order.delivery_cost > 0 && (
              <div className="payment-card__row">
                <span>هزینه ارسال</span>
                <span className="price">{formatPrice(order.delivery_cost)}</span>
              </div>
            )}
            <div className="payment-card__row payment-card__row--total">
              <span>مبلغ قابل پرداخت</span>
              <span className="price">{formatPrice(order.final_price)}</span>
            </div>
          </div>

          <Button fullWidth size="lg" onClick={handlePay} loading={paying}>
            <MdPayment size={20} />
            پرداخت {formatPrice(order.final_price)}
          </Button>

          <p className="payment-card__note">
            پس از کلیک، به درگاه پرداخت امن هدایت می‌شوید.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-page">
      <div className="page-header">
        <h1>تاریخچه پرداخت‌ها</h1>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><MdHistory size={48} /></div>
          <h3>تاریخچه‌ای موجود نیست</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {history.map((p) => (
            <div key={p.id} className="payment-history-item neu-card-sm">
              <div>
                <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>پرداخت #{p.id}</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {formatDate(p.created_at)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <span className="price">{formatPrice(p.amount)}</span>
                <span className={`status-badge ${p.status === 'success' ? 'status-confirmed' : 'status-cancelled'}`}>
                  {p.status === 'success' ? 'موفق' : 'ناموفق'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
