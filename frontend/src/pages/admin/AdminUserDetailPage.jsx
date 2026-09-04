import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  MdArrowForward, MdPerson, MdPhone, MdEmail, MdCake, MdShoppingBag,
  MdPayments, MdTrendingUp, MdAccountBalanceWallet, MdLocalOffer,
  MdTableBar, MdRateReview, MdEventBusy, MdMale, MdFemale, MdLocationOn,
  MdDownload, MdEdit, MdSave, MdTune,
} from 'react-icons/md'
import { usersAPI } from '../../api/users.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import { formatPrice, getStatusClass, getTierMeta } from '../../utils/helpers.js'
import { formatJalali } from '../../utils/jalali.js'
import { downloadCSV } from '../../utils/csv.js'
import './AdminOrdersPage.css'
import './AdminUserDetailPage.css'

const TABS = [
  { key: 'summary', label: 'خلاصه' },
  { key: 'orders', label: 'سفارش‌ها' },
  { key: 'wallet', label: 'کیف‌پول' },
  { key: 'discounts', label: 'تخفیف‌ها' },
  { key: 'reservations', label: 'رزروها' },
  { key: 'reviews', label: 'نظرات' },
]

const WALLET_TX_LABELS = {
  topup: { label: 'شارژ', cls: 'status-confirmed' },
  cashback: { label: 'بازگشت وجه', cls: 'status-confirmed' },
  order_payment: { label: 'پرداخت سفارش', cls: 'status-cancelled' },
  admin_adjustment: { label: 'تنظیم دستی', cls: 'status-pending' },
}

function toArray(data) {
  if (Array.isArray(data)) return data
  return data?.results || []
}

/** لیست‌های تب‌های جزئیات مشتری — با «بارگذاری بیشتر» (نه گرفتن همه یک‌جا)،
 * چون تاریخچه‌ی یک مشتری خیلی فعال می‌تواند از ۵۰ ردیف پیش‌فرض بیشتر باشد. */
function usePaginatedTab(fetchFn, userId) {
  const [items, setItems] = useState(null)
  const [nextPage, setNextPage] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadPage = useCallback((page) => {
    const isFirst = page === 1
    if (!isFirst) setLoadingMore(true)
    return fetchFn(userId, { page }).then((data) => {
      const results = toArray(data)
      const hasNext = !Array.isArray(data) && !!data.next
      setItems((prev) => (isFirst ? results : [...(prev || []), ...results]))
      setNextPage(hasNext ? page + 1 : null)
    }).finally(() => { if (!isFirst) setLoadingMore(false) })
  }, [fetchFn, userId])

  useEffect(() => { setItems(null); setNextPage(null); loadPage(1) }, [userId])

  return { items, hasMore: nextPage !== null, loadingMore, loadMore: () => loadPage(nextPage) }
}

/** برای دانلود CSV — همه‌ی صفحات را (نه فقط آنچه در صفحه بارگذاری شده) جمع می‌کند. */
async function fetchAllPages(fetchFn, userId) {
  let page = 1
  let all = []
  while (page) {
    const data = await fetchFn(userId, { page })
    all = all.concat(toArray(data))
    page = !Array.isArray(data) && data.next ? page + 1 : null
  }
  return all
}

function LoadMoreButton({ hasMore, loadingMore, onClick }) {
  if (!hasMore) return null
  return (
    <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
      <Button variant="secondary" size="sm" loading={loadingMore} onClick={onClick}>بارگذاری بیشتر</Button>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="user-detail-kpi neu-card-sm">
      <Icon size={20} style={{ color, flexShrink: 0 }} />
      <div>
        <p className="user-detail-kpi__label">{label}</p>
        <p className="user-detail-kpi__value" style={{ color }}>{value}</p>
      </div>
    </div>
  )
}

