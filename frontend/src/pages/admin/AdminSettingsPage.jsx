import { useState, useEffect } from 'react'
import {
  MdLocalShipping, MdSave, MdStore,
  MdPhone, MdLocationOn, MdTableBar,
  MdShare, MdAdd, MdEdit, MdDelete, MdCheck, MdClose,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { businessAPI } from '../../api/business.js'
import { confirm } from '../../store/confirmStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea, Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import './AdminSettingsPage.css'

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'اینستاگرام' },
  { value: 'telegram', label: 'تلگرام' },
  { value: 'whatsapp', label: 'واتساپ' },
  { value: 'twitter', label: 'ایکس (توییتر)' },
  { value: 'linkedin', label: 'لینکدین' },
  { value: 'youtube', label: 'یوتیوب' },
  { value: 'tiktok', label: 'تیک‌تاک' },
  { value: 'website', label: 'وب‌سایت / سایر' },
]

function SettingsSection({ icon: Icon, title, hint, children }) {
  return (
    <div className="settings-section neu-card">
      <div className="settings-section__header">
        <span className="settings-section__title">
          <Icon size={17} className="settings-section__icon" />
          {title}
        </span>
        {hint && <span className="settings-section__hint">{hint}</span>}
      </div>
      <div className="settings-section__body">{children}</div>
    </div>
  )
}

