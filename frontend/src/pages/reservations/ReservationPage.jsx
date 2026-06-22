import { useState, useEffect } from 'react'
import { MdTableBar, MdCalendarToday, MdPeople, MdAccessTime } from 'react-icons/md'
import toast from 'react-hot-toast'
import { reservationsAPI } from '../../api/reservations.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea, Select } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatDate, formatTime, getStatusLabel, getStatusClass } from '../../utils/helpers.js'
import './ReservationPage.css'

const LOCATION_ICONS = { indoor: '🏠', outdoor: '🌳', vip: '👑' }
const LOCATION_LABELS = { indoor: 'داخل کافه', outdoor: 'فضای باز', vip: 'VIP' }

export default function ReservationPage() {
  const [step, setStep] = useState('form')
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTable, setSelectedTable] = useState(null)
  const [form, setForm] = useState({
    date: '',
    start_time: '',
    end_time: '',
    guests_count: '',
    note: '',
  })

  useEffect(() => {
    setLoading(true)
    reservationsAPI.getReservations()
      .then((data) => {
        const results = Array.isArray(data) ? data : (data.results || [])
        setReservations(results)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleFormChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSearchTables(e) {
    e.preventDefault()
    if (!form.date || !form.start_time || !form.end_time || !form.guests_count) {
      toast.error('لطفاً تمام فیلدها را پر کنید')
      return
    }
    if (form.start_time >= form.end_time) {
      toast.error('ساعت پایان باید بعد از ساعت شروع باشد')
      return
    }
    setLoadingTables(true)
    try {
      const data = await reservationsAPI.getAvailableTables({
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        guests_count: form.guests_count,
      })
      const results = Array.isArray(data) ? data : (data.results || [])
      setTables(results)
      setStep('tables')
    } catch {
      toast.error('خطا در جستجوی میزها')
    } finally {
      setLoadingTables(false)
    }
  }

  async function handleSubmit() {
    if (!selectedTable) {
      toast.error('لطفاً یک میز انتخاب کنید')
      return
    }
    setSubmitting(true)
    try {
      await reservationsAPI.createReservation({
        table: selectedTable.id,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        guests_count: Number(form.guests_count),
        note: form.note,
      })
      toast.success('رزرو با موفقیت ثبت شد!')
      const data = await reservationsAPI.getReservations()
      setReservations(Array.isArray(data) ? data : (data.results || []))
      setStep('form')
      setForm({ date: '', start_time: '', end_time: '', guests_count: '', note: '' })
      setSelectedTable(null)
      setTables([])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در ثبت رزرو')
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="reservation-page">
      <div className="page-header">
        <h1>رزرو میز</h1>
        <p>میز مورد نظر خود را برای تاریخ و ساعت دلخواه رزرو کنید</p>
      </div>

      {step === 'form' && (
        <div className="reservation-form-card neu-card">
          <h2 className="section-title">
            <MdCalendarToday color="var(--primary)" />
            اطلاعات رزرو
          </h2>
          <form className="reservation-form" onSubmit={handleSearchTables}>
            <Input
              label="تاریخ"
              name="date"
              type="date"
              value={form.date}
              min={today}
              onChange={handleFormChange}
              required
            />
            <Input
              label="تعداد نفرات"
              name="guests_count"
              type="number"
              min={1}
              max={20}
              value={form.guests_count}
              onChange={handleFormChange}
              iconLeft={<MdPeople size={18} />}
              required
              placeholder="مثلاً: ۲"
            />
            <Input
              label="ساعت شروع"
              name="start_time"
              type="time"
              value={form.start_time}
              onChange={handleFormChange}
              iconLeft={<MdAccessTime size={18} />}
              required
            />
            <Input
              label="ساعت پایان"
              name="end_time"
              type="time"
              value={form.end_time}
              onChange={handleFormChange}
              iconLeft={<MdAccessTime size={18} />}
              required
            />
            <div className="reservation-form__full">
              <Textarea
                label="توضیحات (اختیاری)"
                name="note"
                value={form.note}
                onChange={handleFormChange}
                placeholder="مثلاً: جشن تولد، بوکت گل لازم داریم..."
                rows={3}
              />
            </div>
            <div className="reservation-form__actions">
              <Button type="submit" loading={loadingTables} size="lg">
                <MdTableBar size={18} />
                جستجوی میز
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === 'tables' && (
        <div>
          <div className="tables-section">
            <h2 className="section-title">
              <MdTableBar color="var(--primary)" />
              میزهای موجود
            </h2>
            {tables.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🪑</div>
                <h3>میزی در این بازه زمانی موجود نیست</h3>
                <p style={{ marginTop: 8, marginBottom: 16 }}>تاریخ یا ساعت دیگری را امتحان کنید</p>
                <Button variant="secondary" onClick={() => setStep('form')}>
                  تغییر جستجو
                </Button>
              </div>
            ) : (
              <>
                <div className="tables-grid">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className={`table-card ${selectedTable?.id === table.id ? 'selected' : ''}`}
                      onClick={() => setSelectedTable(table)}
                    >
                      <div className="table-card__icon">
                        {LOCATION_ICONS[table.location] || '🪑'}
                      </div>
                      <div className="table-card__number">میز {table.number}</div>
                      <div className="table-card__capacity">{table.capacity} نفره</div>
                      <span className="table-card__location">
                        {LOCATION_LABELS[table.location] || table.location}
                      </span>
                    </div>
                  ))}
                </div>

                {selectedTable && (
                  <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => setStep('form')}>تغییر</Button>
                    <Button onClick={handleSubmit} loading={submitting} size="lg">
                      ثبت رزرو میز {selectedTable.number}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div>
        <h2 className="section-title">رزروهای من</h2>
        {loading ? (
          <Loading text="" />
        ) : reservations.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📅</div>
            <h3>هنوز رزروی ندارید</h3>
          </div>
        ) : (
          <div className="reservation-list">
            {reservations.map((r) => (
              <div key={r.id} className="reservation-item neu-card-sm">
                <div className="reservation-item__info">
                  <div className="reservation-item__table">
                    <MdTableBar size={18} color="var(--primary)" />
                    میز {r.table?.number}
                    {r.table?.location && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ({LOCATION_LABELS[r.table.location]})
                      </span>
                    )}
                  </div>
                  <div className="reservation-item__detail">
                    <MdCalendarToday size={14} />
                    {formatDate(r.date)}
                  </div>
                  <div className="reservation-item__detail">
                    <MdAccessTime size={14} />
                    {formatTime(r.start_time)} تا {formatTime(r.end_time)}
                  </div>
                  <div className="reservation-item__detail">
                    <MdPeople size={14} />
                    {r.guests_count} نفر
                  </div>
                </div>
                <span className={`status-badge ${getStatusClass(r.status)}`}>
                  {getStatusLabel(r.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
