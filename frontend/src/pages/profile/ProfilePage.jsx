import { useState, useEffect } from 'react'
import { MdPerson, MdPhone, MdEdit, MdSave, MdLocationOn, MdAdd, MdDelete } from 'react-icons/md'
import toast from 'react-hot-toast'
import { authAPI } from '../../api/auth.js'
import useAuthStore from '../../store/authStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import './ProfilePage.css'

const EMPTY_ADDR = { title: '', province: '', city: '', street: '', detail: '', postal_code: '' }

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addrModal, setAddrModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '' })
  const [addrForm, setAddrForm] = useState(EMPTY_ADDR)

  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name || '', email: user.email || '' })
    }
    authAPI.getAddresses()
      .then((data) => setAddresses(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {})
  }, [user])

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

  async function handleAddAddress() {
    if (!addrForm.title || !addrForm.city || !addrForm.street) {
      toast.error('لطفاً فیلدهای اجباری را پر کنید')
      return
    }
    try {
      const newAddr = await authAPI.createAddress(addrForm)
      setAddresses((prev) => [...prev, newAddr])
      toast.success('آدرس اضافه شد')
      setAddrModal(false)
      setAddrForm(EMPTY_ADDR)
    } catch {
      toast.error('خطا در افزودن آدرس')
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

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>پروفایل من</h1>
      </div>

      <div className="profile-layout">
        <div className="profile-card neu-card">
          <div className="profile-avatar">{initials}</div>
          <h2 className="profile-name">{displayName}</h2>
          <p className="profile-phone">
            <MdPhone size={14} />
            {user.phone}
          </p>

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
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
            <h2 className="section-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdLocationOn color="var(--primary)" />
              آدرس‌های من
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setAddrModal(true)}>
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
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    style={{
                      background: 'var(--error-bg)',
                      border: '1px solid rgba(248,113,113,0.2)',
                      color: 'var(--error)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <MdDelete size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={addrModal}
        onClose={() => setAddrModal(false)}
        title="افزودن آدرس جدید"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddrModal(false)}>انصراف</Button>
            <Button onClick={handleAddAddress}>ذخیره آدرس</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Input
            label="عنوان آدرس *"
            value={addrForm.title}
            onChange={(e) => setAddrForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="مثلاً: خانه، محل کار"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input
              label="استان (اختیاری)"
              value={addrForm.province}
              onChange={(e) => setAddrForm((p) => ({ ...p, province: e.target.value }))}
              placeholder="استان"
            />
            <Input
              label="شهر *"
              value={addrForm.city}
              onChange={(e) => setAddrForm((p) => ({ ...p, city: e.target.value }))}
              placeholder="شهر"
            />
          </div>
          <Input
            label="خیابان / کوچه / پلاک *"
            value={addrForm.street}
            onChange={(e) => setAddrForm((p) => ({ ...p, street: e.target.value }))}
            placeholder="خیابان، کوچه، پلاک"
          />
          <Textarea
            label="جزئیات بیشتر (اختیاری)"
            value={addrForm.detail}
            onChange={(e) => setAddrForm((p) => ({ ...p, detail: e.target.value }))}
            placeholder="طبقه، واحد و ..."
            rows={2}
          />
          <Input
            label="کد پستی (اختیاری)"
            value={addrForm.postal_code}
            onChange={(e) => setAddrForm((p) => ({ ...p, postal_code: e.target.value }))}
            placeholder="1234567890"
            dir="ltr"
          />
        </div>
      </Modal>
    </div>
  )
}
