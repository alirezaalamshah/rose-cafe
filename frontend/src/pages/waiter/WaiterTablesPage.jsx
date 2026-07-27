import { useState, useEffect } from 'react'
import { MdTableBar, MdToggleOn, MdToggleOff } from 'react-icons/md'
import toast from 'react-hot-toast'
import { waiterAPI } from '../../api/waiter.js'
import Loading from '../../components/common/Loading/Loading.jsx'
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
              className={`waiter-table-card neu-card-sm ${!table.is_active ? 'waiter-table-card--inactive' : ''}`}
            >
              <div className="waiter-table-card__header">
                <MdTableBar size={24} color={table.is_active ? 'var(--primary)' : 'var(--text-muted)'} />
                <span className="waiter-table-card__num">میز {table.number}</span>
                <span className={`status-badge ${table.is_active ? 'status-confirmed' : 'status-cancelled'}`} style={{ fontSize: '0.7rem' }}>
                  {table.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>

              <div className="waiter-table-card__info">
                <span>{table.capacity} نفره</span>
                <span className="waiter-table-card__loc">{LOCATIONS[table.location] || table.location}</span>
              </div>

              {table.description && <p className="waiter-table-card__desc">{table.description}</p>}

              <button
                className={`waiter-action-btn ${table.is_active ? 'waiter-action-btn--warning' : 'waiter-action-btn--success'}`}
                style={{ width: '100%', marginTop: 'var(--space-sm)' }}
                onClick={() => handleToggle(table)}
                disabled={toggling === table.id}
              >
                {toggling === table.id ? '...' : table.is_active
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