function AdminNoteBox({ userId, initialNote }) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(initialNote || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setNote(initialNote || '') }, [initialNote])

  async function handleSave() {
    setSaving(true)
    try {
      await usersAPI.adminUpdateUser(userId, { admin_note: note })
      toast.success('یادداشت ذخیره شد')
      setEditing(false)
    } catch {
      toast.error('خطا در ذخیره یادداشت')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="user-detail-note-box neu-card">
      <div className="dash-card__head">
        <span className="dash-card__title">یادداشت داخلی (فقط برای کارکنان)</span>
        {!editing && (
          <button className="dash-card__more" onClick={() => setEditing(true)}>
            <MdEdit size={14} /> ویرایش
          </button>
        )}
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثلاً: حساسیت غذایی دارد، همیشه دیر لغو می‌کند..."
            rows={3}
          />
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <Button size="sm" loading={saving} onClick={handleSave}><MdSave size={14} /> ذخیره</Button>
            <Button size="sm" variant="ghost" onClick={() => { setNote(initialNote || ''); setEditing(false) }}>انصراف</Button>
          </div>
        </div>
      ) : (
        <p className="user-detail-note-box__text">{note || 'یادداشتی ثبت نشده'}</p>
      )}
    </div>
  )
}

function SummaryTab({ summary, userId }) {
  if (!summary) return <Loading />
  const p = summary.profile
  const tier = getTierMeta(summary.tier)
  return (
    <div>
      <div className="user-detail-profile neu-card">
        <div className={`user-detail-profile__avatar ${p.gender === 'male' ? 'user-detail-profile__avatar--male' : p.gender === 'female' ? 'user-detail-profile__avatar--female' : ''}`}>
          {p.gender === 'male' ? <MdMale size={28} /> : p.gender === 'female' ? <MdFemale size={28} /> : <MdPerson size={28} />}
        </div>
        <div className="user-detail-profile__info">
          <h2>
            {p.full_name || 'بدون نام'}
            <span className={`tier-badge ${tier.cls}`} style={{ marginRight: 8, verticalAlign: 'middle' }}>{tier.label}</span>
          </h2>
          <div className="user-detail-profile__row"><MdPhone size={14} /> <span dir="ltr">{p.phone}</span></div>
          {p.email && <div className="user-detail-profile__row"><MdEmail size={14} /> {p.email}</div>}
          {p.birthday && <div className="user-detail-profile__row"><MdCake size={14} /> {formatJalali(p.birthday)}</div>}
          <div className="user-detail-profile__row">عضویت از {formatJalali(p.date_joined)}</div>
        </div>
      </div>

      <div className="user-detail-kpi-grid">
        <SummaryCard label="تعداد سفارش" value={summary.orders_count} icon={MdShoppingBag} color="var(--primary)" />
        <SummaryCard label="جمع کل خرید" value={formatPrice(summary.total_spent)} icon={MdPayments} color="var(--success)" />
        <SummaryCard label="میانگین سفارش" value={formatPrice(summary.avg_order)} icon={MdTrendingUp} color="var(--accent)" />
        <SummaryCard label="موجودی کیف‌پول" value={formatPrice(summary.wallet_balance)} icon={MdAccountBalanceWallet} color="var(--primary)" />
        <SummaryCard label="جمع تخفیف گرفته‌شده" value={formatPrice(summary.total_discount_used)} icon={MdLocalOffer} color="var(--warning)" />
        <SummaryCard label="تعداد رزرو" value={summary.reservations_count} icon={MdTableBar} color="var(--accent)" />
        <SummaryCard label="نرخ عدم‌حضور" value={`${summary.reservation_no_show_rate}٪`} icon={MdEventBusy} color={summary.reservation_no_show_rate > 15 ? 'var(--error)' : 'var(--text-muted)'} />
        <SummaryCard label="تعداد نظرات" value={summary.reviews_count} icon={MdRateReview} color="var(--text-secondary)" />
      </div>

      {summary.last_order_at && (
        <p className="user-detail-note">آخرین سفارش: {formatJalali(summary.last_order_at)}</p>
      )}

      <AdminNoteBox userId={userId} initialNote={p.admin_note} />
    </div>
  )
}

