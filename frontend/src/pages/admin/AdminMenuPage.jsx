import { useState, useEffect } from 'react'
import { MdAdd, MdEdit, MdDelete } from 'react-icons/md'
import toast from 'react-hot-toast'
import { menuAPI } from '../../api/menu.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input, Textarea, Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice } from '../../utils/helpers.js'
import '../admin/AdminOrdersPage.css'

const EMPTY_FORM = {
  name: '', slug: '', description: '', price: '', discounted_price: '',
  category: '', status: 'available', is_featured: false, is_vegetarian: false,
  preparation_time: 10, calories: '',
}

export default function AdminMenuPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
    setModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      name: item.name, slug: item.slug, description: item.description || '',
      price: item.price, discounted_price: item.discounted_price || '',
      category: item.category?.id || '', status: item.status,
      is_featured: item.is_featured, is_vegetarian: item.is_vegetarian,
      preparation_time: item.preparation_time, calories: item.calories || '',
    })
    setModal(true)
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

  async function handleSave() {
    setSaving(true)
    try {
      const data = { ...form, price: Number(form.price), category: Number(form.category) }
      if (form.discounted_price) data.discounted_price = Number(form.discounted_price)
      if (form.calories) data.calories = Number(form.calories)

      if (editItem) {
        const updated = await menuAPI.adminUpdateItem(editItem.id, data)
        setItems((prev) => prev.map((i) => i.id === editItem.id ? updated : i))
        toast.success('آیتم بروزرسانی شد')
      } else {
        const created = await menuAPI.adminCreateItem(data)
        setItems((prev) => [created, ...prev])
        toast.success('آیتم اضافه شد')
      }
      setModal(false)
    } catch (err) {
      const errors = err.response?.data
      if (errors) {
        const msg = Object.values(errors).flat().join(' — ')
        toast.error(msg)
      } else {
        toast.error('خطا در ذخیره')
      }
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
    } catch {
      toast.error('خطا در حذف')
    }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>مدیریت منو</h1>
        </div>
        <Button onClick={openCreate}>
          <MdAdd size={18} /> افزودن آیتم
        </Button>
      </div>

      <div className="admin-orders__table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>دسته‌بندی</th>
              <th>قیمت</th>
              <th>وضعیت</th>
              <th>ویژه</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.name}</td>
                <td>{item.category?.name || '—'}</td>
                <td className="price">{formatPrice(item.price)}</td>
                <td>
                  <span className={`status-badge ${item.status === 'available' ? 'status-confirmed' : item.status === 'coming_soon' ? 'status-pending' : 'status-cancelled'}`}>
                    {item.status === 'available' ? 'موجود' : item.status === 'coming_soon' ? 'به زودی' : 'ناموجود'}
                  </span>
                </td>
                <td>{item.is_featured ? '⭐' : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="admin-action-btn" onClick={() => openEdit(item)}>
                      <MdEdit size={14} />
                    </button>
                    <button
                      className="admin-action-btn"
                      style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                      onClick={() => handleDelete(item.id)}
                    >
                      <MdDelete size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editItem ? 'ویرایش آیتم' : 'افزودن آیتم جدید'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>انصراف</Button>
            <Button onClick={handleSave} loading={saving}>ذخیره</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <Input label="نام آیتم" name="name" value={form.name} onChange={(e) => autoSlug(e.target.value)} required />
          </div>
          <Input label="اسلاگ (URL)" name="slug" value={form.slug} onChange={handleChange} dir="ltr" />
          <Select label="دسته‌بندی" name="category" value={form.category} onChange={handleChange}>
            <option value="">انتخاب دسته‌بندی</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="قیمت (تومان)" name="price" type="number" value={form.price} onChange={handleChange} required />
          <Input label="قیمت با تخفیف (اختیاری)" name="discounted_price" type="number" value={form.discounted_price} onChange={handleChange} />
          <Select label="وضعیت" name="status" value={form.status} onChange={handleChange}>
            <option value="available">موجود</option>
            <option value="unavailable">ناموجود</option>
            <option value="coming_soon">به زودی</option>
          </Select>
          <Input label="زمان آماده‌سازی (دقیقه)" name="preparation_time" type="number" value={form.preparation_time} onChange={handleChange} />
          <Input label="کالری (اختیاری)" name="calories" type="number" value={form.calories} onChange={handleChange} />
          <div style={{ gridColumn: '1/-1' }}>
            <Textarea label="توضیحات" name="description" value={form.description} onChange={handleChange} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange} />
              ⭐ ویژه
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <input type="checkbox" name="is_vegetarian" checked={form.is_vegetarian} onChange={handleChange} />
              🌱 گیاهی
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
