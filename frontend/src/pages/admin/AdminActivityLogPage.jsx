import { useState, useEffect, useCallback } from 'react'
import { MdRefresh, MdCalendarToday } from 'react-icons/md'
import { staffActivityAPI } from '../../api/staffActivity.js'
import Modal from '../../components/common/Modal/Modal.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice } from '../../utils/helpers.js'
import { formatJalali } from '../../utils/jalali.js'
import './AdminOrdersPage.css'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PRESETS = [
  { label: 'امروز', from: () => todayIso(), to: () => todayIso() },
  { label: '۷ روز اخیر', from: () => daysAgoIso(6), to: () => todayIso() },
  { label: '۳۰ روز اخیر', from: () => daysAgoIso(29), to: () => todayIso() },
]

function formatMinutes(m) {
  if (m === null || m === undefined) return '—'
  if (m < 60) return `${Math.round(m)} دقیقه`
  const hours = Math.floor(m / 60)
  const minutes = Math.round(m % 60)
  return minutes > 0 ? `${hours} ساعت و ${minutes} دقیقه` : `${hours} ساعت`
}

export default function AdminActivityLogPage() {
  const [dateFrom, setDateFrom] = useState(daysAgoIso(6))
  const [dateTo, setDateTo] = useState(todayIso())
  const [pickerModal, setPickerModal] = useState(null) // 'from' | 'to' | null
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(() => {
    setLoading(true)
    staffActivityAPI.getReport({ from: dateFrom, to: dateTo })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  return (
    <div>
      <div className="page-header">
        <h1>عملکرد گارسون‌ها</h1>
        <p>گزارش تجمیعی تأیید/رد سفارش، وجوه وصول‌شده و سرعت تحویل — به تفکیک گارسون</p>
      </div>

      <div className="admin-orders__filters">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`admin-orders__view-btn ${dateFrom === p.from() && dateTo === p.to() ? 'active' : ''}`}
            onClick={() => { setDateFrom(p.from()); setDateTo(p.to()) }}
          >
            {p.label}
          </button>
        ))}

        <button className="admin-orders__archive-jump-btn admin-orders__archive-jump-btn--wide" onClick={() => setPickerModal('from')}>
          <MdCalendarToday size={16} /> از {formatJalali(dateFrom)}
        </button>
        <button className="admin-orders__archive-jump-btn admin-orders__archive-jump-btn--wide" onClick={() => setPickerModal('to')}>
          <MdCalendarToday size={16} /> تا {formatJalali(dateTo)}
        </button>

        <button className="admin-orders__refresh" onClick={fetchReport}>
          <MdRefresh size={18} /> بروزرسانی
        </button>
      </div>

      <Modal
        isOpen={!!pickerModal}
        onClose={() => setPickerModal(null)}
        title={pickerModal === 'from' ? 'از تاریخ' : 'تا تاریخ'}
        size="sm"
      >
        <PersianDatePicker
          inline
          value={pickerModal === 'from' ? dateFrom : dateTo}
          onChange={(v) => {
            if (pickerModal === 'from') setDateFrom(v)
            else setDateTo(v)
            setPickerModal(null)
          }}
        />
      </Modal>

      {loading ? <Loading /> : (
        <div className="admin-orders__table-wrap">
          {rows.length === 0 ? (
            <div className="empty-state"><div className="icon">📋</div><h3>گارسونی یافت نشد</h3></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>گارسون</th>
                  <th>تأیید شده</th>
                  <th>رد شده</th>
                  <th>نقدی وصول‌شده</th>
                  <th>آنلاین وصول‌شده</th>
                  <th>میانگین تأیید تا تحویل</th>
                  <th>سفارش‌های جاری الان</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.waiter_id}>
                    <td data-label="گارسون">{row.waiter_name}</td>
                    <td data-label="تأیید شده">{row.approved_count}</td>
                    <td data-label="رد شده">{row.rejected_count}</td>
                    <td data-label="نقدی وصول‌شده">{formatPrice(row.cash_collected)}</td>
                    <td data-label="آنلاین وصول‌شده">{formatPrice(row.online_collected)}</td>
                    <td data-label="میانگین تأیید تا تحویل">{formatMinutes(row.avg_delivery_minutes)}</td>
                    <td data-label="سفارش‌های جاری الان">{row.current_active_orders}</td>
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
