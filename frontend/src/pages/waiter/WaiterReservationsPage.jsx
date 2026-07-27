import { useState, useEffect, useCallback } from 'react'
import { MdRefresh, MdPeople, MdAccessTime } from 'react-icons/md'
import toast from 'react-hot-toast'
import { waiterAPI } from '../../api/waiter.js'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatJalali, jalaliToIso, getTodayJalali } from '../../utils/jalali.js'
import { getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './WaiterReservationsPage.css'

export default function WaiterReservationsPage() {
  const { jy, jm, jd } = getTodayJalali()
  const todayIso = jalaliToIso(jy, jm, jd)

  const [date, setDate] = useState(todayIso)
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (date) params.date = date
      const data = await waiterAPI.getReservations(params)
      setReservations(Array.isArray(data) ? data : (data?.results || []))
    } catch {
      toast.error('خطا در بارگذاری رزروها')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  async function handleUpdate(id, status) {
    setUpdating(id)
    try {
      const updated = await waiterAPI.updateReservation(id, { status })
      setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status: updated.status } : r))
      toast.success(`رزرو ${getStatusLabel(status)} شد`)
    } catch {
      toast.error('خطا در بروزرسانی رزرو')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="waiter-res">
      <div className="waiter-page-header">
        <h1>رزروها</h1>
        <button className="waiter-refresh-btn" onClick={load} disabled={loading}>
          <MdRefresh size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="waiter-res__filter">
        <PersianDatePicker
          value={date}
          onChange={setDate}
          placeholder="انتخاب تاریخ"
          label="تاریخ"
        />
      </div>

      {loading ? <Loading /> : reservations.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📅</div>
          <h3>رزروی یافت نشد</h3>
          <p>{date ? `برای ${formatJalali(date)}` : 'برای این تاریخ'}</p>
        </div>
      ) : (
        <div className="waiter-res-list">
          {reservations.map((r) => (
            <div key={r.id} className="waiter-res-card neu-card-sm">
              <div className="waiter-res-card__top">
                <div className="waiter-res-card__table">
                  میز {r.table_detail?.number || r.table}
                  <span className="waiter-res-card__guests"><MdPeople size={13} /> {r.guests_count} نفر</span>
                </div>
                <span className={`status-badge ${getStatusClass(r.status)}`}>{getStatusLabel(r.status)}</span>
              </div>

              <div className="waiter-res-card__time">
                <MdAccessTime size={14} />
                {r.start_time?.slice(0,5)} — {r.end_time?.slice(0,5)}
                <span className="waiter-res-card__date">{formatJalali(r.date)}</span>
              </div>

              {r.user_phone && (
                <div className="waiter-res-card__user">
                  {r.user_name && <strong>{r.user_name}</strong>}
                  <span style={{ direction: 'ltr' }}>{r.user_phone}</span>
                </div>
              )}

              {r.note && <div className="waiter-res-card__note">📝 {r.note}</div>}

              <div className="waiter-res-card__actions">
                {r.status === 'pending' && (
                  <button
                    className="waiter-action-btn waiter-action-btn--success"
                    disabled={updating === r.id}
                    onClick={() => handleUpdate(r.id, 'confirmed')}
                  >
                    {updating === r.id ? '...' : 'تأیید رزرو'}
                  </button>
                )}
                {r.status === 'confirmed' && (
                  <>
                    <button
                      className="waiter-action-btn waiter-action-btn--primary"
                      disabled={updating === r.id}
                      onClick={() => handleUpdate(r.id, 'completed')}
                    >
                      {updating === r.id ? '...' : 'انجام شد'}
                    </button>
                    <button
                      className="waiter-action-btn waiter-action-btn--warning"
                      disabled={updating === r.id}
                      onClick={() => handleUpdate(r.id, 'no_show')}
                    >
                      نیامد
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
