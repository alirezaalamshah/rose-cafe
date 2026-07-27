import { useState, useEffect } from 'react'
import { MdAdd, MdEdit, MdDelete, MdTableBar, MdToggleOn, MdToggleOff } from 'react-icons/md'
import toast from 'react-hot-toast'
import { reservationsAPI } from '../../api/reservations.js'
import { confirm } from '../../store/confirmStore.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input, Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import './AdminOrdersPage.css'
import './AdminTablesPage.css'

const EMPTY = { number: '', capacity: '', location: 'indoor', is_active: true, description: '' }
const LOCATIONS = { indoor: 'داخل کافه', outdoor: 'فضای باز', vip: 'VIP' }

export default function AdminTablesPage() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkSaving, setBulkSaving] = useState(false)

  useEffect(() => {
    reservationsAPI.adminGetTables()
      .then((data) => setTables(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() { setEditItem(null); setForm(EMPTY); setModal(true) }

  function openEdit(table) {
    setEditItem(table)
    setForm({
      number: table.number,
      capacity: table.capacity,
      location: table.location,
      is_active: table.is_active,
      description: table.description || '',
    })
    setModal(true)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSave() {
    if (!form.number || !form.capacity) { toast.error('شماره و ظرفیت میز الزامی است'); return }
    setSaving(true)
    try {
      const data = { ...form, number: Number(form.number), capacity: Number(form.capacity) }
      if (editItem) {
        const updated = await reservationsAPI.adminUpdateTable(editItem.id, data)
        setTables((prev) => prev.map((t) => t.id === editItem.id ? updated : t))
        toast.success('میز بروزرسانی شد')
      } else {
        const created = await reservationsAPI.adminCreateTable(data)
        setTables((prev) => [...prev, created].sort((a, b) => a.number - b.number))
        toast.success('میز اضافه شد')
      }
      setModal(false)
    } catch (err) {
      const errors = err.response?.data
      toast.error(errors ? Object.values(errors).flat().join(' — ') : 'خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(table) {
    setToggling(table.id)
    try {
      const updated = await reservationsAPI.adminPatchTable(table.id, { is_active: !table.is_active })
      setTables((prev) => prev.map((t) => t.id === table.id ? updated : t))
      toast.success(updated.is_active ? 'میز فعال شد' : 'میز غیرفعال شد')
    } catch {
      toast.error('خطا در تغییر وضعیت میز')
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(id) {
    if (!(await confirm('حذف این میز؟', { title: 'حذف میز' }))) return
    try {
      await reservationsAPI.adminDeleteTable(id)
      setTables((prev) => prev.filter((t) => t.id !== id))
      toast.success('میز حذف شد')
    } catch {
      toast.error('خطا در حذف — ممکن است رزرو فعالی به این میز وابسته باشد')
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => prev.length === tables.length ? [] : tables.map((t) => t.id))
  }

  async function handleBulkToggle(is_active) {
    setBulkSaving(true)
    try {
      await reservationsAPI.adminBulkToggleTables({ table_ids: selectedIds, is_active })
      setTables((prev) => prev.map((t) => selectedIds.includes(t.id) ? { ...t, is_active } : t))
      toast.success(`${selectedIds.length} میز ${is_active ? 'فعال' : 'غیرفعال'} شد`)
      setSelectedIds([])
    } catch { toast.error('خطا در تغییر وضعیت گروهی') }
    finally { setBulkSaving(false) }
  }

  if (loading) return <Loading />

  const activeCount = tables.filter((t) => t.is_active).length

  return (
    <div>
      <div className="admin-page-head">
        <div className="page-header">
          <h1>مدیریت میزها</h1>
          <p>{tables.length} میز — {activeCount} فعال، {tables.length - activeCount} غیرفعال</p>
        </div>
        <Button onClick={openCreate}><MdAdd size={18} /> افزودن میز</Button>
      </div>

      {tables.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
            {selectedIds.length === tables.length ? 'لغو انتخاب همه' : 'انتخاب همه'}
          </Button>
          {selectedIds.length > 0 && (
            <div className="bulk-toolbar" style={{ margin: 0, flex: 1 }}>
              <span className="bulk-toolbar__count">{selectedIds.length} میز انتخاب شده</span>
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
        </div>
      )}

      <div className="admin-tables__grid">
        {tables.length === 0 ? (
          <div className="empty-state"><div className="icon">🪑</div><h3>میزی تعریف نشده</h3></div>
        ) : tables.map((table) => (
          <div key={table.id} className={`admin-table-card neu-card-sm ${!table.is_active ? 'admin-table-card--inactive' : ''}`}>
            <div className="admin-table-card__header">
              <input
                type="checkbox"
                checked={selectedIds.includes(table.id)}
                onChange={() => toggleSelect(table.id)}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <MdTableBar size={24} color={table.is_active ? 'var(--primary)' : 'var(--text-muted)'} />
              <span className="admin-table-card__number">میز {table.number}</span>
              <span
                className={`status-badge ${table.is_active ? 'status-confirmed' : 'status-cancelled'}`}
                style={{ fontSize: '0.7rem' }}
              >
                {table.is_active ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
            <div className="admin-table-card__info">
              <span>{table.capacity} نفره</span>
              <span className="admin-table-card__location">{LOCATIONS[table.location] || table.location}</span>
            </div>
            {table.description && (
              <p className="admin-table-card__desc">{table.description}</p>
            )}
            <div className="admin-table-card__actions">
              {/* Toggle active/inactive */}
              <button
                className={`admin-action-btn admin-table-toggle ${table.is_active ? 'admin-table-toggle--off' : 'admin-table-toggle--on'}`}
                onClick={() => handleToggle(table)}
                disabled={toggling === table.id}
                title={table.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                style={{ flex: 1 }}
              >
                {toggling === table.id ? (
                  '...'
                ) : table.is_active ? (
                  <><MdToggleOff size={15} /> غیرفعال</>
                ) : (
                  <><MdToggleOn size={15} /> فعال کردن</>
                )}
              </button>
              <button className="admin-action-btn" onClick={() => openEdit(table)}>
                <MdEdit size={14} />
              </button>
              <button
                className="admin-action-btn"
                style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                onClick={() => handleDelete(table.id)}
              >
                <MdDelete size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editItem ? `ویرایش میز ${editItem.number}` : 'افزودن میز جدید'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>انصراف</Button>
            <Button onClick={handleSave} loading={saving}>ذخیره</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input label="شماره میز *" name="number" type="number" value={form.number} onChange={handleChange} min="1" />
            <Input label="ظرفیت (نفر) *" name="capacity" type="number" value={form.capacity} onChange={handleChange} min="1" />
          </div>
          <Select label="موقعیت" name="location" value={form.location} onChange={handleChange}>
            <option value="indoor">داخل کافه</option>
            <option value="outdoor">فضای باز</option>
            <option value="vip">VIP</option>
          </Select>
          <Input
            label="توضیحات (اختیاری)"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="مثلاً: کنار پنجره، دارای دید بیرون"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            میز فعال (قابل رزرو)
          </label>
        </div>
      </Modal>
    </div>
  )
}
