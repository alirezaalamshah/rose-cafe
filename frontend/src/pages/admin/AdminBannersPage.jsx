import { useState, useEffect, useRef } from 'react'
import { MdAdd, MdEdit, MdDelete, MdImage, MdClose, MdToggleOn, MdToggleOff, MdEvent } from 'react-icons/md'
import toast from 'react-hot-toast'
import { businessAPI } from '../../api/business.js'
import { confirm } from '../../store/confirmStore.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input } from '../../components/common/Input/Input.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import FocalPointPicker from '../../components/common/FocalPointPicker/FocalPointPicker.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { getMediaUrl, formatDate } from '../../utils/helpers.js'
import './AdminOrdersPage.css'
import './AdminMenuPage.css'
import './AdminBannersPage.css'

const EMPTY_FORM = {
  title: '', link: '', start_date: '', end_date: '',
  order: 0, is_active: true, focal_x: 50, focal_y: 50,
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    businessAPI.adminGetBanners()
      .then((data) => setBanners(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setModal(true)
  }

  function openEdit(banner) {
    setEditItem(banner)
    setForm({
      title: banner.title || '',
      link: banner.link || '',
      start_date: banner.start_date || '',
      end_date: banner.end_date || '',
      order: banner.order,
      is_active: banner.is_active,
      focal_x: banner.focal_x,
      focal_y: banner.focal_y,
    })
    setImageFile(null)
    setImagePreview(banner.image ? getMediaUrl(banner.image) : null)
    setModal(true)
  }

  function closeModal() {
    setModal(false)
    setImageFile(null)
    setImagePreview(null)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('حجم تصویر نباید بیشتر از ۵ مگابایت باشد'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setForm((p) => ({ ...p, focal_x: 50, focal_y: 50 }))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    if (!editItem && !imageFile) { toast.error('انتخاب تصویر الزامی است'); return }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      toast.error('تاریخ پایان باید بعد از تاریخ شروع باشد'); return
    }
    setSaving(true)
    try {
      let payload
      if (imageFile) {
        payload = new FormData()
        payload.append('title', form.title)
        payload.append('link', form.link)
        if (form.start_date) payload.append('start_date', form.start_date)
        if (form.end_date) payload.append('end_date', form.end_date)
        payload.append('order', Number(form.order) || 0)
        payload.append('is_active', form.is_active)
        payload.append('focal_x', form.focal_x)
        payload.append('focal_y', form.focal_y)
        payload.append('image', imageFile)
      } else {
        payload = {
          ...form,
          order: Number(form.order) || 0,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        }
      }

      if (editItem) {
        const updated = await businessAPI.adminUpdateBanner(editItem.id, payload)
        setBanners((prev) => prev.map((b) => b.id === editItem.id ? updated : b))
        toast.success('بنر بروزرسانی شد')
      } else {
        const created = await businessAPI.adminCreateBanner(payload)
        setBanners((prev) => [...prev, created])
        toast.success('بنر اضافه شد')
      }
      closeModal()
    } catch (err) {
      const errors = err.response?.data
      toast.error(errors ? Object.values(errors).flat().join(' — ') : 'خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(banner) {
    setToggling(banner.id)
    try {
      const updated = await businessAPI.adminUpdateBanner(banner.id, { is_active: !banner.is_active })
      setBanners((prev) => prev.map((b) => b.id === banner.id ? updated : b))
      toast.success(updated.is_active ? 'بنر فعال شد' : 'بنر غیرفعال شد')
    } catch {
      toast.error('خطا در تغییر وضعیت')
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(id) {
    if (!(await confirm('آیا از حذف این بنر مطمئن هستید؟', { title: 'حذف بنر' }))) return
    try {
      await businessAPI.adminDeleteBanner(id)
      setBanners((prev) => prev.filter((b) => b.id !== id))
      toast.success('بنر حذف شد')
    } catch {
      toast.error('خطا در حذف')
    }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="admin-page-head">
        <div className="page-header">
          <h1>بنرهای تبلیغاتی</h1>
          <p>{banners.length} بنر — نمایش به‌شکل اسلایدر بالای صفحه‌ی منو</p>
        </div>
        <Button onClick={openCreate}><MdAdd size={18} /> افزودن بنر</Button>
      </div>

      {banners.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🖼️</div>
          <h3>هنوز بنری ثبت نشده</h3>
        </div>
      ) : (
        <div className="banner-grid">
          {banners.map((banner) => (
            <div key={banner.id} className={`banner-card neu-card-sm ${!banner.is_active ? 'banner-card--inactive' : ''}`}>
              <div className="banner-card__image">
                {banner.image ? (
                  <img
                    src={getMediaUrl(banner.image)}
                    alt={banner.title || 'بنر'}
                    style={{ objectPosition: `${banner.focal_x}% ${banner.focal_y}%` }}
                  />
                ) : (
                  <div className="menu-thumb-placeholder" style={{ width: '100%', height: '100%' }}><MdImage size={24} /></div>
                )}
                <span className={`status-badge banner-card__status ${banner.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
                  {banner.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <div className="banner-card__body">
                <p className="banner-card__title">{banner.title || '—'}</p>
                {(banner.start_date || banner.end_date) && (
                  <p className="banner-card__dates">
                    <MdEvent size={13} />
                    {banner.start_date ? formatDate(banner.start_date) : 'از ابتدا'}
                    {' – '}
                    {banner.end_date ? formatDate(banner.end_date) : 'بدون پایان'}
                  </p>
                )}
              </div>
              <div className="banner-card__actions">
                <button
                  className="admin-action-btn"
                  style={{ flex: 1 }}
                  onClick={() => handleToggle(banner)}
                  disabled={toggling === banner.id}
                >
                  {toggling === banner.id ? '...' : banner.is_active ? <><MdToggleOff size={15} /> غیرفعال</> : <><MdToggleOn size={15} /> فعال کردن</>}
                </button>
                <button className="admin-action-btn" onClick={() => openEdit(banner)}><MdEdit size={14} /></button>
                <button
                  className="admin-action-btn"
                  style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                  onClick={() => handleDelete(banner.id)}
                >
                  <MdDelete size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modal}
        onClose={closeModal}
        title={editItem ? 'ویرایش بنر' : 'افزودن بنر جدید'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>انصراف</Button>
            <Button onClick={handleSave} loading={saving}>ذخیره</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>تصویر بنر *</label>
            {imagePreview ? (
              <>
                <FocalPointPicker
                  imageUrl={imagePreview}
                  focalX={form.focal_x}
                  focalY={form.focal_y}
                  onChange={(x, y) => setForm((p) => ({ ...p, focal_x: x, focal_y: y }))}
                />
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 8 }}>
                  <button type="button" className="img-change-link" onClick={() => fileInputRef.current?.click()}>
                    تغییر تصویر
                  </button>
                  <button type="button" className="img-change-link" style={{ color: 'var(--error)' }} onClick={removeImage}>
                    حذف تصویر
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </div>
              </>
            ) : (
              <label className="upload-label-hidden img-upload-zone">
                <MdImage size={28} />
                <span>برای آپلود تصویر بنر کلیک کنید</span>
                <small>ترجیحاً عکس افقی (لنداسکیپ) — حداکثر ۵ مگابایت</small>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} />
              </label>
            )}
          </div>

          <Input label="عنوان (اختیاری)" name="title" value={form.title} onChange={handleChange} placeholder="مثلاً: پخش زنده فوتبال" />
          <Input label="لینک (اختیاری)" name="link" value={form.link} onChange={handleChange} dir="ltr" placeholder="https://..." />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <PersianDatePicker
              label="تاریخ شروع نمایش (اختیاری)"
              value={form.start_date}
              onChange={(iso) => setForm((p) => ({ ...p, start_date: iso }))}
              placeholder="از همین الان"
            />
            <PersianDatePicker
              label="تاریخ پایان نمایش (اختیاری)"
              value={form.end_date}
              onChange={(iso) => setForm((p) => ({ ...p, end_date: iso }))}
              placeholder="بدون پایان"
              min={form.start_date || undefined}
            />
          </div>

          <Input label="ترتیب نمایش" name="order" type="number" value={form.order} onChange={handleChange} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            بنر فعال
          </label>
        </div>
      </Modal>
    </div>
  )
}
