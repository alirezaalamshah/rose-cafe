import { useState, useEffect } from 'react'
import {
  MdAccessTime, MdEventBusy, MdAdd, MdDelete,
  MdSave, MdCalendarToday, MdCheckCircle, MdCancel,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { businessAPI } from '../../api/business.js'
import { confirm } from '../../store/confirmStore.js'
import { formatJalali } from '../../utils/jalali.js'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { Input } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import TimePicker from '../../components/common/TimePicker/TimePicker.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import './AdminOrdersPage.css'
import './AdminBusinessPage.css'

// JS getDay() returns 0=Sun, Python convention 0=Mon → (jsDay + 6) % 7
const todayPython = (new Date().getDay() + 6) % 7

// ترتیب نمایش هفته شمسی: شنبه(5)، یکشنبه(6)، دوشنبه(0)، سه‌شنبه(1)، چهارشنبه(2)، پنجشنبه(3)، جمعه(4)
const PERSIAN_WEEK_ORDER = [5, 6, 0, 1, 2, 3, 4]

const EMPTY_SPECIAL = {
  date: '',
  is_closed: true,
  open_time: '',
  close_time: '',
  note: '',
}

function DayRow({ day, onSaved }) {
  const [form, setForm] = useState({
    is_open: day.is_open,
    open_time: day.open_time ? day.open_time.slice(0, 5) : '',
    close_time: day.close_time ? day.close_time.slice(0, 5) : '',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        is_open: form.is_open,
        open_time: form.is_open && form.open_time ? form.open_time : null,
        close_time: form.is_open && form.close_time ? form.close_time : null,
      }
      await businessAPI.adminUpdateDay(day.day_of_week, payload)
      toast.success(`${day.day_name} ذخیره شد`)
      setDirty(false)
      onSaved()
    } catch {
      toast.error('خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  const isToday = day.day_of_week === todayPython

  return (
    <div className={`biz-day-card ${dirty ? 'biz-day-card--dirty' : ''}`}>
      <div className="biz-day-card__name">
        <span className={isToday ? 'day-name--today' : ''}>{day.day_name}</span>
        {isToday && <span className="day-today-dot" />}
      </div>

      <label className="biz-toggle">
        <input
          type="checkbox"
          checked={form.is_open}
          onChange={(e) => set('is_open', e.target.checked)}
        />
        <span className="biz-toggle__slider" />
        <span className={`biz-toggle__label ${form.is_open ? 'biz-toggle__label--open' : ''}`}>
          {form.is_open ? 'باز' : 'تعطیل'}
        </span>
      </label>

      <div className="biz-day-card__times">
        <TimePicker
          value={form.open_time}
          disabled={!form.is_open}
          onChange={(v) => set('open_time', v)}
          placeholder="باز شدن"
          startHour={0}
          endHour={23}
        />
        <span className="biz-day-card__times-sep">تا</span>
        <TimePicker
          value={form.close_time}
          disabled={!form.is_open}
          onChange={(v) => set('close_time', v)}
          placeholder="بسته شدن"
          startHour={0}
          endHour={23}
        />
      </div>

      <button
        className={`admin-action-btn biz-save-btn ${dirty ? 'biz-save-btn--dirty' : ''}`}
        onClick={save}
        disabled={saving || !dirty}
        title="ذخیره"
      >
        {saving ? '...' : <MdSave size={15} />}
      </button>
    </div>
  )
}

export default function AdminBusinessPage() {
  const [hours, setHours] = useState([])
  const [specialDays, setSpecialDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_SPECIAL)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      businessAPI.adminGetHours(),
      businessAPI.adminGetSpecialDays(),
    ])
      .then(([h, s]) => {
        const rawHours = Array.isArray(h) ? h : (h.results || [])
        const sorted = [...rawHours].sort(
          (a, b) => PERSIAN_WEEK_ORDER.indexOf(a.day_of_week) - PERSIAN_WEEK_ORDER.indexOf(b.day_of_week)
        )
        setHours(sorted)
        setSpecialDays(Array.isArray(s) ? s : (s.results || []))
      })
      .catch(() => toast.error('خطا در بارگذاری'))
      .finally(() => setLoading(false))
  }, [rev])

  function openAdd() {
    const today = new Date().toISOString().slice(0, 10)
    setForm({ ...EMPTY_SPECIAL, date: today })
    setModal(true)
  }

  function handleNoteChange(e) {
    setForm((p) => ({ ...p, note: e.target.value }))
  }

  async function handleSave() {
    if (!form.date) { toast.error('تاریخ الزامی است'); return }
    if (!form.is_closed && (!form.open_time || !form.close_time)) {
      toast.error('برای روز با ساعت خاص، ساعت باز و بسته شدن الزامی است')
      return
    }
    setSaving(true)
    try {
      const payload = {
        date: form.date,
        is_closed: form.is_closed,
        open_time: !form.is_closed ? form.open_time : null,
        close_time: !form.is_closed ? form.close_time : null,
        note: form.note,
      }
      const created = await businessAPI.adminCreateSpecialDay(payload)
      setSpecialDays((p) => [...p, created].sort((a, b) => a.date.localeCompare(b.date)))
      toast.success('روز خاص اضافه شد')
      setModal(false)
    } catch (err) {
      const errors = err.response?.data
      toast.error(errors ? Object.values(errors).flat().join(' — ') : 'خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!(await confirm('حذف این روز خاص؟', { title: 'حذف روز خاص' }))) return
    setDeleting(id)
    try {
      await businessAPI.adminDeleteSpecialDay(id)
      setSpecialDays((p) => p.filter((d) => d.id !== id))
      toast.success('روز خاص حذف شد')
    } catch {
      toast.error('خطا در حذف')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <Loading />

  return (
    <div>
      {/* ===== WEEKLY HOURS ===== */}
      <div className="page-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <h1>
          <MdAccessTime size={24} style={{ marginLeft: 8, verticalAlign: 'middle', color: 'var(--primary)' }} />
          ساعات کاری
        </h1>
      </div>

      <div className="biz-section neu-card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="biz-section__header">
          <span>ساعات کاری هفتگی</span>
          <span className="biz-section__hint">پس از تغییر هر ردیف دکمه ذخیره آن را کلیک کنید</span>
        </div>

        <div className="biz-hours-list">
          {hours.length === 0 ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
              ساعت کاری تعریف نشده — داده اولیه را از پنل جنگو وارد کنید
            </div>
          ) : (
            hours.map((day) => (
              <DayRow key={day.day_of_week} day={day} onSaved={() => setRev((v) => v + 1)} />
            ))
          )}
        </div>
      </div>

      {/* ===== SPECIAL DAYS ===== */}
      <div className="admin-page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MdEventBusy size={22} color="var(--primary)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>روزهای خاص</h2>
        </div>
        <Button onClick={openAdd} size="sm">
          <MdAdd size={16} /> افزودن روز خاص
        </Button>
      </div>

      <div className="admin-orders__table-wrap">
        {specialDays.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📅</div>
            <h3>روز خاصی ثبت نشده</h3>
            <p>تعطیلات رسمی یا روزهای با ساعت غیر معمول را اضافه کنید</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>وضعیت</th>
                <th>ساعت باز</th>
                <th>ساعت بسته</th>
                <th>توضیحات</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {specialDays.map((d) => {
                const isPast = new Date(d.date) < new Date(new Date().toDateString())
                return (
                  <tr key={d.id} className={isPast ? 'row--past' : ''}>
                    <td data-label="تاریخ">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MdCalendarToday size={14} color="var(--text-muted)" />
                        <span style={{ fontWeight: 600 }}>{formatJalali(d.date)}</span>
                        {isPast && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(گذشته)</span>}
                      </div>
                    </td>
                    <td data-label="وضعیت">
                      {d.is_closed ? (
                        <span className="biz-badge biz-badge--closed">
                          <MdCancel size={13} /> تعطیل
                        </span>
                      ) : (
                        <span className="biz-badge biz-badge--special">
                          <MdCheckCircle size={13} /> ساعت خاص
                        </span>
                      )}
                    </td>
                    <td data-label="ساعت باز" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      <span dir="ltr">{d.open_time ? d.open_time.slice(0, 5) : '—'}</span>
                    </td>
                    <td data-label="ساعت بسته" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      <span dir="ltr">{d.close_time ? d.close_time.slice(0, 5) : '—'}</span>
                    </td>
                    <td data-label="توضیحات" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.note || '—'}
                    </td>
                    <td className="td-actions">
                      <button
                        className="admin-action-btn"
                        style={{ background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--error)' }}
                        onClick={() => handleDelete(d.id)}
                        disabled={deleting === d.id}
                      >
                        <MdDelete size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== ADD MODAL ===== */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="افزودن روز خاص"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>انصراف</Button>
            <Button onClick={handleSave} loading={saving}>ذخیره</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <PersianDatePicker
            label="تاریخ *"
            value={form.date}
            onChange={(v) => setForm((p) => ({ ...p, date: v }))}
          />

          <label className="biz-modal-toggle">
            <input
              type="checkbox"
              checked={form.is_closed}
              onChange={(e) => setForm((p) => ({ ...p, is_closed: e.target.checked }))}
            />
            <span className="biz-toggle__slider" />
            <span style={{ fontWeight: 600, color: form.is_closed ? 'var(--error)' : 'var(--success)' }}>
              {form.is_closed ? 'روز تعطیل — کافه کاملاً بسته است' : 'ساعت کاری خاص — کافه باز است'}
            </span>
          </label>

          {!form.is_closed && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <TimePicker
                label="ساعت باز شدن *"
                value={form.open_time}
                onChange={(v) => setForm((p) => ({ ...p, open_time: v }))}
                placeholder="انتخاب ساعت"
                startHour={0}
                endHour={23}
              />
              <TimePicker
                label="ساعت بسته شدن *"
                value={form.close_time}
                onChange={(v) => setForm((p) => ({ ...p, close_time: v }))}
                placeholder="انتخاب ساعت"
                startHour={0}
                endHour={23}
              />
            </div>
          )}

          <Input
            label="توضیحات (اختیاری)"
            name="note"
            value={form.note}
            onChange={handleNoteChange}
            placeholder="مثلاً: تعطیلات نوروز"
          />
        </div>
      </Modal>
    </div>
  )
}