function OrderDetailModal({ order, onClose }) {
  if (!order) return null
  return (
    <Modal isOpen={!!order} onClose={onClose} title={`سفارش #${order.order_number || order.id}`} size="md">
      <div className="user-detail-order-modal">
        <div className="user-detail-order-modal__meta">
          <span className={`status-badge ${getStatusClass(order.status)}`}>{order.status_display}</span>
          <span>{order.delivery_type_display}</span>
          {order.delivery_type === 'dine_in' && order.table_detail?.number && <span>میز {order.table_detail.number}</span>}
          <span>{formatJalali(order.created_at)}</span>
        </div>

        {order.delivery_type === 'delivery' && order.address_detail && (
          <div className="user-detail-order-modal__address">
            <MdLocationOn size={15} />
            {order.address_detail.province && `${order.address_detail.province}، `}
            {order.address_detail.city} — {order.address_detail.street}
            {order.address_detail.detail && ` (${order.address_detail.detail})`}
          </div>
        )}

        <div className="user-detail-order-modal__items">
          {order.items?.map((item) => (
            <div key={item.id} className="user-detail-order-modal__item">
              <div>
                <span className="user-detail-order-modal__item-name">{item.menu_item_detail?.name || '—'}</span>
                {item.variant_name && <span className="user-detail-order-modal__item-sub"> ({item.variant_name})</span>}
                {item.addons?.length > 0 && (
                  <span className="user-detail-order-modal__item-sub"> + {item.addons.map((a) => a.name).join('، ')}</span>
                )}
              </div>
              <span className="user-detail-order-modal__item-qty">×{item.quantity}</span>
              <span className="user-detail-order-modal__item-price">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {order.note && <p className="user-detail-order-modal__note">یادداشت: {order.note}</p>}

        <div className="user-detail-order-modal__totals">
          <div><span>جمع اقلام</span><span>{formatPrice(order.total_price)}</span></div>
          {order.delivery_cost > 0 && <div><span>هزینه ارسال</span><span>{formatPrice(order.delivery_cost)}</span></div>}
          {order.packaging_cost > 0 && <div><span>هزینه بسته‌بندی</span><span>{formatPrice(order.packaging_cost)}</span></div>}
          {order.discount_amount > 0 && <div><span>تخفیف ({order.discount_code})</span><span>−{formatPrice(order.discount_amount)}</span></div>}
          <div className="user-detail-order-modal__totals-final"><span>مبلغ نهایی</span><span>{formatPrice(order.final_price)}</span></div>
        </div>
      </div>
    </Modal>
  )
}

function OrdersTab({ userId, customerName }) {
  const { items: orders, hasMore, loadingMore, loadMore } = usePaginatedTab(usersAPI.adminGetUserOrders, userId)
  const [selected, setSelected] = useState(null)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const all = await fetchAllPages(usersAPI.adminGetUserOrders, userId)
      downloadCSV(
        `سفارش‌های-${customerName}`,
        ['شماره', 'تاریخ', 'نوع تحویل', 'وضعیت', 'مبلغ (تومان)'],
        all.map((o) => [o.order_number || o.id, formatJalali(o.created_at), o.delivery_type_display, o.status_display, o.final_price]),
      )
    } finally {
      setExporting(false)
    }
  }

  if (orders === null) return <Loading />
  if (orders.length === 0) return <div className="empty-state"><div className="icon">🛍️</div><h3>سفارشی ثبت نشده</h3></div>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-sm)' }}>
        <button className="admin-orders__refresh" onClick={handleExport} disabled={exporting}>
          <MdDownload size={16} /> دانلود CSV
        </button>
      </div>
      <div className="admin-orders__table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>شماره</th><th>تاریخ</th><th>نوع تحویل</th><th>وضعیت</th><th>مبلغ</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="user-detail-clickable-row" onClick={() => setSelected(o)}>
                <td data-label="شماره">#{o.order_number || o.id}</td>
                <td data-label="تاریخ">{formatJalali(o.created_at)}</td>
                <td data-label="نوع تحویل">{o.delivery_type_display}</td>
                <td data-label="وضعیت"><span className={`status-badge ${getStatusClass(o.status)}`}>{o.status_display}</span></td>
                <td data-label="مبلغ">{formatPrice(o.final_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <OrderDetailModal order={selected} onClose={() => setSelected(null)} />
      </div>
      <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
    </div>
  )
}

const EMPTY_ADJUSTMENT = { amount: '', description: '' }

function WalletAdjustmentModal({ userId, isOpen, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_ADJUSTMENT)
  const [saving, setSaving] = useState(false)

  function close() {
    setForm(EMPTY_ADJUSTMENT)
    onClose()
  }

  async function handleSave() {
    const amount = Number(form.amount)
    if (!amount) { toast.error('مبلغ را وارد کنید'); return }
    if (!form.description.trim()) { toast.error('دلیل تنظیم دستی را بنویسید'); return }
    setSaving(true)
    try {
      await usersAPI.adminAdjustUserWallet(userId, { amount, description: form.description.trim() })
      toast.success('کیف‌پول تنظیم شد')
      close()
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تنظیم کیف‌پول')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="تنظیم دستی کیف‌پول"
      footer={<>
        <Button variant="ghost" onClick={close}>انصراف</Button>
        <Button loading={saving} onClick={handleSave}>ثبت</Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Input
          label="مبلغ (تومان) — منفی برای برداشت"
          type="number"
          value={form.amount}
          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          placeholder="مثلاً 50000 یا 50000-"
          dir="ltr"
        />
        <Textarea
          label="دلیل"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="مثلاً: جبران سفارش خراب"
          rows={2}
        />
      </div>
    </Modal>
  )
}

function WalletTab({ userId, customerName }) {
  const { items: txs, hasMore, loadingMore, loadMore } = usePaginatedTab(usersAPI.adminGetUserWalletTransactions, userId)
  const [exporting, setExporting] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  async function handleExport() {
    setExporting(true)
    try {
      const all = await fetchAllPages(usersAPI.adminGetUserWalletTransactions, userId)
      downloadCSV(
        `کیف‌پول-${customerName}`,
        ['نوع', 'مبلغ (تومان)', 'موجودی پس از تراکنش', 'توضیحات', 'تاریخ'],
        all.map((t) => [t.type_display, t.amount, t.balance_after, t.description || '', formatJalali(t.created_at)]),
      )
    } finally {
      setExporting(false)
    }
  }

  if (txs === null) return <Loading />
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
        <button className="admin-orders__refresh" onClick={() => setAdjustOpen(true)}>
          <MdTune size={16} /> تنظیم دستی
        </button>
        {txs.length > 0 && (
          <button className="admin-orders__refresh" onClick={handleExport} disabled={exporting}>
            <MdDownload size={16} /> دانلود CSV
          </button>
        )}
      </div>
      {txs.length === 0 ? (
        <div className="empty-state"><div className="icon">💳</div><h3>تراکنشی ثبت نشده</h3></div>
      ) : (
        <>
          <div className="admin-orders__table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>نوع</th><th>مبلغ</th><th>موجودی پس از تراکنش</th><th>توضیحات</th><th>تاریخ</th></tr>
              </thead>
              <tbody>
                {txs.map((t) => {
                  const info = WALLET_TX_LABELS[t.type] || { label: t.type_display, cls: '' }
                  return (
                    <tr key={`${t.id}-${refreshKey}`}>
                      <td data-label="نوع"><span className={`status-badge ${info.cls}`}>{t.type_display}</span></td>
                      <td data-label="مبلغ" style={{ color: t.amount > 0 ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                        {t.amount > 0 ? '+' : ''}{formatPrice(t.amount)}
                      </td>
                      <td data-label="موجودی پس از تراکنش">{formatPrice(t.balance_after)}</td>
                      <td data-label="توضیحات">{t.description || '—'}</td>
                      <td data-label="تاریخ">{formatJalali(t.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
        </>
      )}
      <WalletAdjustmentModal
        userId={userId}
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}

function DiscountsTab({ userId }) {
  const { items: usages, hasMore, loadingMore, loadMore } = usePaginatedTab(usersAPI.adminGetUserDiscountUsage, userId)
  if (usages === null) return <Loading />
  if (usages.length === 0) return <div className="empty-state"><div className="icon">🏷️</div><h3>هیچ کد تخفیفی استفاده نشده</h3></div>
  return (
    <div>
      <div className="admin-orders__table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>کد تخفیف</th><th>سفارش</th><th>مبلغ تخفیف</th><th>تاریخ</th></tr>
          </thead>
          <tbody>
            {usages.map((u) => (
              <tr key={u.id}>
                <td data-label="کد تخفیف" dir="ltr" style={{ fontWeight: 700, color: 'var(--primary)' }}>{u.discount_code}</td>
                <td data-label="سفارش">{u.order_number ? `#${u.order_number}` : `#${u.order_id}`}</td>
                <td data-label="مبلغ تخفیف">{u.order_discount_amount != null ? formatPrice(u.order_discount_amount) : '—'}</td>
                <td data-label="تاریخ">{formatJalali(u.used_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
    </div>
  )
}

function ReservationsTab({ userId }) {
  const { items: rows, hasMore, loadingMore, loadMore } = usePaginatedTab(usersAPI.adminGetUserReservations, userId)
  if (rows === null) return <Loading />
  if (rows.length === 0) return <div className="empty-state"><div className="icon">🪑</div><h3>رزروی ثبت نشده</h3></div>
  return (
    <div>
      <div className="admin-orders__table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>تاریخ</th><th>ساعت</th><th>میز</th><th>تعداد نفرات</th><th>وضعیت</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="تاریخ" style={{ whiteSpace: 'nowrap' }}>{formatJalali(r.date)}</td>
                <td data-label="ساعت" style={{ whiteSpace: 'nowrap' }}>{String(r.start_time).slice(0, 5)} – {String(r.end_time).slice(0, 5)}</td>
                <td data-label="میز">{r.table_detail?.number ? `میز ${r.table_detail.number}` : '—'}</td>
                <td data-label="تعداد نفرات">{r.guests_count} نفر</td>
                <td data-label="وضعیت"><span className={`status-badge ${getStatusClass(r.status)}`}>{r.status_display}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
    </div>
  )
}

function ReviewsTab({ userId }) {
  const [data, setData] = useState(null)
  useEffect(() => { usersAPI.adminGetUserReviews(userId).then(setData) }, [userId])
  if (data === null) return <Loading />
  const { menu_reviews: menuReviews, cafe_reviews: cafeReviews } = data
  if (menuReviews.length === 0 && cafeReviews.length === 0) {
    return <div className="empty-state"><div className="icon">⭐</div><h3>نظری ثبت نشده</h3></div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {menuReviews.length > 0 && (
        <div>
          <h3 className="user-detail-subhead">نظرات روی آیتم‌های منو</h3>
          <div className="user-detail-review-list">
            {menuReviews.map((r) => (
              <div key={r.id} className="user-detail-review neu-card-sm">
                <div className="user-detail-review__head">
                  <strong>{r.menu_item_name}</strong>
                  <span className="user-detail-review__stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <p>{r.comment}</p>}
                <span className="user-detail-review__date">{formatJalali(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {cafeReviews.length > 0 && (
        <div>
          <h3 className="user-detail-subhead">نظرات روی کافه</h3>
          <div className="user-detail-review-list">
            {cafeReviews.map((r) => (
              <div key={r.id} className="user-detail-review neu-card-sm">
                <div className="user-detail-review__head">
                  <span className="user-detail-review__stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <p>{r.comment}</p>}
                <span className="user-detail-review__date">{formatJalali(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('summary')
  const [summary, setSummary] = useState(null)

  const fetchSummary = useCallback(() => {
    usersAPI.adminGetUserSummary(id).then(setSummary)
  }, [id])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const customerName = summary?.profile?.full_name || summary?.profile?.phone || `کاربر-${id}`

  return (
    <div>
      <div className="page-header">
        <button className="user-detail-back-btn" onClick={() => navigate('/admin/users')}>
          <MdArrowForward size={14} /> بازگشت به کاربران
        </button>
        <h1>{summary?.profile?.full_name || 'جزئیات مشتری'}</h1>
        <p dir="ltr" style={{ textAlign: 'right' }}>{summary?.profile?.phone}</p>
      </div>

      <div className="admin-orders__filters">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-orders__view-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab summary={summary} userId={id} />}
      {tab === 'orders' && <OrdersTab userId={id} customerName={customerName} />}
      {tab === 'wallet' && <WalletTab userId={id} customerName={customerName} />}
      {tab === 'discounts' && <DiscountsTab userId={id} />}
      {tab === 'reservations' && <ReservationsTab userId={id} />}
      {tab === 'reviews' && <ReviewsTab userId={id} />}
    </div>
  )
}
