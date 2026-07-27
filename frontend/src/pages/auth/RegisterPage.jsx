import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { MdPhone, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input } from '../../components/common/Input/Input.jsx'
import './LoginPage.css'

const OTP_LENGTH = 6
const RESEND_SECONDS = 120

// مراحل: phone | otp | password
export default function RegisterPage() {
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [timer, setTimer] = useState(0)

  const { register, registerVerify, isLoading, isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const otpRefs = useRef([])

  useEffect(() => {
    if (!isAuthenticated) return
    if (user?.is_staff) navigate('/admin', { replace: true })
    else if (user?.role === 'waiter') navigate('/waiter', { replace: true })
    else navigate('/', { replace: true })
  }, [isAuthenticated, user, navigate])

  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  function validatePhone(p) {
    const c = p.replace(/\s/g, '')
    if (!c) return 'شماره موبایل را وارد کنید'
    if (!/^09\d{9}$/.test(c)) return 'شماره موبایل معتبر نیست'
    return ''
  }

  function formatTimer(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  // ── مرحله ۱: ارسال OTP ────────────────────────────────────────────
  async function handleSendOtp(e) {
    e.preventDefault()
    const err = validatePhone(phone)
    if (err) { setPhoneError(err); return }
    setPhoneError('')

    const res = await register(phone.replace(/\s/g, ''))
    if (res.success) {
      setStep('otp')
      setTimer(RESEND_SECONDS)
      setOtp(Array(OTP_LENGTH).fill(''))
      toast.success('کد تأیید ارسال شد')
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } else {
      toast.error(res.error)
    }
  }

  // ── مرحله ۲→۳: تأیید OTP ─────────────────────────────────────────
  function handleVerifyOtp(e) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < OTP_LENGTH) { toast.error('کد ۶ رقمی را کامل وارد کنید'); return }
    setStep('password')
  }

  // ── مرحله ۳: ثبت‌نام نهایی ────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault()
    const code = otp.join('')
    if (!password) { toast.error('رمز عبور را وارد کنید'); return }
    if (password.length < 8) { toast.error('رمز عبور باید حداقل ۸ کاراکتر باشد'); return }
    if (password !== passwordConfirm) { toast.error('رمز عبور با تکرار آن مطابقت ندارد'); return }

    const res = await registerVerify(phone.replace(/\s/g, ''), code, password, passwordConfirm)
    if (res.success) {
      toast.success('ثبت‌نام با موفقیت انجام شد!')
    } else {
      toast.error(res.error)
      if (res.error.includes('کد')) {
        setStep('otp')
        setOtp(Array(OTP_LENGTH).fill(''))
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      }
    }
  }

  function handleOtpChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index > 0) otpRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowLeft' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!text) return
    const next = Array(OTP_LENGTH).fill('')
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setOtp(next)
    otpRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus()
  }

  async function handleResend() {
    const res = await register(phone.replace(/\s/g, ''))
    if (res.success) {
      setTimer(RESEND_SECONDS)
      setOtp(Array(OTP_LENGTH).fill(''))
      toast.success('کد جدید ارسال شد')
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } else {
      toast.error(res.error)
    }
  }

  const stepLabels = {
    phone: 'مرحله ۱ از ۳',
    otp: 'مرحله ۲ از ۳',
    password: 'مرحله ۳ از ۳',
  }

  const stepTitles = {
    phone: 'ثبت‌نام',
    otp: 'تأیید شماره موبایل',
    password: 'تعیین رمز عبور',
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo">
          <div className="login-card__logo-icon">
            <img src="/ECUC9864.JPEG" alt="کافه" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: '50%' }} />
          </div>
          <h1>{stepTitles[step]}</h1>
          <p>{stepLabels[step]}</p>
        </div>

        {/* مرحله ۱: شماره موبایل */}
        {step === 'phone' && (
          <form className="login-form" onSubmit={handleSendOtp}>
            <Input
              label="شماره موبایل"
              type="tel"
              placeholder="09123456789"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
              error={phoneError}
              iconLeft={<MdPhone size={18} />}
              dir="ltr"
              maxLength={11}
            />
            <Button type="submit" fullWidth loading={isLoading} size="lg">
              ارسال کد تأیید
            </Button>
            <p className="login-form__note">
              قبلاً ثبت‌نام کرده‌اید؟{' '}
              <Link to="/login" className="login-form__link">وارد شوید</Link>
            </p>
          </form>
        )}

        {/* مرحله ۲: OTP */}
        {step === 'otp' && (
          <form className="login-form" onSubmit={handleVerifyOtp}>
            <p className="login-form__note">
              کد ۶ رقمی ارسال شده به
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

            <Button type="submit" fullWidth size="lg">
              تأیید کد
            </Button>

            <div className="login-form__resend">
              {timer > 0 ? (
                <span>ارسال مجدد تا {formatTimer(timer)}</span>
              ) : (
                <button type="button" className="login-form__resend-btn" onClick={handleResend} disabled={isLoading}>
                  ارسال مجدد کد
                </button>
              )}
            </div>

            <button type="button" className="login-form__back" onClick={() => setStep('phone')}>
              تغییر شماره موبایل
            </button>
          </form>
        )}

        {/* مرحله ۳: رمز عبور */}
        {step === 'password' && (
          <form className="login-form" onSubmit={handleRegister}>
            <p className="login-form__note">
              رمز عبور برای حساب
              <span className="login-form__phone-display"> {phone} </span>
              را تعیین کنید.
            </p>

            <div style={{ position: 'relative' }}>
              <Input
                label="رمز عبور"
                type={showPass ? 'text' : 'password'}
                placeholder="حداقل ۸ کاراکتر"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                iconLeft={<MdLock size={18} />}
              />
              <button
                type="button"
                className="login-form__show-pass"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                {showPass ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>

            <Input
              label="تکرار رمز عبور"
              type={showPass ? 'text' : 'password'}
              placeholder="رمز عبور را مجدد وارد کنید"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              iconLeft={<MdLock size={18} />}
            />

            <Button type="submit" fullWidth loading={isLoading} size="lg">
              ثبت‌نام و ورود
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
