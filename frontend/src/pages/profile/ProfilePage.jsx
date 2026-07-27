import { useState, useEffect } from 'react'
import {
  MdPerson, MdPhone, MdEdit, MdSave, MdLocationOn, MdAdd, MdDelete, MdCake,
  MdCheckCircle, MdInfo, MdStar, MdStarOutline, MdMale, MdFemale, MdFavorite,
  MdRestaurant, MdLock,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { authAPI } from '../../api/auth.js'
import { discountsAPI } from '../../api/discounts.js'
import { formatPrice } from '../../utils/helpers.js'
import useAuthStore from '../../store/authStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import BirthdayPicker from '../../components/common/BirthdayPicker/BirthdayPicker.jsx'
import { formatJalali, toPersianNum } from '../../utils/jalali.js'
import './ProfilePage.css'

function getBirthdayStatus(birthdayIso, dateJoinedIso) {
  if (!birthdayIso) return null
  const today = new Date()
  const joined = new Date(dateJoinedIso)
  const daysSinceJoined = Math.floor((today - joined) / 86400000)

  const bday = new Date(birthdayIso + 'T12:00:00')
  const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
  const diffDays = Math.round((thisYearBday - today) / 86400000)

  const inWindow = diffDays >= -3 && diffDays <= 3
  const notYet30 = daysSinceJoined < 30

  return { inWindow, notYet30, daysSinceJoined, diffDays, thisYearBday }
}

function BirthdaySection({ user, birthdayValue, setBirthdayValue, savingBirthday, onSave }) {
  const status = getBirthdayStatus(user.birthday, user.date_joined)
  const hasBirthday = !!user.birthday
  const [offer, setOffer] = useState(null)

  useEffect(() => {
    if (!hasBirthday) {
      discountsAPI.getBirthdayOffer().then(setOffer).catch(() => {})
    }
  }, [hasBirthday])

  return (
    <div>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MdCake size={16} color="var(--primary)" /> تاریخ تولد
      </h3>

      {hasBirthday ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <MdCake size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatJalali(user.birthday)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
              قابل تغییر نیست
            </span>
          </div>

          {status && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${status.inWindow && !status.notYet30 ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
              background: status.inWindow && !status.notYet30 ? 'var(--success-bg)' : 'var(--bg-secondary)',
              fontSize: '0.82rem',
              color: status.inWindow && !status.notYet30 ? 'var(--success)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {status.notYet30 ? (
                <><MdInfo size={14} /> تخفیف تولد پس از ۳۰ روز از عضویت فعال می‌شود ({30 - status.daysSinceJoined} روز مانده)</>
              ) : status.inWindow ? (
                <><MdCheckCircle size={14} /> تخفیف تولد شما فعال است! از کد <strong>tavalod</strong> هنگام سفارش استفاده کنید</>
              ) : status.diffDays > 3 ? (
                <><MdCake size={14} /> {toPersianNum(status.diffDays)} روز تا بازه تخفیف تولد شما</>
              ) : (
                <><MdInfo size={14} /> بازه تخفیف تولد امسال به پایان رسید</>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {offer?.available ? (
            <div className="birthday-offer-banner">
              <div className="birthday-offer-banner__icon">🎂</div>
              <div className="birthday-offer-banner__body">
                <div className="birthday-offer-banner__value">
                  {offer.discount_type === 'percentage'
                    ? `${toPersianNum(offer.value)}٪ تخفیف ویژه تولد!`
                    : `${formatPrice(offer.value)} تومان تخفیف تولد!`}
                </div>
                <p className="birthday-offer-banner__desc">
                  هر سال در بازه روز تولدت از این تخفیف استثنایی بهره‌مند می‌شوی
                  {offer.min_order_amount > 0 ? ` • حداقل سفارش ${formatPrice(offer.min_order_amount)} تومان` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              با ثبت تاریخ تولد، هر سال یک تخفیف ویژه تولد دریافت کنید.
            </p>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            این اطلاعات پس از ثبت قابل تغییر نیست.
          </p>
          <BirthdayPicker
            label="تاریخ تولد"
            value={birthdayValue}
            onChange={setBirthdayValue}
          />
          {birthdayValue && (
            <Button size="sm" loading={savingBirthday} onClick={onSave}>
              <MdSave size={14} /> ثبت تاریخ تولد
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_PASSWORD_FORM = { current_password: '', password: '', password_confirm: '' }

function PasswordSection({ hasPassword }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  async function handleSave() {
    if (hasPassword && !form.current_password) {
      toast.error('رمز عبور فعلی را وارد کنید')
      return
    }
    if (!form.password || form.password.length < 8) {
      toast.error('رمز عبور جدید باید حداقل ۸ کاراکتر باشد')
      return
    }
    if (form.password !== form.password_confirm) {
      toast.error('رمز عبور جدید با تکرار آن مطابقت ندارد')
      return
    }
    setSaving(true)
    try {
      await authAPI.changePassword(form.current_password, form.password, form.password_confirm)
      toast.success('رمز عبور با موفقیت تغییر کرد')
      setForm(EMPTY_PASSWORD_FORM)
      setOpen(false)
    } catch (err) {
      const msg = err.response?.data?.detail
        || err.response?.data?.password_confirm?.[0]
        || err.response?.data?.password?.[0]
        || 'خطا در تغییر رمز عبور'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MdLock size={16} color="var(--primary)" /> رمز عبور
      </h3>

      {!open ? (
        <Button variant="secondary" fullWidth size="sm" onClick={() => setOpen(true)}>
          {hasPassword ? 'تغییر رمز عبور' : 'تنظیم رمز عبور'}
        </Button>
      ) : (
        <div className="profile-form">
          {hasPassword && (
            <Input
              label="رمز عبور فعلی"
              type="password"
              value={form.current_password}
              onChange={(e) => set('current_password', e.target.value)}
              placeholder="رمز عبور فعلی خود را وارد کنید"
              dir="ltr"
            />
          )}
          <Input
            label="رمز عبور جدید"
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="حداقل ۸ کاراکتر"
            dir="ltr"
          />
          <Input
            label="تکرار رمز عبور جدید"
            type="password"
            value={form.password_confirm}
            onChange={(e) => set('password_confirm', e.target.value)}
            placeholder="رمز عبور جدید را دوباره وارد کنید"
            dir="ltr"
          />
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <Button fullWidth loading={saving} onClick={handleSave}>
              <MdSave size={16} /> ذخیره
            </Button>
            <Button fullWidth variant="ghost" onClick={() => { setOpen(false); setForm(EMPTY_PASSWORD_FORM) }}>
              انصراف
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const EMPTY_ADDR = { title: '', province: '', city: '', street: '', detail: '', postal_code: '', is_default: false }

function AddressFormFields({ form, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <Input
        label="عنوان آدرس *"
        value={form.title}
        onChange={(e) => onChange('title', e.target.value)}
        placeholder="مثلاً: خانه، محل کار"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <Input
          label="استان (اختیاری)"
          value={form.province}
          onChange={(e) => onChange('province', e.target.value)}
          placeholder="استان"
        />
        <Input
          label="شهر *"
          value={form.city}
          onChange={(e) => onChange('city', e.target.value)}
          placeholder="شهر"
        />
      </div>
      <Input
        label="خیابان / کوچه / پلاک *"
        value={form.street}
        onChange={(e) => onChange('street', e.target.value)}
        placeholder="خیابان، کوچه، پلاک"
      />
      <Textarea
        label="جزئیات بیشتر (اختیاری)"
        value={form.detail}
        onChange={(e) => onChange('detail', e.target.value)}
        placeholder="طبقه، واحد و ..."
        rows={2}
      />
      <Input
        label="کد پستی (اختیاری)"
        value={form.postal_code}
        onChange={(e) => onChange('postal_code', e.target.value)}
        placeholder="1234567890"
        dir="ltr"
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => onChange('is_default', e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
        />
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          آدرس پیش‌فرض
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
          برای سفارشات پیک به‌صورت خودکار انتخاب می‌شود
        </span>
      </label>
    </div>
  )
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'آقا', icon: MdMale },
  { value: 'female', label: 'خانم', icon: MdFemale },
]

const MARITAL_OPTIONS = [
  { value: 'single', label: 'مجرد' },
  { value: 'married', label: 'متاهل' },
]

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="profile-toggle-group">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            className={`profile-toggle-btn ${active ? 'profile-toggle-btn--active' : ''}`}
            onClick={() => onChange(active ? '' : opt.value)}
          >
            {Icon && <Icon size={16} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addrModal, setAddrModal] = useState(false) // 'add' | 'edit' | false
  const [editingAddr, setEditingAddr] = useState(null) // address object being edited
  const [form, setForm] = useState({ full_name: '', email: '', gender: '', marital_status: '', food_interests: '' })
  const [addrForm, setAddrForm] = useState(EMPTY_ADDR)
  const [addrSaving, setAddrSaving] = useState(false)
  const [settingDefault, setSettingDefault] = useState(null)
  const [birthdayValue, setBirthdayValue] = useState('')
  const [savingBirthday, setSavingBirthday] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        gender: user.gender || '',
        marital_status: user.marital_status || '',
        food_interests: user.food_interests || '',
      })
    }
    authAPI.getAddresses()
      .then((data) => setAddresses(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {})
  }, [user])

  async function handleSaveBirthday() {
    if (!birthdayValue) { toast.error('تاریخ تولد را انتخاب کنید'); return }
    setSavingBirthday(true)
    try {
      const updated = await authAPI.updateMe({ birthday: birthdayValue })
      updateUser(updated)
      toast.success('تاریخ تولد با موفقیت ثبت شد')
      setBirthdayValue('')
    } catch (err) {
      const msg = err.response?.data?.birthday?.[0] || err.response?.data?.detail || 'خطا در ثبت تاریخ تولد'
      toast.error(msg)
    } finally {
      setSavingBirthday(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await authAPI.updateMe(form)
      updateUser(updated)
      toast.success('پروفایل با موفقیت بروزرسانی شد')
      setEditing(false)
    } catch {
      toast.error('خطا در بروزرسانی پروفایل')
    } finally {
      setSaving(false)
    }
  }

  function openAddModal() {
    setEditingAddr(null)
    setAddrForm(EMPTY_ADDR)
    setAddrModal('add')
  }

  function openEditModal(addr) {
    setEditingAddr(addr)
    setAddrForm({
      title: addr.title || '',
      province: addr.province || '',
      city: addr.city || '',
      street: addr.street || '',
      detail: addr.detail || '',
      postal_code: addr.postal_code || '',
      is_default: addr.is_default || false,
    })
    setAddrModal('edit')
  }

  function addrFieldChange(field, value) {
    setAddrForm((p) => ({ ...p, [field]: value }))
  }

  async function handleSaveAddress() {
    if (!addrForm.title || !addrForm.city || !addrForm.street) {
      toast.error('لطفاً فیلدهای اجباری را پر کنید')
      return
    }
    setAddrSaving(true)
    try {
      if (addrModal === 'edit' && editingAddr) {
        const updated = await authAPI.updateAddress(editingAddr.id, addrForm)
        // If set as default, all other addresses lose default flag on backend
        setAddresses((prev) => prev.map((a) => {
          if (a.id === editingAddr.id) return updated
          if (addrForm.is_default) return { ...a, is_default: false }
          return a
        }))
        toast.success('آدرس ویرایش شد')
      } else {
        const newAddr = await authAPI.createAddress(addrForm)
        setAddresses((prev) => {
          const list = addrForm.is_default
            ? prev.map((a) => ({ ...a, is_default: false }))
            : prev
          return [...list, newAddr]
        })
        toast.success('آدرس اضافه شد')
      }
      setAddrModal(false)
    } catch {
      toast.error('خطا در ذخیره آدرس')
    } finally {
      setAddrSaving(false)
    }
  }

  async function handleSetDefault(addr) {
    if (addr.is_default) return
    setSettingDefault(addr.id)
    try {
      await authAPI.setDefaultAddress(addr.id)
      setAddresses((prev) => prev.map((a) => ({
        ...a,
        is_default: a.id === addr.id ? true : false,
      })))
      toast.success('آدرس پیش‌فرض تنظیم شد')
    } catch {
      toast.error('خطا در تنظیم آدرس پیش‌فرض')
    } finally {
      setSettingDefault(null)
    }
  }

  async function handleDeleteAddress(id) {
    try {
      await authAPI.deleteAddress(id)
      setAddresses((prev) => prev.filter((a) => a.id !== id))
      toast.success('آدرس حذف شد')
    } catch {
      toast.error('خطا در حذف آدرس')
    }
  }

  if (!user) return <Loading />

  const displayName = user.full_name || 'کاربر'
  const initials = displayName !== 'کاربر' ? displayName[0] : (String(user.phone || '?').slice(-1))
  const genderClass = user.gender === 'male' ? 'profile-avatar--male' : user.gender === 'female' ? 'profile-avatar--female' : ''

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>پروفایل من</h1>
      </div>

      <div className="profile-layout">
        <div className="profile-card neu-card">
          <div className={`profile-avatar ${genderClass}`}>
            {user.gender === 'male' ? <MdMale size={40} /> : user.gender === 'female' ? <MdFemale size={40} /> : initials}
          </div>
          <h2 className="profile-name">{displayName}</h2>
          <p className="profile-phone">
            <MdPhone size={14} />
            {user.phone}
          </p>

          {(user.marital_status || user.food_interests) && (
            <div className="profile-tags">
              {user.marital_status && (
                <span className="profile-tag">
                  <MdFavorite size={12} />
                  {MARITAL_OPTIONS.find((m) => m.value === user.marital_status)?.label}
                </span>
              )}
              {user.food_interests && (
                <span className="profile-tag">
                  <MdRestaurant size={12} />
                  {user.food_interests}
                </span>
              )}
            </div>
          )}

          {user.is_staff && (
            <span style={{
              background: 'var(--primary-bg)',
              color: 'var(--primary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(200,169,110,0.25)',
            }}>
              مدیر سیستم
            </span>
          )}

          <div className="divider" />

          {editing ? (
            <div className="profile-form">
              <Input
                label="نام و نام خانوادگی"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="نام کامل خود را وارد کنید"
              />
              <Input
                label="ایمیل (اختیاری)"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                dir="ltr"
              />
              <div>
                <p className="profile-form__label">جنسیت (اختیاری)</p>
                <ToggleGroup
                  options={GENDER_OPTIONS}
                  value={form.gender}
                  onChange={(v) => setForm((p) => ({ ...p, gender: v }))}
                />
              </div>
              <div>
                <p className="profile-form__label">وضعیت تأهل (اختیاری)</p>
                <ToggleGroup
                  options={MARITAL_OPTIONS}
                  value={form.marital_status}
                  onChange={(v) => setForm((p) => ({ ...p, marital_status: v }))}
                />
              </div>
              <Input
                label="علایق غذایی (اختیاری)"
                value={form.food_interests}
                onChange={(e) => setForm((p) => ({ ...p, food_interests: e.target.value }))}
                placeholder="مثلاً: گیاهخواری، بدون گلوتن"
              />
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Button fullWidth loading={saving} onClick={handleSave}>
                  <MdSave size={16} /> ذخیره
                </Button>
                <Button fullWidth variant="ghost" onClick={() => setEditing(false)}>
                  انصراف
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
              <MdEdit size={16} /> ویرایش پروفایل
            </Button>
          )}

          <div className="divider" />

          <BirthdaySection
            user={user}
            birthdayValue={birthdayValue}
            setBirthdayValue={setBirthdayValue}
            savingBirthday={savingBirthday}
            onSave={handleSaveBirthday}
          />

          <div className="divider" />

          <PasswordSection hasPassword={!!user.has_password} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
            <h2 className="section-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdLocationOn color="var(--primary)" />
              آدرس‌های من
            </h2>
            <Button size="sm" variant="secondary" onClick={openAddModal}>
              <MdAdd size={16} /> افزودن آدرس
            </Button>
          </div>

          {addresses.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📍</div>
              <h3>آدرسی ثبت نشده</h3>
              <p>اولین آدرس خود را اضافه کنید</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {addresses.map((addr) => (
                <div key={addr.id} className="address-card neu-card-sm">
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {addr.title}
                      {addr.is_default && (
                        <span style={{ marginRight: 8, fontSize: '0.72rem', background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 'var(--radius-full)' }}>
                          پیش‌فرض
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {addr.province && `${addr.province} ،`}{addr.city} — {addr.street}
                    </p>
                    {addr.detail && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{addr.detail}</p>
                    )}
                    {addr.postal_code && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>
                        کد پستی: {addr.postal_code}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {!addr.is_default && (
                      <button
                        onClick={() => handleSetDefault(addr)}
                        disabled={settingDefault === addr.id}
                        title="تنظیم به عنوان پیش‌فرض"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        <MdStarOutline size={16} />
                      </button>
                    )}
                    {addr.is_default && (
                      <span style={{ padding: '6px 10px', color: 'var(--primary)' }}>
                        <MdStar size={16} />
                      </span>
                    )}
                    <button
                      onClick={() => openEditModal(addr)}
                      title="ویرایش"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      <MdEdit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      title="حذف"
                      style={{
                        background: 'var(--error-bg)',
                        border: '1px solid rgba(248,113,113,0.2)',
                        color: 'var(--error)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Address Modal */}
      <Modal
        isOpen={!!addrModal}
        onClose={() => setAddrModal(false)}
        title={addrModal === 'edit' ? 'ویرایش آدرس' : 'افزودن آدرس جدید'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddrModal(false)}>انصراف</Button>
            <Button onClick={handleSaveAddress} loading={addrSaving}>ذخیره آدرس</Button>
          </>
        }
      >
        <AddressFormFields form={addrForm} onChange={addrFieldChange} />
      </Modal>
    </div>
  )
}
