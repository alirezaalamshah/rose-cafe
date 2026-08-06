import { useState, useEffect, useMemo } from 'react'
import {
  MdTableBar, MdCalendarToday, MdPeople, MdAccessTime, MdCancel, MdEventBusy,
  MdAdd, MdRemove,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { reservationsAPI } from '../../api/reservations.js'
import { businessAPI } from '../../api/business.js'
import { confirm } from '../../store/confirmStore.js'
import Button from '../../components/common/Button/Button.jsx'
import { Textarea } from '../../components/common/Input/Input.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import TimePicker from '../../components/common/TimePicker/TimePicker.jsx'
import { formatJalali, jalaliToIso, getTodayJalali } from '../../utils/jalali.js'
import { getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './ReservationPage.css'

const LOCATION_ICONS = { indoor: '🏠', outdoor: '🌳', vip: '👑' }
const LOCATION_LABELS = { indoor: 'داخل کافه', outdoor: 'فضای باز', vip: 'VIP' }

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function addMinutes(timeStr, mins) {
  const total = timeToMinutes(timeStr) + mins
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function Timeline({ slots, dayStartH = 7, dayEndH = 23 }) {
  const dayStart = dayStartH * 60
  const dayRange = (dayEndH - dayStartH) * 60

  function toPercent(timeStr) {
    return Math.max(0, Math.min(100, ((timeToMinutes(timeStr) - dayStart) / dayRange) * 100))
  }

  const midH = Math.round((dayStartH + dayEndH) / 2)

  return (
    <div className="res-timeline">
      <div className="res-timeline__bar">
        {slots.map((s, i) => {
          const left = toPercent(s.start_time)
          const width = Math.max(2, toPercent(s.end_time) - left)
          return (
            <div
              key={i}
              className="res-timeline__block"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${s.start_time} - ${s.end_time}`}
            />
          )
        })}
      </div>
      <div className="res-timeline__labels">
        <span>{dayStartH}</span>
        <span>{midH}</span>
        <span>{dayEndH}</span>
      </div>
    </div>
  )
}

function GuestStepper({ value, onChange, min = 1, max = 20 }) {
  return (
    <div className="res-guest-stepper">
      <button
        type="button"
        className="res-guest-stepper__btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <MdRemove size={16} />
      </button>
      <span className="res-guest-stepper__value">
        <MdPeople size={15} />
        {value} نفر
      </span>
      <button
        type="button"
        className="res-guest-stepper__btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <MdAdd size={16} />
      </button>
    </div>
  )
}

function TableCard({ table, onBook, guestsCount, dayStartH, dayEndH }) {
  const hasSlots = table.reservations_today?.length > 0
  const overCapacity = guestsCount > table.capacity

  return (
    <div className={`res-table-card neu-card-sm ${overCapacity ? 'res-table-card--dim' : ''}`}>
      <div className="res-table-card__header">
        <span className="res-table-card__icon">{LOCATION_ICONS[table.location] || '🪑'}</span>
        <div className="res-table-card__info">
          <span className="res-table-card__number">میز {table.number}</span>
          <span className="res-table-card__meta">
            <MdPeople size={13} /> {table.capacity} نفره
            &nbsp;·&nbsp;
            {LOCATION_LABELS[table.location]}
          </span>
        </div>
      </div>

      <Timeline slots={table.reservations_today || []} dayStartH={dayStartH} dayEndH={dayEndH} />

      {hasSlots ? (
        <div className="res-table-card__slots">
          {table.reservations_today.map((s, i) => (
            <span key={i} className="res-table-card__slot">
              <MdEventBusy size={12} /> {s.start_time}–{s.end_time}
            </span>
          ))}
        </div>
      ) : (
        <div className="res-table-card__free">✓ آزاد</div>
      )}

      {overCapacity ? (
        <div className="res-table-card__overcap">ظرفیت کمتر از {guestsCount} نفر</div>
      ) : (
        <Button size="sm" style={{ width: '100%', marginTop: 'var(--space-sm)' }} onClick={onBook}>
          رزرو این میز
        </Button>
      )}
    </div>
  )
}

// JS getDay() → 0=Sun; Python weekday() → 0=Mon → (jsDay + 6) % 7
const todayPythonDay = (new Date().getDay() + 6) % 7

function getNowPlusOneHourMin() {
  const now = new Date()
  now.setHours(now.getHours() + 1)
  const h = now.getHours()
  // Round up to nearest 5-minute slot
  const m = Math.ceil(now.getMinutes() / 5) * 5
  if (m >= 60) {
    return `${String(h + 1).padStart(2, '0')}:00`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function ReservationPage() {
  const [date, setDate] = useState('')
  const [guestsCount, setGuestsCount] = useState(2)
  const [schedule, setSchedule] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  const [selectedTable, setSelectedTable] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [datePickerModal, setDatePickerModal] = useState(false)
  const [bookForm, setBookForm] = useState({ start_time: '', end_time: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  const [reservations, setReservations] = useState([])
  const [loadingRes, setLoadingRes] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  // Business hours
  const [allHours, setAllHours] = useState([])
  const [dayStartH, setDayStartH] = useState(7)  // امروز — برای نوار اطلاع‌رسانی
  const [dayEndH, setDayEndH] = useState(23)       // امروز — برای نوار اطلاع‌رسانی
  const [todayHours, setTodayHours] = useState(null)

  // Reservation settings
  const [maxReservationHours, setMaxReservationHours] = useState(3)

  const { jy, jm, jd } = getTodayJalali()
  const today = jalaliToIso(jy, jm, jd)

  const isToday = date === today

  // ساعت باز/بسته شدن دقیق (HH:MM) روز انتخاب‌شده — بر اساس ساعات کاری هفتگی
  const bookingDayOpenTime = useMemo(() => {
    if (!date || allHours.length === 0) return undefined
    const jsDay = new Date(date).getDay()           // 0=Sun
    const pythonDay = (jsDay + 6) % 7              // 0=Mon
    const entry = allHours.find((h) => h.day_of_week === pythonDay)
    return (entry?.is_open && entry.open_time) ? entry.open_time.slice(0, 5) : undefined
  }, [date, allHours])

  const bookingDayCloseTime = useMemo(() => {
    if (!date || allHours.length === 0) return `${dayEndH}:00`
    const jsDay = new Date(date).getDay()
    const pythonDay = (jsDay + 6) % 7
    const entry = allHours.find((h) => h.day_of_week === pythonDay)
    return (entry?.is_open && entry.close_time) ? entry.close_time.slice(0, 5) : `${dayEndH}:00`
  }, [date, allHours, dayEndH])

  // بازه‌ی ساعت‌های قابل‌انتخاب در TimePicker (فقط برای محدود کردن ستون ساعت به بازه‌ی کاری)
  const bookingDayStartH = bookingDayOpenTime ? parseInt(bookingDayOpenTime.slice(0, 2), 10) : dayStartH
  const bookingDayCloseH = parseInt(bookingDayCloseTime.slice(0, 2), 10)

  // Minimum start time: هم نباید قبل از ساعت باز شدن کافه باشد، هم (برای امروز) نباید قبل از یک ساعت دیگر باشد
  const minStartTime = useMemo(() => {
    const nowRule = isToday ? getNowPlusOneHourMin() : undefined
    if (nowRule && bookingDayOpenTime) return nowRule > bookingDayOpenTime ? nowRule : bookingDayOpenTime
    return nowRule || bookingDayOpenTime
  }, [isToday, bookingDayOpenTime])

  // Max end time = min(start + maxHours, closingTime)
  const closingTimeStr = bookingDayCloseTime

  const maxEndTime = useMemo(() => {
    if (!bookForm.start_time) return undefined
    const endByDuration = addMinutes(bookForm.start_time, maxReservationHours * 60)
    return endByDuration > closingTimeStr ? closingTimeStr : endByDuration
  }, [bookForm.start_time, maxReservationHours, closingTimeStr])

  useEffect(() => {
    businessAPI.getHours()
      .then((data) => {
        const hours = Array.isArray(data) ? data : (data?.results || [])
        setAllHours(hours)
        const todayEntry = hours.find((h) => h.day_of_week === todayPythonDay)
        if (todayEntry?.is_open && todayEntry.open_time && todayEntry.close_time) {
          setDayStartH(parseInt(todayEntry.open_time.slice(0, 2), 10))
          setDayEndH(parseInt(todayEntry.close_time.slice(0, 2), 10))
          setTodayHours(todayEntry)
        }
      })
      .catch(() => {})

    businessAPI.getReservationSettings()
      .then((data) => setMaxReservationHours(data.max_reservation_hours || 3))
      .catch(() => {})
  }, [])

  useEffect(() => {
    reservationsAPI.getReservations()
      .then((data) => setReservations(Array.isArray(data) ? data : (data?.results || [])))
      .finally(() => setLoadingRes(false))
  }, [])

  async function loadSchedule(newDate) {
    if (!newDate) { setSchedule(null); return }
    setLoadingSchedule(true)
    try {
      const data = await reservationsAPI.getTableSchedule(newDate)
      setSchedule(Array.isArray(data) ? data : (data?.results || []))
    } catch {
      toast.error('خطا در بارگذاری میزها')
      setSchedule([])
    } finally {
      setLoadingSchedule(false)
    }
  }

  function handleDateChange(val) {
    setDate(val)
    loadSchedule(val)
  }

  function openBookModal(table) {
    setSelectedTable(table)
    setBookForm({ start_time: '', end_time: '', note: '' })
    setShowModal(true)
  }

  function handleStartTimeChange(val) {
    const autoEnd = addMinutes(val, maxReservationHours * 60)
    const cappedEnd = autoEnd > closingTimeStr ? closingTimeStr : autoEnd
    setBookForm((p) => ({ ...p, start_time: val, end_time: cappedEnd }))
  }

  async function handleBook() {
    if (!bookForm.start_time || !bookForm.end_time) {
      toast.error('ساعت شروع و پایان را وارد کنید')
      return
    }
    if (bookForm.start_time >= bookForm.end_time) {
      toast.error('ساعت پایان باید بعد از ساعت شروع باشد')
      return
    }
    const durationMins = timeToMinutes(bookForm.end_time) - timeToMinutes(bookForm.start_time)
    if (durationMins > maxReservationHours * 60) {
      toast.error(`حداکثر مدت رزرو ${maxReservationHours} ساعت است`)
      return
    }
    setSubmitting(true)
    try {
      await reservationsAPI.createReservation({
        table: selectedTable.id,
        date,
        start_time: bookForm.start_time,
        end_time: bookForm.end_time,
        guests_count: Number(guestsCount),
        note: bookForm.note,
      })
      toast.success('رزرو با موفقیت ثبت شد!')
      setShowModal(false)
      const [schedData, resData] = await Promise.all([
        reservationsAPI.getTableSchedule(date),
        reservationsAPI.getReservations(),
      ])
      setSchedule(Array.isArray(schedData) ? schedData : [])
      setReservations(Array.isArray(resData) ? resData : (resData?.results || []))
    } catch (err) {
      const msg = err.response?.data?.detail
        || (typeof err.response?.data === 'string' ? err.response.data : null)
        || 'خطا در ثبت رزرو'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id) {
    if (!(await confirm('رزرو لغو شود؟', { title: 'لغو رزرو' }))) return
    setCancelling(id)
    try {
      await reservationsAPI.cancelReservation(id)
      toast.success('رزرو لغو شد')
      setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status: 'cancelled' } : r))
      if (date) {
        const data = await reservationsAPI.getTableSchedule(date)
        setSchedule(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در لغو رزرو')
    } finally {
      setCancelling(null)
    }
  }

  const visibleTables = schedule ?? []

  return (
    <div className="reservation-page">
      <div className="page-header">
        <h1>رزرو میز</h1>
        <p>تاریخ مورد نظر را انتخاب کنید، میز و ساعت دلخواه را رزرو کنید</p>
      </div>

      {/* Today's hours info */}
      {todayHours && (
        <div style={{ marginBottom: 'var(--space-md)', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <MdAccessTime size={14} color="var(--primary)" />
          ساعات کاری امروز:
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', direction: 'ltr' }}>
            {todayHours.open_time?.slice(0, 5)} — {todayHours.close_time?.slice(0, 5)}
          </span>
        </div>
      )}

      {/* Search Bar */}
      <div className="res-search neu-card">
        <div className="res-search__field">
          <label className="res-search__label">
            <MdCalendarToday size={16} /> تاریخ
          </label>
          <button
            type="button"
            className="res-search__input"
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: '100%', textAlign: 'right' }}
            onClick={() => setDatePickerModal(true)}
          >
            <MdCalendarToday size={16} color="var(--text-muted)" />
            <span style={{ color: date ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {date ? formatJalali(date) : 'انتخاب تاریخ'}
            </span>
          </button>
        </div>
        <div className="res-search__field">
          <label className="res-search__label">
            <MdPeople size={16} /> تعداد نفرات
          </label>
          <GuestStepper value={guestsCount} onChange={setGuestsCount} min={1} max={20} />
        </div>
      </div>

      {/* Tables Grid */}
      {date && (
        <div className="res-tables-section">
          <h2 className="section-title">
            <MdTableBar color="var(--primary)" />
            میزهای کافه
            {date && (
              <span className="res-tables-date">{formatJalali(date)}</span>
            )}
          </h2>

          {loadingSchedule ? (
            <Loading text="در حال بارگذاری میزها..." />
          ) : visibleTables.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🪑</div>
              <h3>هیچ میز فعالی تعریف نشده</h3>
              <p>ادمین باید ابتدا میزها را فعال کند</p>
            </div>
          ) : (
            <>
              <div className="res-legend">
                <span className="res-legend__item res-legend__item--busy" />
                <span>رزرو شده</span>
                <span className="res-legend__item res-legend__item--free" />
                <span>آزاد</span>
              </div>
              <div className="res-tables-grid">
                {visibleTables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    guestsCount={guestsCount}
                    onBook={() => openBookModal(table)}
                    dayStartH={bookingDayStartH}
                    dayEndH={bookingDayCloseH}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Booking Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`رزرو میز ${selectedTable?.number}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>انصراف</Button>
            <Button onClick={handleBook} loading={submitting}>ثبت رزرو</Button>
          </>
        }
      >
        {selectedTable && (
          <div className="res-modal">
            <div className="res-modal__table-info">
              <span>{LOCATION_ICONS[selectedTable.location]}</span>
              <span>{LOCATION_LABELS[selectedTable.location]}</span>
              <span>·</span>
              <span><MdPeople size={14} /> {selectedTable.capacity} نفره</span>
              {selectedTable.description && (
                <><span>·</span><span className="res-modal__desc">{selectedTable.description}</span></>
              )}
            </div>

            {/* محدودیت‌های رزرو */}
            <div className="res-modal__rules">
              <span className="res-modal__rule">
                <MdAccessTime size={13} />
                حداکثر {maxReservationHours} ساعت رزرو
              </span>
              {bookingDayOpenTime && (
                <span className="res-modal__rule">
                  <MdAccessTime size={13} />
                  فقط بین {bookingDayOpenTime} تا {closingTimeStr}
                </span>
              )}
              {isToday && (
                <span className="res-modal__rule">
                  <MdCalendarToday size={13} />
                  رزرو از {minStartTime} به بعد
                </span>
              )}
            </div>

            {selectedTable.reservations_today?.length > 0 && (
              <div className="res-modal__booked">
                <div className="res-modal__booked-title">
                  <MdEventBusy size={15} /> ساعات رزرو شده این میز:
                </div>
                <div className="res-modal__slots">
                  {selectedTable.reservations_today.map((s, i) => (
                    <span key={i} className="res-table-card__slot">
                      {s.start_time}–{s.end_time} ({s.guests_count} نفر)
                    </span>
                  ))}
                </div>
                <Timeline slots={selectedTable.reservations_today} dayStartH={bookingDayStartH} dayEndH={bookingDayCloseH} />
              </div>
            )}

            <div className="res-modal__fields">
              <TimePicker
                label="ساعت شروع *"
                value={bookForm.start_time}
                onChange={handleStartTimeChange}
                min={minStartTime}
                max={closingTimeStr}
                startHour={bookingDayStartH}
                endHour={bookingDayCloseH}
                placeholder="انتخاب ساعت شروع"
              />
              <TimePicker
                label="ساعت پایان *"
                value={bookForm.end_time}
                onChange={(val) => setBookForm((p) => ({ ...p, end_time: val }))}
                min={bookForm.start_time || undefined}
                max={maxEndTime}
                startHour={bookingDayStartH}
                endHour={bookingDayCloseH}
                placeholder="انتخاب ساعت پایان"
                disabled={!bookForm.start_time}
              />
            </div>

            <Textarea
              label="توضیحات (اختیاری)"
              value={bookForm.note}
              onChange={(e) => setBookForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="مثلاً: جشن تولد، بوکت گل لازم داریم..."
              rows={2}
            />
          </div>
        )}
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        isOpen={datePickerModal}
        onClose={() => setDatePickerModal(false)}
        title="انتخاب تاریخ"
        size="sm"
      >
        <PersianDatePicker
          inline
          value={date}
          min={today}
          onChange={(v) => { handleDateChange(v); setDatePickerModal(false) }}
        />
      </Modal>

      {/* My Reservations */}
      <div className="res-my-reservations">
        <h2 className="section-title">رزروهای من</h2>
        {loadingRes ? (
          <Loading text="" />
        ) : reservations.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📅</div>
            <h3>هنوز رزروی ندارید</h3>
          </div>
        ) : (
          <div className="reservation-list">
            {reservations.map((r) => {
              const canCancel = ['pending', 'confirmed'].includes(r.status) && r.date >= today
              return (
                <div key={r.id} className="reservation-item neu-card-sm">
                  <div className="reservation-item__info">
                    <div className="reservation-item__table">
                      <MdTableBar size={18} color="var(--primary)" />
                      میز {r.table_detail?.number}
                      {r.table_detail?.location && (
                        <span className="reservation-item__loc">
                          ({LOCATION_LABELS[r.table_detail.location]})
                        </span>
                      )}
                    </div>
                    <div className="reservation-item__detail">
                      <MdCalendarToday size={13} />
                      {formatJalali(r.date)}
                    </div>
                    <div className="reservation-item__detail">
                      <MdAccessTime size={13} />
                      {r.start_time?.slice(0, 5)} تا {r.end_time?.slice(0, 5)}
                    </div>
                    <div className="reservation-item__detail">
                      <MdPeople size={13} />
                      {r.guests_count} نفر
                    </div>
                    {r.note && (
                      <div className="reservation-item__note">{r.note}</div>
                    )}
                  </div>
                  <div className="reservation-item__right">
                    <span className={`status-badge ${getStatusClass(r.status)}`}>
                      {getStatusLabel(r.status)}
                    </span>
                    {canCancel && (
                      <button
                        className="res-cancel-btn"
                        disabled={cancelling === r.id}
                        onClick={() => handleCancel(r.id)}
                      >
                        {cancelling === r.id ? '...' : <><MdCancel size={13} /> لغو</>}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
