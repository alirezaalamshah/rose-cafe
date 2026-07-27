import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MdCheckCircle, MdError, MdHourglassTop } from 'react-icons/md'
import { paymentsAPI } from '../../api/payments.js'
import useCartStore from '../../store/cartStore.js'
import Button from '../../components/common/Button/Button.jsx'
import './PaymentPage.css'

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const clearCart = useCartStore((state) => state.clearCart)

  const [state, setState] = useState('loading') // loading | success | failed | cancelled
  const [refId, setRefId] = useState('')
  const [orderId, setOrderId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const authority = searchParams.get('Authority') || searchParams.get('authority')
    const status = searchParams.get('Status') || searchParams.get('status')

    if (!authority) {
      setState('failed')
      setMessage('پارامترهای بازگشت از درگاه نامعتبر است.')
      return
    }

    if (status !== 'OK') {
      setState('cancelled')
      setMessage('پرداخت توسط شما لغو شد.')
      // اطلاع به بک‌اند برای آپدیت وضعیت
      paymentsAPI.verifyPayment({ Authority: authority, Status: status }).catch(() => {})
      return
    }

    paymentsAPI.verifyPayment({ Authority: authority, Status: status })
      .then((data) => {
        if (data.success) {
          clearCart() // پرداخت موفق — سبد خرید را کاملاً پاک می‌کنیم
          setState('success')
          setRefId(data.ref_id || '')
          setOrderId(data.order_id || null)
        } else {
          setState('failed')
          setMessage(data.message || 'پرداخت تأیید نشد.')
        }
      })
      .catch(() => {
        setState('failed')
        setMessage('خطا در ارتباط با سرور. لطفاً با پشتیبانی تماس بگیرید.')
      })
  }, [searchParams])

  if (state === 'loading') {
    return (
      <div className="payment-page">
        <div className="payment-result neu-card" style={{ textAlign: 'center' }}>
          <div className="payment-result__icon" style={{ animation: 'spin 1.5s linear infinite' }}>
            <MdHourglassTop size={64} color="var(--primary)" />
          </div>
          <h1>در حال بررسی پرداخت...</h1>
          <p style={{ color: 'var(--text-muted)' }}>لطفاً صبر کنید</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="payment-page">
        <div className="payment-result payment-result--success neu-card">
          <div className="payment-result__icon">
            <MdCheckCircle size={64} color="var(--success)" />
          </div>
          <h1>پرداخت موفق!</h1>
          <p>سفارش شما با موفقیت ثبت و پرداخت شد.</p>
          {refId && (
            <div className="payment-result__refid">
              <span>کد پیگیری:</span>
              <strong style={{ direction: 'ltr', display: 'inline-block' }}>{refId}</strong>
            </div>
          )}
          <div className="payment-result__actions">
            <Button onClick={() => navigate(orderId ? `/orders` : '/orders')}>
              مشاهده سفارش
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')}>
              بازگشت به منو
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'cancelled') {
    return (
      <div className="payment-page">
        <div className="payment-result payment-result--error neu-card">
          <div className="payment-result__icon">
            <MdError size={64} color="var(--text-muted)" />
          </div>
          <h1>پرداخت لغو شد</h1>
          <p style={{ color: 'var(--text-muted)' }}>{message}</p>
          <div className="payment-result__actions">
            <Button onClick={() => navigate(-1)}>بازگشت</Button>
            <Button variant="secondary" onClick={() => navigate('/orders')}>سفارشات من</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-page">
      <div className="payment-result payment-result--error neu-card">
        <div className="payment-result__icon">
          <MdError size={64} color="var(--error)" />
        </div>
        <h1>پرداخت ناموفق</h1>
        <p>{message || 'متأسفانه پرداخت شما انجام نشد.'}</p>
        <div className="payment-result__actions">
          <Button onClick={() => navigate(-1)}>تلاش مجدد</Button>
          <Button variant="secondary" onClick={() => navigate('/orders')}>سفارشات من</Button>
        </div>
      </div>
    </div>
  )
}
