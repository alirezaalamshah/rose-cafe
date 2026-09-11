import { useState, useEffect } from 'react'
import { MdTableBar, MdToggleOn, MdToggleOff, MdPeople } from 'react-icons/md'
import toast from 'react-hot-toast'
import { waiterAPI } from '../../api/waiter.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import { confirm } from '../../store/confirmStore.js'
import './WaiterTablesPage.css'

const LOCATIONS = { indoor: 'داخل کافه', outdoor: 'فضای باز', vip: 'VIP' }

export default function WaiterTablesPage() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  useEffect(() => {
    waiterAPI.getTables()
      .then((data) => setTables(Array.isArray(data) ? data : (data?.results || [])))
      .catch(() => toast.error('خطا در بارگذاری میزها'))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(table) {
    // فعال‌کردن بی‌خطر است، اما غیرفعال‌کردن ممکن است میزی را که هم‌اکنون درگیر
    // سرویس یا نزدیک به یک رزرو است از دسترس خارج کند — نیاز به تأیید صریح دارد
    if (table.is_active) {
      if (!(await confirm(
        `میز ${table.number} غیرفعال شود؟ تا فعال‌سازی مجدد، برای رزرو/سرو در دسترس نخواهد بود.`,
        { title: 'غیرفعال کردن میز', confirmLabel: 'غیرفعال کن', danger: true },
      ))) return
    }
    setToggling(table.id)
    try {
      const updated = await waiterAPI.updateTable(table.id, { is_active: !table.is_active })
      setTables((prev) => prev.map((t) => t.id === table.id ? updated : t))
      toast.success(updated.is_active ? 'میز فعال شد' : 'میز غیرفعال شد')
    } catch {
      toast.error('خطا در تغییر وضعیت میز')
    } finally {
      setToggling(null)
    }
  }

  if (loading) return <Loading />

  const active = tables.filter((t) => t.is_active).length

  return (
    <div className="waiter-tables">
      <div className="waiter-page-header">
        <h1>میزها</h1>
        <span className="waiter-tables__summary">{active} فعال از {tables.length}</span>
      </div>

      {tables.length === 0 ? (
        <div className="empty-state"><div className="icon">🪑</div><h3>میزی تعریف نشده</h3></div>
      ) : (
        <div className="waiter-tables__grid">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`waiter-table-card ${!table.is_active ? 'waiter-table-card--inactive' : ''}`}
            >
              <div className="waiter-table-card__stripe" />
              <div className="waiter-table-card__body">
                <div className="waiter-table-card__header">
                  <MdTableBar size={22} className="waiter-table-card__icon" />
                  <span className="waiter-table-card__num">میز {table.number}</span>
                  <span className={`status-badge ${table.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
                    {table.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>

                <div className="waiter-table-card__info">
                  <span className="waiter-table-card__capacity"><MdPeople size={14} /> {table.capacity} نفره</span>
                  <span className="waiter-table-card__loc">{LOCATIONS[table.location] || table.location}</span>
                </div>

                {table.description && <p className="waiter-table-card__desc">{table.description}</p>}
              </div>

              <button
                className={`waiter-action-btn waiter-table-card__toggle ${table.is_active ? 'waiter-action-btn--accent' : 'waiter-action-btn--filled'}`}
                onClick={() => handleToggle(table)}
                disabled={toggling === table.id}
              >
                {toggling === table.id ? <span className="waiter-btn-spinner" /> : table.is_active
                  ? <><MdToggleOff size={16} /> غیرفعال کردن</>
                  : <><MdToggleOn size={16} /> فعال کردن</>
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
