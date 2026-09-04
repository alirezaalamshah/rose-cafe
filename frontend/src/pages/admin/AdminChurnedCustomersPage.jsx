import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdEventBusy, MdVisibility } from 'react-icons/md'
import { usersAPI } from '../../api/users.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, getTierMeta } from '../../utils/helpers.js'
import { formatJalali, toPersianNum } from '../../utils/jalali.js'
import './AdminOrdersPage.css'
import './AdminUsersPage.css'

function daysSince(isoDate) {
  if (!isoDate) return null
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return null
  const diffMs = Date.now() - then.getTime()
  return Math.floor(diffMs / 86400000)
}

export default function AdminChurnedCustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState(null)

  useEffect(() => {
    usersAPI.adminGetChurnedCustomers()
      .then((data) => setCustomers(Array.isArray(data) ? data : (data.results || [])))
  }, [])

  if (customers === null) return <Loading />

  return (
    <div>
      <div className="page-header">
        <h1>مشتریان در معرض ریزش</h1>
        <p>مشتریانی که قبلاً چند سفارش واقعی داشته‌اند ولی بیش از ۲۱ روز است سفارشی نداده‌اند — فرصت خوبی برای یادآوری یا کد تخفیف اختصاصی</p>
      </div>

      {customers.length === 0 ? (
        <div className="empty-state"><div className="icon">🎉</div><h3>در حال حاضر مشتری‌ای در معرض ریزش نیست</h3></div>
      ) : (
        <div className="admin-orders__table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>نام</th>
                <th>تلفن</th>
                <th>سطح</th>
                <th>تعداد سفارش</th>
                <th>جمع خرید</th>
                <th>آخرین سفارش</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const tier = getTierMeta(c.tier)
                const days = daysSince(c.last_order_at)
                return (
                  <tr key={c.id}>
                    <td data-label="نام" style={{ color: 'var(--text-primary)' }}>{c.full_name || '—'}</td>
                    <td data-label="تلفن"><span dir="ltr">{c.phone}</span></td>
                    <td data-label="سطح"><span className={`tier-badge ${tier.cls}`}>{tier.label}</span></td>
                    <td data-label="تعداد سفارش">{c.orders_count}</td>
                    <td data-label="جمع خرید">{formatPrice(c.total_spent)}</td>
                    <td data-label="آخرین سفارش">
                      {days === null ? '—' : (
                        <span style={{ color: days > 45 ? 'var(--error)' : 'var(--warning)' }}>
                          {formatJalali(c.last_order_at)} ({toPersianNum(days)} روز پیش)
                        </span>
                      )}
                    </td>
                    <td className="td-actions">
                      <button
                        className="admin-action-btn admin-action-btn--info"
                        onClick={() => navigate(`/admin/users/${c.id}`)}
                      >
                        <MdVisibility size={14} /> جزئیات
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
