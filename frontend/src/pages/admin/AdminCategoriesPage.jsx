import { useState, useEffect } from 'react'
import { MdAdd, MdEdit, MdDelete } from 'react-icons/md'
import toast from 'react-hot-toast'
import { menuAPI } from '../../api/menu.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import './AdminOrdersPage.css'

const EMPTY = { name: '', slug: '', icon: '', description: '', order: 0, is_active: true }

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    menuAPI.adminGetCategories()
      .then((data) => setCats(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() { setEditItem(null); setForm(EMPTY); setModal(true) }

  function openEdit(cat) {
    setEditItem(cat)
    setForm({ name: cat.name, slug: cat.slug, icon: cat.icon || '', description: cat.description || '', order: cat.order, is_active: cat.is_active })
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
    if (!form.name) { toast.error('نام دسته‌بندی الزامی است'); return }
    setSaving(true)
    try {
      const data = { ...form, order: Number(form.order) || 0 }
      if (editItem) {
        const updated = await menuAPI.adminUpdateCategory(editItem.id, data)
        setCats((prev) => prev.map((c) => c.id === editItem.id ? updated : c))
        toast.success('دسته‌بندی بروزرسانی شد')
      } else {
        const created = await menuAPI.adminCreateCategory(data)
        setCats((prev) => [...prev, created])
        toast.success('دسته‌بندی اضافه شد')
      }
      setModal(false)
    } catch (err) {
      const errors = err.response?.data
      toast.error(errors ? Object.values(errors).flat().join(' — ') : 'خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('حذف این دسته‌بندی؟ آیتم‌های منو این دسته حذف نمی‌شوند.')) return
    try {
      await menuAPI.adminDeleteCategory(id)
      setCats((prev) => prev.filter((c) => c.id !== id))
      toast.success('دسته‌بندی حذف شد')
    } catch {
      toast.error('خطا در حذف — ممکن است آیتم‌هایی به این دسته وابسته باشند')
    }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>دسته‌بندی‌های منو</h1>
        </div>
        <Button onClick={openCreate}><MdAdd size={18} /> افزودن دسته‌بندی</Button>
      </div>

      <div className="admin-orders__table-wrap">
        {cats.length === 0 ? (
          <div className="empty-state"><div className="icon">📂</div><h3>دسته‌بندی‌ای ثبت نشده</h3></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>آیکون</th>
                <th>نام</th>
                <th>اسلاگ</th>
                <th>ترتیب</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontSize: '1.4rem' }}>{cat.icon || '🍽️'}</td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cat.name}</td>
                  <td style={{ direction: 'ltr', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{cat.slug}</td>
                  <td>{cat.order}</td>
                  <td>
                    <span className={`status-badge ${cat.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
                      {cat.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="admin-action-btn" onClick={() => openEdit(cat)}>
                        <MdEdit size={14} />
                      </button>
                      <button
                        className="admin-action-btn"
                        style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                        onClick={() => handleDelete(cat.id)}
                      >
                        <MdDelete size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editItem ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>انصراف</Button>
            <Button onClick={handleSave} loading={saving}>ذخیره</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-md)', alignItems: 'end' }}>
            <Input label="نام دسته‌بندی *" name="name" value={form.name} onChange={(e) => autoSlug(e.target.value)} />
            <Input label="آیکون (ایموجی)" name="icon" value={form.icon} onChange={handleChange} style={{ width: 80, textAlign: 'center', fontSize: '1.3rem' }} />
          </div>
          <Input label="اسلاگ (URL)" name="slug" value={form.slug} onChange={handleChange} dir="ltr" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input label="ترتیب نمایش" name="order" type="number" value={form.order} onChange={handleChange} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                فعال
              </label>
            </div>
          </div>
          <Textarea label="توضیحات (اختیاری)" name="description" value={form.description} onChange={handleChange} rows={2} />
        </div>
      </Modal>
    </div>
  )
}
