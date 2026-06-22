import { useState, useEffect } from 'react'
import { MdRefresh, MdFilterList } from 'react-icons/md'
import toast from 'react-hot-toast'
import { ordersAPI } from '../../api/orders.js'
import { Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, formatDate, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './AdminOrdersPage.css'

const STATUSES = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار پرداخت' },
  { value: 'confirmed', label: 'تایید شده' },
  { value: 'preparing', label: 'در حال آماده‌سازی' },
  { value: 'ready', label: 'آماده تحویل' },
  { value: 'delivered', label: 'تحویل داده شد' },
  { value: 'cancelled', label: 'لغو شده' },
]

const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [updating, setUpdating] = useState(null)

  function fetchOrders() {
    setLoading(true)
    const params = filterStatus ? { status: filterStatus } : {}
    ordersAPI.adminGetOrders(params)
      .then((data) => setOrders(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [filterStatus])

  async function handleStatusUpdate(id, status) {
    setUpdating(id)
    try {
      await ordersAPI.adminUpdateStatus(id, status)
      setOrders((prev) =>
        prev.map((o) => o.id === id ? { ...o, status } : o)
      )
      toast.success(`وضعیت به "${getStatusLabel(status)}" تغییر یافت`)
    } catch {
      toast.error('خطا در تغییر وضعیت')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت سفارشات</h1>
      </div>

      <div className="admin-orders__filters">
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 200 }}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <button
          className="admin-orders__refresh"
          onClick={fetchOrders}
        >
          <MdRefresh size={18} /> بروزرسانی
        </button>
      </div>

      {loading ? <Loading /> : (
        <div className="admin-orders__table-wrap">
          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📦</div>
              <h3>سفارشی یافت نشد</h3>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>کاربر</th>
                  <th>آیتم‌ها</th>
                  <th>مبلغ</th>
                  <th>نوع تحویل</th>
                  <th>تاریخ</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.user?.phone || '—'}</td>
                    <td>{order.items?.length || 0} آیتم</td>
                    <td className="price">{formatPrice(order.final_price)}</td>
                    <td>{order.delivery_type === 'delivery' ? 'پیک' : 'محل'}</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td>
                      {NEXT_STATUS[order.status] && (
                        <button
                          className="admin-action-btn"
                          disabled={updating === order.id}
                          onClick={() => handleStatusUpdate(order.id, NEXT_STATUS[order.status])}
                        >
                          {updating === order.id ? '...' : `→ ${getStatusLabel(NEXT_STATUS[order.status])}`}
                        </button>
                      )}
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
