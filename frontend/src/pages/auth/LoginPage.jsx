import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdCoffee, MdArrowBack, MdPhone } from 'react-icons/md'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input } from '../../components/common/Input/Input.jsx'
import './LoginPage.css'

const OTP_LENGTH = 6
const RESEND_SECONDS = 120

export default function LoginPage() {
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [timer, setTimer] = useState(0)
  const [phoneError, setPhoneError] = useState('')
  const { sendOTP, verifyOTP, isLoading, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const otpRefs = useRef([])

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  function validatePhone(p) {
    const cleaned = p.replace(/\s/g, '')
    if (!cleaned) return 'شماره موبایل را وارد کنید'
    if (!/^09\d{9}$/.test(cleaned)) return 'شماره موبایل معتبر نیست (مثال: 09123456789)'
    return ''
  }

  async function handleSendOTP(e) {
    e.preventDefault()
    const err = validatePhone(phone)
    if (err) { setPhoneError(err); return }
    setPhoneError('')
    const res = await sendOTP(phone.replace(/\s/g, ''))
    if (res.success) {
      setStep('otp')
      setTimer(RESEND_SECONDS)
      setOtp(Array(OTP_LENGTH).fill(''))
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
      toast.success('کد تایید ارسال شد')
    } else {
      toast.error(res.error)
    }
  }

  async function handleVerifyOTP(e, directOtp) {
    e?.preventDefault()
    const code = directOtp ? directOtp.join('') : otp.join('')
    if (code.length < OTP_LENGTH) {
      toast.error('کد ۶ رقمی را کامل وارد کنید')
      return
    }
    const res = await verifyOTP(phone.replace(/\s/g, ''), code)
    if (res.success) {
      toast.success('ورود موفق! خوش آمدید')
      navigate('/', { replace: true })
    } else {
      toast.error(res.error)
      setOtp(Array(OTP_LENGTH).fill(''))
      otpRefs.current[0]?.focus()
    }
  }

  function handleOtpChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === OTP_LENGTH) {
      handleVerifyOTP(null, newOtp)
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index > 0) otpRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowLeft' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!text) return
    const newOtp = Array(OTP_LENGTH).fill('')
    for (let i = 0; i < text.length; i++) newOtp[i] = text[i]
    setOtp(newOtp)
    const nextEmpty = text.length < OTP_LENGTH ? text.length : OTP_LENGTH - 1
    otpRefs.current[nextEmpty]?.focus()
  }

  async function handleResend() {
    const res = await sendOTP(phone.replace(/\s/g, ''))
    if (res.success) {
      setTimer(RESEND_SECONDS)
      setOtp(Array(OTP_LENGTH).fill(''))
      toast.success('کد جدید ارسال شد')
    } else {
      toast.error(res.error)
    }
  }

  function formatTimer(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo">
          <div className="login-card__logo-icon">
            <MdCoffee size={38} color="var(--primary)" />
          </div>
          <h1>کافه ما</h1>
          <p>{step === 'phone' ? 'ورود با شماره موبایل' : 'تایید شماره موبایل'}</p>
        </div>

        {step === 'phone' ? (
          <form className="login-form" onSubmit={handleSendOTP}>
            <Input
              label="شماره موبایل"
              type="tel"
              placeholder="09123456789"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
              error={phoneError}
              iconLeft={<MdPhone size={18} />}
              dir="ltr"
              style={{ textAlign: 'left' }}
              maxLength={11}
            />
            <Button type="submit" fullWidth loading={isLoading} size="lg">
              دریافت کد تایید
            </Button>
            <p className="login-form__note">
              با ورود به سایت، شرایط و قوانین استفاده از خدمات را می‌پذیرید.
            </p>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleVerifyOTP}>
            <p className="login-form__note">
              کد ۶ رقمی ارسال شده به شماره
              <span className="login-form__phone-display"> {phone} </span>
              را وارد کنید.
            </p>

            <div className="login-form__otp-inputs">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  className={`login-form__otp-input ${digit ? 'filled' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                />
              ))}
            </div>

            <Button type="submit" fullWidth loading={isLoading} size="lg">
              تایید و ورود
            </Button>

            <div className="login-form__resend">
              {timer > 0 ? (
                <span>ارسال مجدد کد تا {formatTimer(timer)}</span>
              ) : (
                <button
                  type="button"
                  className="login-form__resend-btn"
                  onClick={handleResend}
                  disabled={isLoading}
                >
                  ارسال مجدد کد
                </button>
              )}
            </div>

            <button
              type="button"
              className="login-form__back"
              onClick={() => setStep('phone')}
            >
              <MdArrowBack size={16} /> تغییر شماره موبایل
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
