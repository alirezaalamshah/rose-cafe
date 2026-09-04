import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { MdRefresh, MdCalendarToday, MdCategory, MdDownload } from 'react-icons/md'
import { ordersAPI } from '../../api/orders.js'
import Modal from '../../components/common/Modal/Modal.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice } from '../../utils/helpers.js'
import { formatJalali } from '../../utils/jalali.js'
import { downloadCSV } from '../../utils/csv.js'
import './AdminOrdersPage.css'
import './AdminCategorySalesPage.css'

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

export default function AdminCategorySalesPage() {
  const [dateFrom, setDateFrom] = useState(todayIso())
  const [dateTo, setDateTo] = useState(todayIso())
  const [pickerModal, setPickerModal] = useState(null) // 'from' | 'to' | null
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showZeroSales, setShowZeroSales] = useState(true)

  const fetchReport = useCallback(() => {
    setLoading(true)
    ordersAPI.adminGetCategorySalesReport({ from: dateFrom, to: dateTo })
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  const visibleCategories = useMemo(() => {
    if (showZeroSales) return categories
    return categories
      .map((cat) => ({ ...cat, items: cat.items.filter((i) => i.quantity > 0) }))
      .filter((cat) => cat.items.length > 0)
  }, [categories, showZeroSales])

  const zeroSaleCount = useMemo(
    () => categories.reduce((s, c) => s + c.items.filter((i) => i.quantity === 0).length, 0),
    [categories]
  )

  const grandTotal = categories.reduce((s, c) => s + c.total_amount, 0)

  function handleExportCsv() {
    const rows = []
    visibleCategories.forEach((cat) => {
      rows.push([cat.category_name, '', cat.total_quantity, cat.total_amount])
      cat.items.forEach((item) => {
        rows.push(['', item.item_name, item.quantity, item.amount])
      })
    })
    downloadCSV(
      `فروش-دسته‌بندی‌ها-${dateFrom}-تا-${dateTo}`,
      ['دسته‌بندی', 'آیتم', 'تعداد', 'مبلغ (تومان)'],
      rows,
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>فروش دسته‌بندی‌ها و آیتم‌ها</h1>
        <p>فروش هر آیتم منو به تفکیک دسته‌بندی — شامل آیتم‌هایی که هیچ فروشی نداشته‌اند — مناسب برای تسویه با تأمین‌کنندگان بیرونی</p>
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
        <button className="admin-orders__refresh" onClick={handleExportCsv} disabled={visibleCategories.length === 0}>
          <MdDownload size={18} /> دانلود CSV
        </button>
      </div>

      <label className="admin-category-sales__toggle">
        <input
          type="checkbox"
          checked={showZeroSales}
          onChange={(e) => setShowZeroSales(e.target.checked)}
        />
        <span>نمایش آیتم‌های بدون فروش {zeroSaleCount > 0 ? `(${zeroSaleCount} مورد)` : ''}</span>
      </label>

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
          {visibleCategories.length === 0 ? (
            <div className="empty-state"><div className="icon">📊</div><h3>آیتمی برای نمایش نیست</h3></div>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>دسته‌بندی / آیتم</th>
                    <th>تعداد</th>
                    <th>مبلغ کل</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCategories.map((cat) => (
                    <Fragment key={cat.category_id}>
                      <tr className="admin-table__group-header">
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <MdCategory size={14} color="var(--primary)" /> {cat.category_name}
                          </span>
                        </td>
                        <td data-label="جمع تعداد" style={{ fontWeight: 700 }}>{cat.total_quantity}</td>
                        <td data-label="جمع مبلغ" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {formatPrice(cat.total_amount)}
                        </td>
                      </tr>
                      {cat.items.map((item) => {
                        const noSales = item.quantity === 0
                        return (
                          <tr key={item.item_id} className={noSales ? 'admin-category-sales__row--zero' : ''}>
                            <td data-label="آیتم" style={{ paddingRight: 'var(--space-lg)' }}>
                              {item.item_name}
                              {noSales && <span className="admin-category-sales__zero-tag">بدون فروش</span>}
                            </td>
                            <td data-label="تعداد">{item.quantity}</td>
                            <td data-label="مبلغ کل">{formatPrice(item.amount)}</td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <div className="admin-category-sales__grand-total">
                جمع کل همه‌ی دسته‌بندی‌ها: <strong>{formatPrice(grandTotal)}</strong>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
