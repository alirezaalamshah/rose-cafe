import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { MdArrowBack, MdPhone, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input } from '../../components/common/Input/Input.jsx'
import './LoginPage.css'

const OTP_LENGTH = 6
const RESEND_SECONDS = 120

// مراحل: login | forgot_phone | forgot_otp | forgot_pass
export default function LoginPage() {
  const [step, setStep] = useState('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [timer, setTimer] = useState(0)
  const [phoneError, setPhoneError] = useState('')

  const { login, forgotPassword, resetPassword, isLoading, isAuthenticated, user } = useAuthStore()
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

  // ── ورود ──────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    const err = validatePhone(phone)
    if (err) { setPhoneError(err); return }
    if (!password) { toast.error('رمز عبور را وارد کنید'); return }

    const res = await login(phone.replace(/\s/g, ''), password)
    if (res.success) {
      toast.success('خوش آمدید')
    } else if (res.code === 'no_password') {
      toast.error(res.error)
      setStep('forgot_phone')
    } else {
      toast.error(res.error)
    }
  }

  // ── فراموشی: ارسال OTP ────────────────────────────────────────────
  async function handleForgotSend(e) {
    e.preventDefault()
    const err = validatePhone(phone)
    if (err) { setPhoneError(err); return }
    setPhoneError('')

    const res = await forgotPassword(phone.replace(/\s/g, ''))
    if (res.success) {
      setStep('forgot_otp')
      setTimer(RESEND_SECONDS)
      setOtp(Array(OTP_LENGTH).fill(''))
      toast.success('کد بازیابی ارسال شد')
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } else {
      toast.error(res.error)
    }
  }

  // ── فراموشی: تأیید OTP + رمز جدید ───────────────────────────────
  async function handleReset(e) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < OTP_LENGTH) { toast.error('کد ۶ رقمی را کامل وارد کنید'); return }
    if (!newPassword) { toast.error('رمز عبور جدید را وارد کنید'); return }
    if (newPassword.length < 8) { toast.error('رمز عبور باید حداقل ۸ کاراکتر باشد'); return }
    if (newPassword !== newPasswordConfirm) { toast.error('رمز عبور با تکرار آن مطابقت ندارد'); return }

    const res = await resetPassword(phone.replace(/\s/g, ''), code, newPassword, newPasswordConfirm)
    if (res.success) {
      toast.success('رمز عبور با موفقیت تغییر کرد')
    } else {
      toast.error(res.error)
      if (res.error.includes('کد')) {
        setOtp(Array(OTP_LENGTH).fill(''))
        otpRefs.current[0]?.focus()
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
    const res = await forgotPassword(phone.replace(/\s/g, ''))
    if (res.success) { setTimer(RESEND_SECONDS); setOtp(Array(OTP_LENGTH).fill('')); toast.success('کد جدید ارسال شد') }
    else toast.error(res.error)
  }

  const stepTitles = {
    login: 'ورود به حساب',
    forgot_phone: 'فراموشی رمز عبور',
    forgot_otp: 'تأیید شماره موبایل',
    forgot_pass: 'تعیین رمز عبور جدید',
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo">
          <div className="login-card__logo-icon">
            <img src="/ECUC9864.JPEG" alt="کافه" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: '50%' }} />
          </div>
          <h1>خوش آمدید</h1>
          <p>{stepTitles[step]}</p>
        </div>

        {/* ── مرحله: ورود ── */}
        {step === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
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
            <div style={{ position: 'relative' }}>
              <Input
                label="رمز عبور"
                type={showPass ? 'text' : 'password'}
                placeholder="رمز عبور خود را وارد کنید"
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

            <button
              type="button"
              className="login-form__forgot"
              onClick={() => setStep('forgot_phone')}
            >
              رمز عبور را فراموش کرده‌اید؟
            </button>

            <Button type="submit" fullWidth loading={isLoading} size="lg">
              ورود
            </Button>

            <p className="login-form__note">
              حساب ندارید؟{' '}
              <Link to="/register" className="login-form__link">ثبت‌نام کنید</Link>
            </p>
          </form>
        )}

        {/* ── مرحله: فراموشی — وارد کردن شماره ── */}
        {step === 'forgot_phone' && (
          <form className="login-form" onSubmit={handleForgotSend}>
            <p className="login-form__note">
              شماره موبایل خود را وارد کنید. کد بازیابی رمز عبور برای شما ارسال می‌شود.
            </p>
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
              ارسال کد بازیابی
            </Button>
            <button type="button" className="login-form__back" onClick={() => setStep('login')}>
              <MdArrowBack size={16} /> بازگشت به ورود
            </button>
          </form>
        )}

        {/* ── مرحله: فراموشی — تأیید OTP + رمز جدید ── */}
        {step === 'forgot_otp' && (
          <form className="login-form" onSubmit={handleReset}>
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

            <div style={{ position: 'relative' }}>
              <Input
                label="رمز عبور جدید"
                type={showNewPass ? 'text' : 'password'}
                placeholder="حداقل ۸ کاراکتر"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                iconLeft={<MdLock size={18} />}
              />
              <button type="button" className="login-form__show-pass" onClick={() => setShowNewPass((v) => !v)} tabIndex={-1}>
                {showNewPass ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>

            <Input
              label="تکرار رمز عبور جدید"
              type={showNewPass ? 'text' : 'password'}
              placeholder="تکرار رمز عبور"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              iconLeft={<MdLock size={18} />}
            />

            <Button type="submit" fullWidth loading={isLoading} size="lg">
              تغییر رمز عبور و ورود
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

            <button type="button" className="login-form__back" onClick={() => setStep('forgot_phone')}>
              <MdArrowBack size={16} /> تغییر شماره موبایل
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
