import { useState, useEffect } from 'react'
import { MdRefresh } from 'react-icons/md'
import { paymentsAPI } from '../../api/payments.js'
import { Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, formatDate, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './AdminOrdersPage.css'

const STATUSES = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'success', label: 'موفق' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'failed', label: 'ناموفق' },
  { value: 'cancelled', label: 'لغو شده' },
]

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  function fetch() {
    setLoading(true)
    const params = filterStatus ? { status: filterStatus } : {}
    paymentsAPI.adminGetPayments(params)
      .then((data) => setPayments(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [filterStatus])

  const total = payments.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <div className="page-header">
        <h1>تراکنش‌های مالی</h1>
        <p>مجموع پرداخت‌های موفق: <strong style={{ color: 'var(--success)' }}>{formatPrice(total)}</strong></p>
      </div>

      <div className="admin-orders__filters">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 200 }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <button className="admin-orders__refresh" onClick={fetch}>
          <MdRefresh size={18} /> بروزرسانی
        </button>
      </div>

      {loading ? <Loading /> : (
        <div className="admin-orders__table-wrap">
          {payments.length === 0 ? (
            <div className="empty-state"><div className="icon">💳</div><h3>تراکنشی یافت نشد</h3></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>کاربر</th>
                  <th>سفارش</th>
                  <th>مبلغ</th>
                  <th>کد پیگیری</th>
                  <th>تاریخ</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td data-label="شناسه">#{p.id}</td>
                    <td data-label="کاربر">{p.user?.phone || '—'}</td>
                    <td data-label="سفارش">سفارش #{p.order_number || p.order_id}</td>
                    <td data-label="مبلغ" className="price">{formatPrice(p.amount)}</td>
                    <td data-label="کد پیگیری" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span dir="ltr">{p.ref_id || '—'}</span>
                    </td>
                    <td data-label="تاریخ">{formatDate(p.created_at)}</td>
                    <td data-label="وضعیت">
                      <span className={`status-badge ${getStatusClass(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
