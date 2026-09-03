import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MdCheckCircle, MdError, MdHourglassTop } from 'react-icons/md'
import { walletAPI } from '../../api/wallet.js'
import { formatPrice } from '../../utils/helpers.js'
import Button from '../../components/common/Button/Button.jsx'
import '../payment/PaymentPage.css'

export default function WalletTopupCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [state, setState] = useState('loading') // loading | success | failed | cancelled
  const [balance, setBalance] = useState(null)
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
      setMessage('شارژ کیف‌پول توسط شما لغو شد.')
      walletAPI.verifyTopup({ Authority: authority, Status: status }).catch(() => {})
      return
    }

    walletAPI.verifyTopup({ Authority: authority, Status: status })
      .then((data) => {
        if (data.success) {
          setState('success')
          setBalance(data.balance)
        } else {
          setState('failed')
          setMessage(data.message || 'شارژ کیف‌پول تأیید نشد.')
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
          <h1>شارژ موفق!</h1>
          <p>کیف‌پول شما با موفقیت شارژ شد.</p>
          {balance != null && (
            <div className="payment-result__refid">
              <span>موجودی جدید:</span>
              <strong>{formatPrice(balance)}</strong>
            </div>
          )}
          <div className="payment-result__actions">
            <Button onClick={() => navigate('/wallet')}>مشاهده کیف‌پول</Button>
            <Button variant="secondary" onClick={() => navigate('/')}>بازگشت به منو</Button>
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
          <h1>شارژ لغو شد</h1>
          <p style={{ color: 'var(--text-muted)' }}>{message}</p>
          <div className="payment-result__actions">
            <Button onClick={() => navigate('/wallet')}>بازگشت به کیف‌پول</Button>
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
        <h1>شارژ ناموفق</h1>
        <p>{message || 'متأسفانه شارژ کیف‌پول انجام نشد.'}</p>
        <div className="payment-result__actions">
          <Button onClick={() => navigate('/wallet')}>بازگشت به کیف‌پول</Button>
        </div>
      </div>
    </div>
  )
}