function CafeInfoSection() {
  const [form, setForm] = useState({ name: '', tagline: '', phone: '', address: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    businessAPI.adminGetCafeInfo()
      .then((data) => setForm({
        name: data.name ?? '',
        tagline: data.tagline ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
      }))
      .catch(() => toast.error('خطا در بارگذاری اطلاعات کافه'))
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('نام کافه الزامی است')
      return
    }
    setSaving(true)
    try {
      await businessAPI.adminUpdateCafeInfo(form)
      toast.success('اطلاعات کافه ذخیره شد')
    } catch {
      toast.error('خطا در ذخیره اطلاعات')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="settings-section__loading"><Loading /></div>

  return (
    <SettingsSection
      icon={MdStore}
      title="اطلاعات کافه"
      hint="این اطلاعات در صفحات عمومی سایت نمایش داده می‌شود"
    >
      <div className="settings-grid settings-grid--2">
        <Input
          label="نام کافه *"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="مثلاً: رز کافه"
        />
        <Input
          label="شعار کافه"
          value={form.tagline}
          onChange={(e) => set('tagline', e.target.value)}
          placeholder="مثلاً: لحظه‌های گرم در کنار ما"
        />
        <Input
          label="شماره تماس"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="مثلاً: ۰۲۱-۱۲۳۴۵۶۷۸"
          iconLeft={<MdPhone size={16} />}
          dir="ltr"
        />
      </div>
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <Textarea
          label="آدرس کافه"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="آدرس کامل کافه را وارد کنید..."
          rows={3}
          iconLeft={<MdLocationOn size={16} />}
        />
      </div>
      <div className="settings-section__actions">
        <Button size="sm" loading={saving} onClick={handleSave}>
          <MdSave size={14} /> ذخیره اطلاعات کافه
        </Button>
      </div>
    </SettingsSection>
  )
}

function SocialLinksSection() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newLink, setNewLink] = useState(null) // null = مخفی، {} = فرم نمایان
  const [editingLink, setEditingLink] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    businessAPI.adminGetSocialLinks()
      .then((data) => setLinks(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => toast.error('خطا در بارگذاری شبکه‌های اجتماعی'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!newLink?.account?.trim()) { toast.error('آیدی/اکانت را وارد کنید'); return }
    setSaving(true)
    try {
      const created = await businessAPI.adminCreateSocialLink({
        platform: newLink.platform || 'instagram',
        account: newLink.account.trim(),
        is_active: true,
      })
      setLinks((p) => [...p, created])
      setNewLink(null)
      toast.success('شبکه اجتماعی اضافه شد')
    } catch { toast.error('خطا در افزودن') }
    finally { setSaving(false) }
  }

  async function handleSaveEdit(l) {
    if (!l.account?.trim()) { toast.error('آیدی/اکانت را وارد کنید'); return }
    setSaving(l.id)
    try {
      const updated = await businessAPI.adminUpdateSocialLink(l.id, {
        platform: l.platform, account: l.account.trim(), is_active: l.is_active,
      })
      setLinks((prev) => prev.map((x) => x.id === l.id ? updated : x))
      setEditingLink(null)
      toast.success('بروزرسانی شد')
    } catch { toast.error('خطا در بروزرسانی') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!(await confirm('این شبکه اجتماعی حذف شود؟', { title: 'حذف شبکه اجتماعی' }))) return
    try {
      await businessAPI.adminDeleteSocialLink(id)
      setLinks((prev) => prev.filter((x) => x.id !== id))
      toast.success('حذف شد')
    } catch { toast.error('خطا در حذف') }
  }

  if (loading) return <div className="settings-section__loading"><Loading /></div>

  return (
    <SettingsSection
      icon={MdShare}
      title="شبکه‌های اجتماعی"
      hint="در فوتر سایت نمایش داده می‌شود — هر تعداد اکانت از هر پلتفرم مجاز است"
    >
      {links.length > 0 && (
        <div className="social-links-list">
          {links.map((l) => (
            <div key={l.id} className="social-link-row">
              {editingLink?.id === l.id ? (
                <>
                  <Select
                    value={editingLink.platform}
                    onChange={(e) => setEditingLink((p) => ({ ...p, platform: e.target.value }))}
                    style={{ width: 160 }}
                  >
                    {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                  <input
                    className="social-link-input"
                    value={editingLink.account}
                    onChange={(e) => setEditingLink((p) => ({ ...p, account: e.target.value }))}
                    dir="ltr"
                  />
                  <label className="social-link-toggle">
                    <input
                      type="checkbox"
                      checked={editingLink.is_active}
                      onChange={(e) => setEditingLink((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    فعال
                  </label>
                  <button className="admin-action-btn" disabled={saving === l.id} onClick={() => handleSaveEdit(editingLink)} title="ذخیره">
                    <MdCheck size={14} />
                  </button>
                  <button className="admin-action-btn" onClick={() => setEditingLink(null)} title="انصراف">
                    <MdClose size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="social-link-platform">{PLATFORM_OPTIONS.find((o) => o.value === l.platform)?.label || l.platform}</span>
                  <span className="social-link-account" dir="ltr">{l.account}</span>
                  <span className={`status-badge ${l.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
                    {l.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                  <button className="admin-action-btn" onClick={() => setEditingLink({ ...l })} title="ویرایش">
                    <MdEdit size={13} />
                  </button>
                  <button
                    className="admin-action-btn"
                    style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                    onClick={() => handleDelete(l.id)}
                    title="حذف"
                  >
                    <MdDelete size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {newLink !== null ? (
        <div className="social-link-row social-link-row--new">
          <Select
            value={newLink.platform}
            onChange={(e) => setNewLink((p) => ({ ...p, platform: e.target.value }))}
            style={{ width: 160 }}
          >
            {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <input
            className="social-link-input"
            placeholder="آیدی/اکانت * (برای وب‌سایت، آدرس کامل)"
            value={newLink.account}
            onChange={(e) => setNewLink((p) => ({ ...p, account: e.target.value }))}
            dir="ltr"
            autoFocus
          />
          <button className="admin-action-btn" disabled={saving} onClick={handleAdd} title="ذخیره">
            {saving ? '...' : <MdCheck size={14} />}
          </button>
          <button className="admin-action-btn" onClick={() => setNewLink(null)} title="انصراف">
            <MdClose size={14} />
          </button>
        </div>
      ) : (
        <button className="social-link-add-btn" onClick={() => setNewLink({ platform: 'instagram', account: '' })}>
          <MdAdd size={15} /> افزودن شبکه اجتماعی
        </button>
      )}
    </SettingsSection>
  )
}

function DeliverySection() {
  const [form, setForm] = useState({
    delivery_cost: '', free_delivery_threshold: '',
    takeaway_packaging_cost: '', delivery_packaging_cost: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    businessAPI.adminGetDeliverySettings()
      .then((data) => setForm({
        delivery_cost: data.delivery_cost ?? '',
        free_delivery_threshold: data.free_delivery_threshold ?? '',
        takeaway_packaging_cost: data.takeaway_packaging_cost ?? 0,
        delivery_packaging_cost: data.delivery_packaging_cost ?? 0,
      }))
      .catch(() => toast.error('خطا در بارگذاری تنظیمات ارسال'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!form.delivery_cost && form.delivery_cost !== 0) {
      toast.error('هزینه ارسال الزامی است')
      return
    }
    setSaving(true)
    try {
      await businessAPI.adminUpdateDeliverySettings({
        delivery_cost: Number(form.delivery_cost),
        free_delivery_threshold: form.free_delivery_threshold !== '' ? Number(form.free_delivery_threshold) : null,
        takeaway_packaging_cost: Number(form.takeaway_packaging_cost) || 0,
        delivery_packaging_cost: Number(form.delivery_packaging_cost) || 0,
      })
      toast.success('تنظیمات ارسال ذخیره شد')
    } catch {
      toast.error('خطا در ذخیره تنظیمات')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="settings-section__loading"><Loading /></div>

  return (
    <SettingsSection
      icon={MdLocalShipping}
      title="تنظیمات ارسال و بسته‌بندی"
      hint="هزینه ارسال برای سفارشات پیک، و هزینه بسته‌بندی برای سفارشات بیرون‌بر و ارسالی اعمال می‌شود"
    >
      <div className="settings-grid settings-grid--2">
        <Input
          label="هزینه ارسال با پیک (تومان) *"
          type="number"
          min="0"
          value={form.delivery_cost}
          onChange={(e) => setForm((p) => ({ ...p, delivery_cost: e.target.value }))}
          placeholder="مثلاً: 35000"
          dir="ltr"
        />
        <Input
          label="حداقل مبلغ برای ارسال رایگان (تومان)"
          type="number"
          min="0"
          value={form.free_delivery_threshold}
          onChange={(e) => setForm((p) => ({ ...p, free_delivery_threshold: e.target.value }))}
          placeholder="خالی = همیشه هزینه دارد"
          dir="ltr"
        />
        <Input
          label="هزینه بسته‌بندی سفارش بیرون‌بر (تومان)"
          type="number"
          min="0"
          value={form.takeaway_packaging_cost}
          onChange={(e) => setForm((p) => ({ ...p, takeaway_packaging_cost: e.target.value }))}
          placeholder="خالی = بدون هزینه"
          dir="ltr"
        />
        <Input
          label="هزینه بسته‌بندی سفارش ارسالی (تومان)"
          type="number"
          min="0"
          value={form.delivery_packaging_cost}
          onChange={(e) => setForm((p) => ({ ...p, delivery_packaging_cost: e.target.value }))}
          placeholder="خالی = بدون هزینه"
          dir="ltr"
        />
      </div>
      {form.free_delivery_threshold && (
        <p className="settings-section__info">
          سفارش‌هایی بیش از {Number(form.free_delivery_threshold).toLocaleString('fa-IR')} تومان ارسال رایگان دارند
        </p>
      )}
      <div className="settings-section__actions">
        <Button size="sm" loading={saving} onClick={handleSave}>
          <MdSave size={14} /> ذخیره تنظیمات
        </Button>
      </div>
    </SettingsSection>
  )
}

function ReservationSection() {
  const [form, setForm] = useState({ max_reservation_hours: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    businessAPI.adminGetReservationSettings()
      .then((data) => setForm({ max_reservation_hours: data.max_reservation_hours ?? 3 }))
      .catch(() => toast.error('خطا در بارگذاری تنظیمات رزرو'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    const val = Number(form.max_reservation_hours)
    if (!val || val < 1) {
      toast.error('حداکثر ساعت رزرو باید عدد مثبت باشد')
      return
    }
    setSaving(true)
    try {
      await businessAPI.adminUpdateReservationSettings({ max_reservation_hours: val })
      toast.success('تنظیمات رزرو ذخیره شد')
    } catch {
      toast.error('خطا در ذخیره تنظیمات')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="settings-section__loading"><Loading /></div>

  return (
    <SettingsSection
      icon={MdTableBar}
      title="تنظیمات رزرو میز"
      hint="محدودیت‌های رزرو میز توسط مشتریان"
    >
      <div className="settings-grid settings-grid--2">
        <div>
          <Input
            label="حداکثر ساعت رزرو میز *"
            type="number"
            min="1"
            max="24"
            value={form.max_reservation_hours}
            onChange={(e) => setForm({ max_reservation_hours: e.target.value })}
            dir="ltr"
          />
          <p className="settings-section__info" style={{ marginTop: 'var(--space-sm)' }}>
            مشتریان می‌توانند تا حداکثر این تعداد ساعت میز رزرو کنند.
            برای ساعت بیشتر باید با مدیریت هماهنگ کنند.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', padding: 'var(--space-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>قوانین رزرو:</strong>
          <span>— هر کاربر در هر روز فقط یک رزرو می‌تواند داشته باشد</span>
          <span>— برای امروز، حداقل یک ساعت آینده قابل رزرو است</span>
          <span>— تنظیم ساعت بالا بر همه رزروهای جدید اعمال می‌شود</span>
        </div>
      </div>
      <div className="settings-section__actions">
        <Button size="sm" loading={saving} onClick={handleSave}>
          <MdSave size={14} /> ذخیره تنظیمات رزرو
        </Button>
      </div>
    </SettingsSection>
  )
}

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <h1>تنظیمات سایت</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
          تنظیمات کلی کافه را از اینجا مدیریت کنید
        </p>
      </div>

      <div className="settings-page">
        <CafeInfoSection />
        <SocialLinksSection />
        <DeliverySection />
        <ReservationSection />
      </div>
    </div>
  )
}
