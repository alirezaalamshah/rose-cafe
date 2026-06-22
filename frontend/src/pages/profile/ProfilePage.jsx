import { useState, useEffect } from 'react'
import { MdPerson, MdPhone, MdEdit, MdSave, MdLocationOn, MdAdd } from 'react-icons/md'
import toast from 'react-hot-toast'
import { authAPI } from '../../api/auth.js'
import useAuthStore from '../../store/authStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import './ProfilePage.css'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addrModal, setAddrModal] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' })
  const [addrForm, setAddrForm] = useState({ title: '', address: '', city: '', postal_code: '' })

  useEffect(() => {
    if (user) {
      setForm({ first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '' })
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
    try {
      const newAddr = await authAPI.createAddress(addrForm)
      setAddresses((prev) => [...prev, newAddr])
      toast.success('آدرس اضافه شد')
      setAddrModal(false)
      setAddrForm({ title: '', address: '', city: '', postal_code: '' })
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

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>پروفایل من</h1>
      </div>

      <div className="profile-layout">
        {/* Profile Card */}
        <div className="profile-card neu-card">
          <div className="profile-avatar">
            {user.first_name?.[0] || user.phone?.[0] || '?'}
          </div>
          <h2 className="profile-name">
            {user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`
              : 'کاربر'}
          </h2>
          <p className="profile-phone">
            <MdPhone size={14} />
            {user.phone}
          </p>

          <div className="divider" />

          {editing ? (
            <div className="profile-form">
              <Input
                label="نام"
                value={form.first_name}
                onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                placeholder="نام"
              />
              <Input
                label="نام خانوادگی"
                value={form.last_name}
                onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                placeholder="نام خانوادگی"
              />
              <Input
                label="ایمیل"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="ایمیل (اختیاری)"
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

        {/* Addresses */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
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
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {addresses.map((addr) => (
                <div key={addr.id} className="address-card neu-card-sm">
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {addr.title}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {addr.city} — {addr.address}
                    </p>
                    {addr.postal_code && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        کد پستی: {addr.postal_code}
                      </p>
                    )}
                  </div>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteAddress(addr.id)}>
                    حذف
                  </Button>
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
            label="عنوان آدرس"
            value={addrForm.title}
            onChange={(e) => setAddrForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="مثلاً: خانه، محل کار"
          />
          <Input
            label="شهر"
            value={addrForm.city}
            onChange={(e) => setAddrForm((p) => ({ ...p, city: e.target.value }))}
            placeholder="شهر"
          />
          <Textarea
            label="آدرس کامل"
            value={addrForm.address}
            onChange={(e) => setAddrForm((p) => ({ ...p, address: e.target.value }))}
            placeholder="خیابان، کوچه، پلاک..."
            rows={3}
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
