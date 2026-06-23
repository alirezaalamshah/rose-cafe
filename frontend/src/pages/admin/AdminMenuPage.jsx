import { useState, useEffect, useRef } from 'react'
import { MdAdd, MdEdit, MdDelete, MdImage, MdClose, MdTune, MdCheck } from 'react-icons/md'
import toast from 'react-hot-toast'
import { menuAPI } from '../../api/menu.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input, Textarea, Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, getMediaUrl } from '../../utils/helpers.js'
import './AdminMenuPage.css'

const EMPTY_FORM = {
  name: '', slug: '', description: '', price: '', discounted_price: '',
  category: '', status: 'available', is_featured: false, is_vegetarian: false,
  preparation_time: 10, calories: '',
}
const EMPTY_VARIANT = { name: '', price: '', discounted_price: '', is_available: true }

export default function AdminMenuPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  // Variants state
  const [variants, setVariants] = useState([])
  const [newVariant, setNewVariant] = useState(null) // null = hidden, {} = form visible
  const [savingVariant, setSavingVariant] = useState(false)
  const [editingVariant, setEditingVariant] = useState(null) // {id, name, price, ...}

  useEffect(() => {
    Promise.all([menuAPI.adminGetItems(), menuAPI.adminGetCategories()])
      .then(([itemData, catData]) => {
        setItems(Array.isArray(itemData) ? itemData : (itemData.results || []))
        setCategories(Array.isArray(catData) ? catData : (catData.results || []))
      })
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setVariants([])
    setNewVariant(null)
    setEditingVariant(null)
    setModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      name: item.name, slug: item.slug, description: item.description || '',
      price: item.price, discounted_price: item.discounted_price || '',
      category: item.category || '', status: item.status,
      is_featured: item.is_featured, is_vegetarian: item.is_vegetarian,
      preparation_time: item.preparation_time, calories: item.calories || '',
    })
    setImageFile(null)
    setImagePreview(item.image ? getMediaUrl(item.image) : null)
    setVariants(item.variants || [])
    setNewVariant(null)
    setEditingVariant(null)
    setModal(true)
  }

  function closeModal() {
    setModal(false)
    setImageFile(null)
    setImagePreview(null)
    setNewVariant(null)
    setEditingVariant(null)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  function autoSlug(name) {
    if (!editItem) {
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      setForm((p) => ({ ...p, name, slug }))
    } else {
      setForm((p) => ({ ...p, name }))
    }
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('حجم تصویر نباید بیشتر از ۵ مگابایت باشد'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    if (!form.category) { toast.error('لطفاً دسته‌بندی را انتخاب کنید'); return }
    if (!form.price || Number(form.price) <= 0) { toast.error('قیمت را به درستی وارد کنید'); return }
    setSaving(true)
    try {
      let payload
      if (imageFile) {
        payload = new FormData()
        payload.append('name', form.name)
        payload.append('slug', form.slug)
        payload.append('description', form.description || '')
        payload.append('price', Number(form.price))
        payload.append('category', Number(form.category))
        payload.append('status', form.status)
        payload.append('is_featured', form.is_featured)
        payload.append('is_vegetarian', form.is_vegetarian)
        payload.append('preparation_time', Number(form.preparation_time) || 10)
        if (form.discounted_price) payload.append('discounted_price', Number(form.discounted_price))
        if (form.calories) payload.append('calories', Number(form.calories))
        payload.append('image', imageFile)
      } else {
        payload = {
          ...form,
          price: Number(form.price),
          category: Number(form.category),
          preparation_time: Number(form.preparation_time) || 10,
          discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
          calories: form.calories ? Number(form.calories) : null,
        }
      }

      if (editItem) {
        const updated = await menuAPI.adminUpdateItem(editItem.id, payload)
        setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...updated, variants } : i))
        toast.success('آیتم بروزرسانی شد')
      } else {
        const created = await menuAPI.adminCreateItem(payload)
        setItems((prev) => [{ ...created, variants: [] }, ...prev])
        toast.success('آیتم اضافه شد — برای افزودن انواع، آیتم را ویرایش کنید')
      }
      closeModal()
    } catch (err) {
      const errors = err.response?.data
      toast.error(errors ? Object.values(errors).flat().join(' — ') : 'خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('آیا از حذف این آیتم مطمئن هستید؟')) return
    try {
      await menuAPI.adminDeleteItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast.success('آیتم حذف شد')
    } catch { toast.error('خطا در حذف') }
  }

  // --- Variant handlers ---

  async function handleAddVariant() {
    if (!newVariant?.name || !newVariant?.price) {
      toast.error('نام و قیمت نوع الزامی است')
      return
    }
    setSavingVariant(true)
    try {
      const data = {
        name: newVariant.name,
        price: Number(newVariant.price),
        discounted_price: newVariant.discounted_price ? Number(newVariant.discounted_price) : null,
        is_available: newVariant.is_available !== false,
      }
      const created = await menuAPI.adminCreateVariant(editItem.id, data)
      const updated = [...variants, created]
      setVariants(updated)
      const minPrice = Math.min(...updated.map((v) => v.price))
      setForm((p) => ({ ...p, price: minPrice }))
      setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, variants: updated, price: minPrice } : i))
      setNewVariant(null)
      toast.success('نوع اضافه شد')
    } catch { toast.error('خطا در افزودن نوع') }
    finally { setSavingVariant(false) }
  }

  async function handleSaveEditVariant(v) {
    if (!v.name || !v.price) { toast.error('نام و قیمت الزامی است'); return }
    setSavingVariant(v.id)
    try {
      const data = {
        name: v.name,
        price: Number(v.price),
        discounted_price: v.discounted_price ? Number(v.discounted_price) : null,
        is_available: v.is_available,
      }
      const updated = await menuAPI.adminUpdateVariant(editItem.id, v.id, data)
      const newVariants = variants.map((vv) => vv.id === v.id ? updated : vv)
      setVariants(newVariants)
      const minPrice = Math.min(...newVariants.map((vv) => vv.price))
      setForm((p) => ({ ...p, price: minPrice }))
      setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, variants: newVariants, price: minPrice } : i))
      setEditingVariant(null)
      toast.success('نوع بروزرسانی شد')
    } catch { toast.error('خطا در بروزرسانی') }
    finally { setSavingVariant(null) }
  }

  async function handleDeleteVariant(variantId) {
    if (!confirm('حذف این نوع؟')) return
    try {
      await menuAPI.adminDeleteVariant(editItem.id, variantId)
      const updated = variants.filter((v) => v.id !== variantId)
      setVariants(updated)
      if (updated.length > 0) {
        const minPrice = Math.min(...updated.map((v) => v.price))
        setForm((p) => ({ ...p, price: minPrice }))
        setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, variants: updated, price: minPrice } : i))
      } else {
        setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, variants: [] } : i))
      }
      toast.success('نوع حذف شد')
    } catch { toast.error('خطا در حذف') }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="menu-page-header">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>مدیریت منو</h1>
          <p>{items.length} آیتم</p>
        </div>
        <Button onClick={openCreate}>
          <MdAdd size={18} /> افزودن آیتم
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🍽️</div>
          <h3>آیتمی در منو ثبت نشده</h3>
        </div>
      ) : (
        <div className="menu-table-wrap">
          <table className="menu-table">
            <thead>
              <tr>
                <th className="col-img">تصویر</th>
                <th className="col-name">نام آیتم</th>
                <th className="col-cat">دسته‌بندی</th>
                <th className="col-price">قیمت</th>
                <th className="col-status">وضعیت</th>
                <th className="col-flag">نوع‌ها</th>
                <th className="col-action">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="col-img">
                    {item.image ? (
                      <img className="menu-thumb" src={getMediaUrl(item.image)} alt={item.name} onError={(e) => { e.target.style.display = 'none' }} />
                    ) : (
                      <div className="menu-thumb-placeholder"><MdImage size={18} /></div>
                    )}
                  </td>
                  <td className="col-name"><span>{item.name}</span></td>
                  <td className="col-cat">{item.category_name || '—'}</td>
                  <td className="col-price">
                    {item.variants?.length > 0
                      ? `از ${formatPrice(Math.min(...item.variants.map(v => v.final_price || v.price)))}`
                      : formatPrice(item.price)
                    }
                  </td>
                  <td className="col-status">
                    <span className={`status-badge ${item.status === 'available' ? 'status-confirmed' : item.status === 'coming_soon' ? 'status-pending' : 'status-cancelled'}`}>
                      {item.status === 'available' ? 'موجود' : item.status === 'coming_soon' ? 'به زودی' : 'ناموجود'}
                    </span>
                  </td>
                  <td className="col-flag">
                    {item.variants?.length > 0
                      ? <span style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}><MdTune size={13} /> {item.variants.length}</span>
                      : '—'
                    }
                  </td>
                  <td className="col-action">
                    <div className="menu-actions">
                      <button className="admin-action-btn" onClick={() => openEdit(item)} title="ویرایش"><MdEdit size={14} /></button>
                      <button className="admin-action-btn" style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }} onClick={() => handleDelete(item.id)} title="حذف"><MdDelete size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modal}
        onClose={closeModal}
        title={editItem ? 'ویرایش آیتم' : 'افزودن آیتم جدید'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>انصراف</Button>
            <Button onClick={handleSave} loading={saving}>ذخیره</Button>
          </>
        }
      >
        <div className="menu-form-grid">
          <div className="span-2">
            <Input label="نام آیتم *" name="name" value={form.name} onChange={(e) => autoSlug(e.target.value)} />
          </div>
          <Input label="اسلاگ (URL)" name="slug" value={form.slug} onChange={handleChange} dir="ltr" />
          <Select label="دسته‌بندی *" name="category" value={form.category} onChange={handleChange}>
            <option value="">انتخاب دسته‌بندی</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {variants.length > 0 ? (
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>قیمت پایه:</span> خودکار از کمترین قیمت تنظیم می‌شود ({formatPrice(Math.min(...variants.map(v => v.price)))})
            </div>
          ) : (
            <Input label="قیمت پایه (تومان) *" name="price" type="number" value={form.price} onChange={handleChange} />
          )}
          {variants.length > 0 ? (
            <div />
          ) : (
            <Input label="قیمت با تخفیف (پایه)" name="discounted_price" type="number" value={form.discounted_price} onChange={handleChange} />
          )}
          <Select label="وضعیت" name="status" value={form.status} onChange={handleChange}>
            <option value="available">موجود</option>
            <option value="unavailable">ناموجود</option>
            <option value="coming_soon">به زودی</option>
          </Select>
          <Input label="زمان آماده‌سازی (دقیقه)" name="preparation_time" type="number" value={form.preparation_time} onChange={handleChange} />
          <Input label="کالری (اختیاری)" name="calories" type="number" value={form.calories} onChange={handleChange} />
          <div className="span-2">
            <Textarea label="توضیحات" name="description" value={form.description} onChange={handleChange} rows={3} />
          </div>

          {/* Image Upload */}
          <div className="span-2">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>تصویر آیتم</label>
            {imagePreview ? (
              <div className="img-preview-wrap">
                <img className="img-preview" src={imagePreview} alt="پیش‌نمایش" />
                <button type="button" className="img-remove-btn" onClick={removeImage}><MdClose size={12} /></button>
                <label className="upload-label-hidden img-change-link">
                  تغییر تصویر
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
            ) : (
              <label className="upload-label-hidden img-upload-zone">
                <MdImage size={28} />
                <span>برای آپلود تصویر کلیک کنید</span>
                <small>PNG, JPG, WEBP — حداکثر ۵ مگابایت</small>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} />
              </label>
            )}
          </div>

          <div className="menu-checkboxes">
            <label className="menu-checkbox-label">
              <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange} />
              ⭐ ویژه
            </label>
            <label className="menu-checkbox-label">
              <input type="checkbox" name="is_vegetarian" checked={form.is_vegetarian} onChange={handleChange} />
              🌱 گیاهی
            </label>
          </div>

          {/* Variants Section — only in edit mode */}
          {editItem && (
            <div className="span-2">
              <div className="variants-section">
                <div className="variants-section__header">
                  <span className="variants-section__title">
                    <MdTune size={16} /> انواع و قیمت‌ها
                  </span>
                  <span className="variants-section__hint">قیمت‌های مختلف برای هر نوع (مثال: اسپرسو دبل، ۱۰۰٪ ربستا، ۷۰/۳۰)</span>
                </div>

                {/* Existing variants */}
                {variants.length > 0 && (
                  <div className="variants-list">
                    {variants.map((v) => (
                      <div key={v.id} className="variant-row">
                        {editingVariant?.id === v.id ? (
                          <>
                            <input
                              className="variant-input"
                              placeholder="نام نوع"
                              value={editingVariant.name}
                              onChange={(e) => setEditingVariant((p) => ({ ...p, name: e.target.value }))}
                            />
                            <input
                              className="variant-input variant-input--num"
                              type="number" placeholder="قیمت"
                              value={editingVariant.price}
                              onChange={(e) => setEditingVariant((p) => ({ ...p, price: e.target.value }))}
                            />
                            <input
                              className="variant-input variant-input--num"
                              type="number" placeholder="قیمت تخفیف"
                              value={editingVariant.discounted_price || ''}
                              onChange={(e) => setEditingVariant((p) => ({ ...p, discounted_price: e.target.value }))}
                            />
                            <label className="variant-available-label">
                              <input
                                type="checkbox"
                                checked={editingVariant.is_available}
                                onChange={(e) => setEditingVariant((p) => ({ ...p, is_available: e.target.checked }))}
                              />
                              موجود
                            </label>
                            <button
                              className="variant-action-btn variant-action-btn--save"
                              disabled={savingVariant === v.id}
                              onClick={() => handleSaveEditVariant(editingVariant)}
                              title="ذخیره"
                            >
                              <MdCheck size={14} />
                            </button>
                            <button
                              className="variant-action-btn"
                              onClick={() => setEditingVariant(null)}
                              title="انصراف"
                            >
                              <MdClose size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="variant-row__name">{v.name}</span>
                            <span className="variant-row__price">{formatPrice(v.price)}</span>
                            {v.discounted_price
                              ? <span className="variant-row__disc">{formatPrice(v.discounted_price)}</span>
                              : <span className="variant-row__disc variant-row__disc--empty">—</span>
                            }
                            <span className={`variant-row__avail ${v.is_available ? '' : 'variant-row__avail--off'}`}>
                              {v.is_available ? 'موجود' : 'ناموجود'}
                            </span>
                            <button
                              className="variant-action-btn"
                              onClick={() => setEditingVariant({ ...v })}
                              title="ویرایش"
                            >
                              <MdEdit size={13} />
                            </button>
                            <button
                              className="variant-action-btn variant-action-btn--del"
                              onClick={() => handleDeleteVariant(v.id)}
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

                {/* New variant form */}
                {newVariant !== null ? (
                  <div className="variant-row variant-row--new">
                    <input
                      className="variant-input"
                      placeholder="نام نوع *"
                      value={newVariant.name}
                      onChange={(e) => setNewVariant((p) => ({ ...p, name: e.target.value }))}
                      autoFocus
                    />
                    <input
                      className="variant-input variant-input--num"
                      type="number" placeholder="قیمت *"
                      value={newVariant.price}
                      onChange={(e) => setNewVariant((p) => ({ ...p, price: e.target.value }))}
                    />
                    <input
                      className="variant-input variant-input--num"
                      type="number" placeholder="قیمت تخفیف"
                      value={newVariant.discounted_price || ''}
                      onChange={(e) => setNewVariant((p) => ({ ...p, discounted_price: e.target.value }))}
                    />
                    <label className="variant-available-label">
                      <input
                        type="checkbox"
                        checked={newVariant.is_available !== false}
                        onChange={(e) => setNewVariant((p) => ({ ...p, is_available: e.target.checked }))}
                      />
                      موجود
                    </label>
                    <button
                      className="variant-action-btn variant-action-btn--save"
                      disabled={savingVariant}
                      onClick={handleAddVariant}
                      title="ذخیره"
                    >
                      {savingVariant ? '...' : <MdCheck size={14} />}
                    </button>
                    <button
                      className="variant-action-btn"
                      onClick={() => setNewVariant(null)}
                      title="انصراف"
                    >
                      <MdClose size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="variant-add-btn"
                    onClick={() => setNewVariant(EMPTY_VARIANT)}
                  >
                    <MdAdd size={15} /> افزودن نوع جدید
                  </button>
                )}
              </div>
            </div>
          )}

          {!editItem && (
            <div className="span-2">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderRight: '3px solid var(--primary)' }}>
                برای افزودن انواع قیمت (مثلاً ۱۰۰٪ ربستا، ۷۰/۳۰)، ابتدا آیتم را ذخیره کنید سپس آن را ویرایش نمایید.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
