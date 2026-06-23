import { useState, useEffect } from 'react'
import { MdAdd, MdEdit, MdDelete, MdContentCopy } from 'react-icons/md'
import toast from 'react-hot-toast'
import { discountsAPI } from '../../api/discounts.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input, Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, formatDate } from '../../utils/helpers.js'
import './AdminOrdersPage.css'

const now = new Date()
const toLocalISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const EMPTY = {
  code: '', discount_type: 'percentage', value: '', min_order_amount: 0,
  max_discount_amount: '', usage_limit: '', is_active: true,
  valid_from: toLocalISO(now),
  valid_until: toLocalISO(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
}

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    discountsAPI.adminGetDiscounts()
      .then((data) => setDiscounts(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() { setEditItem(null); setForm(EMPTY); setModal(true) }

  function openEdit(d) {
    setEditItem(d)
    setForm({
      code: d.code, discount_type: d.discount_type, value: d.value,
      min_order_amount: d.min_order_amount, max_discount_amount: d.max_discount_amount || '',
      usage_limit: d.usage_limit || '', is_active: d.is_active,
      valid_from: toLocalISO(new Date(d.valid_from)),
      valid_until: toLocalISO(new Date(d.valid_until)),
    })
    setModal(true)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setForm((p) => ({ ...p, code }))
  }

  async function handleSave() {
    if (!form.code || !form.value) { toast.error('کد و مقدار تخفیف الزامی است'); return }
    setSaving(true)
    try {
      const data = {
        ...form,
        value: Number(form.value),
        min_order_amount: Number(form.min_order_amount) || 0,
        max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      }
      if (editItem) {
        const updated = await discountsAPI.adminUpdateDiscount(editItem.id, data)
        setDiscounts((prev) => prev.map((d) => d.id === editItem.id ? updated : d))
        toast.success('کد تخفیف بروزرسانی شد')
      } else {
        const created = await discountsAPI.adminCreateDiscount(data)
        setDiscounts((prev) => [created, ...prev])
        toast.success('کد تخفیف اضافه شد')
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
    if (!confirm('حذف این کد تخفیف؟')) return
    try {
      await discountsAPI.adminDeleteDiscount(id)
      setDiscounts((prev) => prev.filter((d) => d.id !== id))
      toast.success('کد تخفیف حذف شد')
    } catch {
      toast.error('خطا در حذف')
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code)
    toast.success(`کد ${code} کپی شد`)
  }

  const isExpired = (d) => new Date(d.valid_until) < new Date()

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>کدهای تخفیف</h1>
        </div>
        <Button onClick={openCreate}><MdAdd size={18} /> کد جدید</Button>
      </div>

      <div className="admin-orders__table-wrap">
        {discounts.length === 0 ? (
          <div className="empty-state"><div className="icon">🏷️</div><h3>کد تخفیفی ثبت نشده</h3></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>کد</th>
                <th>نوع</th>
                <th>مقدار</th>
                <th>حداقل سفارش</th>
                <th>استفاده</th>
                <th>اعتبار تا</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', direction: 'ltr', letterSpacing: 1 }}>{d.code}</span>
                      <button
                        onClick={() => copyCode(d.code)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                      >
                        <MdContentCopy size={14} />
                      </button>
                    </div>
                  </td>
                  <td>{d.discount_type === 'percentage' ? 'درصدی' : 'مبلغ ثابت'}</td>
                  <td className="price" style={{ color: 'var(--success)' }}>
                    {d.discount_type === 'percentage' ? `${d.value}٪` : formatPrice(d.value)}
                  </td>
                  <td>{d.min_order_amount > 0 ? formatPrice(d.min_order_amount) : '—'}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>
                    {d.used_count}{d.usage_limit ? ` / ${d.usage_limit}` : ''}
                  </td>
                  <td style={{ color: isExpired(d) ? 'var(--error)' : 'var(--text-secondary)' }}>
                    {formatDate(d.valid_until)}
                  </td>
                  <td>
                    {isExpired(d) ? (
                      <span className="status-badge status-cancelled">منقضی</span>
                    ) : d.is_active ? (
                      <span className="status-badge status-confirmed">فعال</span>
                    ) : (
                      <span className="status-badge status-pending">غیرفعال</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-action-btn" onClick={() => openEdit(d)}>
                        <MdEdit size={14} />
                      </button>
                      <button
                        className="admin-action-btn"
                        style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                        onClick={() => handleDelete(d.id)}
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
        title={editItem ? 'ویرایش کد تخفیف' : 'کد تخفیف جدید'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>انصراف</Button>
            <Button onClick={handleSave} loading={saving}>ذخیره</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input label="کد تخفیف *" name="code" value={form.code} onChange={handleChange} dir="ltr" placeholder="SUMMER2026" />
            </div>
            <Button variant="secondary" size="sm" onClick={generateCode} style={{ marginBottom: 0 }}>
              تولید خودکار
            </Button>
          </div>
          <Select label="نوع تخفیف" name="discount_type" value={form.discount_type} onChange={handleChange}>
            <option value="percentage">درصدی (%)</option>
            <option value="fixed">مبلغ ثابت (تومان)</option>
          </Select>
          <Input
            label={form.discount_type === 'percentage' ? 'درصد تخفیف *' : 'مبلغ تخفیف *'}
            name="value" type="number" value={form.value} onChange={handleChange}
            placeholder={form.discount_type === 'percentage' ? 'مثلاً: 20' : 'مثلاً: 50000'}
          />
          <Input label="حداقل مبلغ سفارش (تومان)" name="min_order_amount" type="number" value={form.min_order_amount} onChange={handleChange} />
          <Input label="حداکثر تخفیف (تومان، اختیاری)" name="max_discount_amount" type="number" value={form.max_discount_amount} onChange={handleChange} />
          <Input label="محدودیت تعداد استفاده (اختیاری)" name="usage_limit" type="number" value={form.usage_limit} onChange={handleChange} />
          <Input label="از تاریخ *" name="valid_from" type="datetime-local" value={form.valid_from} onChange={handleChange} dir="ltr" />
          <Input label="تا تاریخ *" name="valid_until" type="datetime-local" value={form.valid_until} onChange={handleChange} dir="ltr" />
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
              کد فعال باشد
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
