import { useState, useEffect, useMemo } from 'react'
import { MdAdd, MdEdit, MdDelete, MdToggleOn, MdToggleOff, MdSearch } from 'react-icons/md'
import toast from 'react-hot-toast'
import { menuAPI } from '../../api/menu.js'
import { confirm } from '../../store/confirmStore.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import './AdminOrdersPage.css'

const EMPTY = { name: '', slug: '', icon: '', description: '', order: 0, is_active: true }

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkSaving, setBulkSaving] = useState(false)

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
    if (!(await confirm('حذف این دسته‌بندی؟ آیتم‌های منو این دسته حذف نمی‌شوند.', { title: 'حذف دسته‌بندی' }))) return
    try {
      await menuAPI.adminDeleteCategory(id)
      setCats((prev) => prev.filter((c) => c.id !== id))
      toast.success('دسته‌بندی حذف شد')
    } catch {
      toast.error('خطا در حذف — ممکن است آیتم‌هایی به این دسته وابسته باشند')
    }
  }

  const filteredCats = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cats
    return cats.filter((c) => c.name?.toLowerCase().includes(q))
  }, [cats, search])

  function toggleSelect(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const visibleIds = filteredCats.map((c) => c.id)
    setSelectedIds((prev) => visibleIds.every((id) => prev.includes(id)) ? [] : visibleIds)
  }

  async function handleBulkToggle(is_active) {
    setBulkSaving(true)
    try {
      await menuAPI.adminBulkToggleCategories(selectedIds, is_active)
      setCats((prev) => prev.map((c) => selectedIds.includes(c.id) ? { ...c, is_active } : c))
      toast.success(`${selectedIds.length} دسته‌بندی ${is_active ? 'فعال' : 'غیرفعال'} شد`)
      setSelectedIds([])
    } catch { toast.error('خطا در تغییر وضعیت گروهی') }
    finally { setBulkSaving(false) }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="admin-page-head">
        <div className="page-header">
          <h1>دسته‌بندی‌های منو</h1>
          <p>{search ? `${filteredCats.length} از ${cats.length} دسته‌بندی` : `${cats.length} دسته‌بندی`}</p>
        </div>
        <Button onClick={openCreate}><MdAdd size={18} /> افزودن دسته‌بندی</Button>
      </div>

      <div className="admin-search">
        <MdSearch size={18} className="admin-search__icon" />
        <input
          placeholder="جستجو بر اساس نام دسته‌بندی..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-toolbar">
          <span className="bulk-toolbar__count">{selectedIds.length} دسته‌بندی انتخاب شده</span>
          <div className="bulk-toolbar__actions">
            <Button variant="ghost" size="sm" disabled={bulkSaving} onClick={() => handleBulkToggle(true)}>
              <MdToggleOn size={16} /> فعال‌سازی گروهی
            </Button>
            <Button variant="ghost" size="sm" disabled={bulkSaving} onClick={() => handleBulkToggle(false)}>
              <MdToggleOff size={16} /> غیرفعال‌سازی گروهی
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>انصراف</Button>
          </div>
        </div>
      )}

      <div className="admin-orders__table-wrap">
        {cats.length === 0 ? (
          <div className="empty-state"><div className="icon">📂</div><h3>دسته‌بندی‌ای ثبت نشده</h3></div>
        ) : filteredCats.length === 0 ? (
          <div className="empty-state"><div className="icon">🔍</div><h3>دسته‌بندی‌ای با این جستجو یافت نشد</h3></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" checked={filteredCats.length > 0 && filteredCats.every((c) => selectedIds.includes(c.id))} onChange={toggleSelectAll} /></th>
                <th>آیکون</th>
                <th>نام</th>
                <th>اسلاگ</th>
                <th>ترتیب</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredCats.map((cat) => (
                <tr key={cat.id}>
                  <td data-label="انتخاب"><input type="checkbox" checked={selectedIds.includes(cat.id)} onChange={() => toggleSelect(cat.id)} /></td>
                  <td data-label="آیکون" style={{ fontSize: '1.4rem' }}>{cat.icon || '🍽️'}</td>
                  <td data-label="نام" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cat.name}</td>
                  <td data-label="اسلاگ" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}><span dir="ltr">{cat.slug}</span></td>
                  <td data-label="ترتیب">{cat.order}</td>
                  <td data-label="وضعیت">
                    <span className={`status-badge ${cat.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
                      {cat.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="td-actions">
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
