import { useState, useEffect } from 'react'
import { MdRefresh, MdCalendarToday } from 'react-icons/md'
import toast from 'react-hot-toast'
import { reservationsAPI } from '../../api/reservations.js'
import { Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { formatJalali } from '../../utils/jalali.js'
import { getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './AdminOrdersPage.css'

const STATUSES = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار تایید' },
  { value: 'confirmed', label: 'تایید شده' },
  { value: 'cancelled', label: 'لغو شده' },
  { value: 'completed', label: 'انجام شده' },
  { value: 'no_show', label: 'حضور نیافت' },
]

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [updating, setUpdating] = useState(null)
  const [datePickerModal, setDatePickerModal] = useState(false)

  function fetch() {
    setLoading(true)
    const params = {}
    if (filterStatus) params.status = filterStatus
    if (filterDate) params.date = filterDate
    reservationsAPI.adminGetReservations(params)
      .then((data) => setReservations(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [filterStatus, filterDate])

  async function handleUpdate(id, newStatus) {
    setUpdating(id)
    try {
      await reservationsAPI.adminUpdateReservation(id, { status: newStatus })
      setReservations((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: newStatus } : r)
      )
      toast.success(`رزرو ${getStatusLabel(newStatus)} شد`)
    } catch {
      toast.error('خطا در بروزرسانی وضعیت')
    } finally {
      setUpdating(null)
    }
  }

  function clearFilters() {
    setFilterStatus('')
    setFilterDate('')
  }

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت رزروها</h1>
        <p>{reservations.length} رزرو</p>
      </div>

      {/* Filters */}
      <div className="admin-orders__filters" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 180 }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>

        <button
          className="admin-orders__archive-jump-btn admin-orders__archive-jump-btn--wide"
          onClick={() => setDatePickerModal(true)}
        >
          <MdCalendarToday size={16} />
          {filterDate ? formatJalali(filterDate) : 'همه تاریخ‌ها'}
        </button>

        {(filterStatus || filterDate) && (
          <button
            onClick={clearFilters}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', fontSize: '0.82rem',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font-family)',
            }}
          >
            <MdRefresh size={14} /> پاک کردن
          </button>
        )}
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
                  <th>یادداشت</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const isPast = r.date < new Date().toISOString().split('T')[0]
                  return (
                    <tr key={r.id}>
                      <td data-label="شناسه">#{r.id}</td>
                      <td data-label="کاربر" style={{ fontSize: '0.82rem' }}>
                        <div>
                          <div>{r.user_phone || '—'}</div>
                          {r.user_name && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.user_name}</div>
                          )}
                        </div>
                      </td>
                      <td data-label="میز">میز {r.table_detail?.number}</td>
                      <td data-label="تاریخ" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        <div>
                          {formatJalali(r.date)}
                          {isPast && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>گذشته</div>
                          )}
                        </div>
                      </td>
                      <td data-label="ساعت" style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {r.start_time?.slice(0, 5)} – {r.end_time?.slice(0, 5)}
                      </td>
                      <td data-label="نفرات">{r.guests_count} نفر</td>
                      <td data-label="یادداشت" style={{ maxWidth: 140, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {r.note || '—'}
                      </td>
                      <td data-label="وضعیت">
                        <span className={`status-badge ${getStatusClass(r.status)}`}>
                          {getStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="td-actions">
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {r.status === 'pending' && (
                            <button
                              className="admin-action-btn"
                              disabled={updating === r.id}
                              onClick={() => handleUpdate(r.id, 'confirmed')}
                            >
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
                            <button
                              className="admin-action-btn"
                              style={{ background: 'var(--success-bg)', borderColor: 'rgba(74,222,128,0.2)', color: 'var(--success)' }}
                              disabled={updating === r.id}
                              onClick={() => handleUpdate(r.id, 'completed')}
                            >
                              انجام شد
                            </button>
                          )}
                          {r.status === 'confirmed' && (
                            <button
                              className="admin-action-btn"
                              style={{ background: 'var(--warning-bg)', borderColor: 'rgba(240,214,132,0.2)', color: 'var(--warning)' }}
                              disabled={updating === r.id}
                              onClick={() => handleUpdate(r.id, 'no_show')}
                            >
                              نیامد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal isOpen={datePickerModal} onClose={() => setDatePickerModal(false)} title="فیلتر بر اساس تاریخ" size="sm">
        <PersianDatePicker
          inline
          value={filterDate}
          onChange={(v) => { setFilterDate(v); setDatePickerModal(false) }}
        />
        {filterDate && (
          <button
            onClick={() => { setFilterDate(''); setDatePickerModal(false) }}
            style={{
              width: '100%', marginTop: 'var(--space-md)', padding: '10px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: '0.85rem',
            }}
          >
            نمایش همه تاریخ‌ها
          </button>
        )}
      </Modal>
    </div>
  )
}
