import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { reservationsAPI } from '../../api/reservations.js'
import { Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatDate, formatTime, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './AdminOrdersPage.css'

const STATUSES = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار تایید' },
  { value: 'confirmed', label: 'تایید شده' },
  { value: 'cancelled', label: 'لغو شده' },
  { value: 'completed', label: 'انجام شده' },
]

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [updating, setUpdating] = useState(null)

  function fetch() {
    setLoading(true)
    const params = filterStatus ? { status: filterStatus } : {}
    reservationsAPI.adminGetReservations(params)
      .then((data) => setReservations(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [filterStatus])

  async function handleUpdate(id, status) {
    setUpdating(id)
    try {
      await reservationsAPI.adminUpdateReservation(id, { status })
      setReservations((prev) =>
        prev.map((r) => r.id === id ? { ...r, status } : r)
      )
      toast.success(`رزرو ${getStatusLabel(status)} شد`)
    } catch {
      toast.error('خطا در بروزرسانی وضعیت')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت رزروها</h1>
      </div>

      <div className="admin-orders__filters">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 200 }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </div>

      {loading ? <Loading /> : (
        <div className="admin-orders__table-wrap">
          {reservations.length === 0 ? (
            <div className="empty-state"><div className="icon">📅</div><h3>رزروی یافت نشد</h3></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>کاربر</th>
                  <th>میز</th>
                  <th>تاریخ</th>
                  <th>ساعت</th>
                  <th>نفرات</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>{r.user?.phone || '—'}</td>
                    <td>میز {r.table?.number}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{formatTime(r.start_time)} - {formatTime(r.end_time)}</td>
                    <td>{r.guests_count} نفر</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(r.status)}`}>
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.status === 'pending' && (
                          <button className="admin-action-btn" disabled={updating === r.id} onClick={() => handleUpdate(r.id, 'confirmed')}>
                            تایید
                          </button>
                        )}
                        {['pending', 'confirmed'].includes(r.status) && (
                          <button
                            className="admin-action-btn"
                            style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                            disabled={updating === r.id}
                            onClick={() => handleUpdate(r.id, 'cancelled')}
                          >
                            لغو
                          </button>
                        )}
                        {r.status === 'confirmed' && (
                          <button className="admin-action-btn" disabled={updating === r.id} onClick={() => handleUpdate(r.id, 'completed')}>
                            انجام شد
                          </button>
                        )}
                      </div>
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
