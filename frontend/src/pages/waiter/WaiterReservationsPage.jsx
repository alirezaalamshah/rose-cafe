import { useState, useEffect, useCallback } from 'react'
import { MdRefresh, MdPeople, MdAccessTime, MdCalendarToday, MdPhone, MdStickyNote2 } from 'react-icons/md'
import toast from 'react-hot-toast'
import { waiterAPI } from '../../api/waiter.js'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { confirm } from '../../store/confirmStore.js'
import { formatJalali, jalaliToIso, getTodayJalali } from '../../utils/jalali.js'
import { getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './WaiterOrdersPage.css'
import './WaiterReservationsPage.css'

export default function WaiterReservationsPage() {
  const { jy, jm, jd } = getTodayJalali()
  const todayIso = jalaliToIso(jy, jm, jd)

  const [date, setDate] = useState(todayIso)
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [datePickerModal, setDatePickerModal] = useState(false)

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

  async function handleNoShow(r) {
    if (!(await confirm(
      `رزرو میز ${r.table_detail?.number || r.table} به‌عنوان «نیامد» ثبت شود؟`,
      { title: 'عدم حضور مشتری', confirmLabel: 'ثبت نیامد', danger: true },
    ))) return
    handleUpdate(r.id, 'no_show')
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
        <button
          className="waiter-archive-jump-btn waiter-archive-jump-btn--wide"
          onClick={() => setDatePickerModal(true)}
        >
          <MdCalendarToday size={16} />
          {date ? formatJalali(date) : 'انتخاب تاریخ'}
        </button>
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
            <div key={r.id} className={`waiter-res-card waiter-res-card--${r.status}`}>
              <div className="waiter-res-card__stripe" />
              <div className="waiter-res-card__body">
                <div className="waiter-res-card__top">
                  <div className="waiter-res-card__table">
                    میز {r.table_detail?.number || r.table}
                    <span className="waiter-res-card__guests"><MdPeople size={13} /> {r.guests_count} نفر</span>
                  </div>
                  <span className={`status-badge ${getStatusClass(r.status)}`}>{getStatusLabel(r.status)}</span>
                </div>

                <div className="waiter-res-card__time">
                  <span className="waiter-res-card__time-range" dir="ltr">
                    <MdAccessTime size={14} /> {r.start_time?.slice(0,5)} — {r.end_time?.slice(0,5)}
                  </span>
                  <span className="waiter-res-card__date">{formatJalali(r.date)}</span>
                </div>

                {(r.user_name || r.user_phone) && (
                  <div className="waiter-res-card__user">
                    <span className="waiter-res-card__user-name">{r.user_name || 'مشتری'}</span>
                    {r.user_phone && (
                      <a href={`tel:${r.user_phone}`} className="waiter-res-card__user-phone" dir="ltr">
                        <MdPhone size={13} /> {r.user_phone}
                      </a>
                    )}
                  </div>
                )}

                {r.note && (
                  <div className="waiter-res-card__note">
                    <MdStickyNote2 size={13} /> {r.note}
                  </div>
                )}
              </div>

              <div className="waiter-res-card__actions">
                {r.status === 'pending' && (
                  <button
                    className="waiter-action-btn waiter-action-btn--filled"
                    disabled={updating === r.id}
                    onClick={() => handleUpdate(r.id, 'confirmed')}
                  >
                    {updating === r.id ? <span className="waiter-btn-spinner" /> : 'تأیید رزرو'}
                  </button>
                )}
                {r.status === 'confirmed' && (
                  <>
                    <button
                      className="waiter-action-btn waiter-action-btn--outline"
                      disabled={updating === r.id}
                      onClick={() => handleNoShow(r)}
                    >
                      نیامد
                    </button>
                    <button
                      className="waiter-action-btn waiter-action-btn--filled"
                      disabled={updating === r.id}
                      onClick={() => handleUpdate(r.id, 'completed')}
                    >
                      {updating === r.id ? <span className="waiter-btn-spinner" /> : 'انجام شد'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={datePickerModal}
        onClose={() => setDatePickerModal(false)}
        title="انتخاب تاریخ"
        size="sm"
      >
        <PersianDatePicker
          inline
          value={date}
          onChange={(v) => { setDate(v); setDatePickerModal(false) }}
        />
      </Modal>
    </div>
  )
}
