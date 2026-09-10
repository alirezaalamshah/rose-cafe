import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MdShoppingBag, MdPeople, MdPayments, MdTableBar, MdPending,
  MdOutdoorGrill, MdRateReview, MdTrendingUp,
  MdArrowBack, MdDeliveryDining, MdStorefront, MdTableRestaurant,
  MdWarningAmber, MdImageNotSupported, MdCampaign, MdReceiptLong,
  MdEventBusy, MdPersonAddAlt, MdBlock, MdCategory, MdWhatshot,
  MdAccountBalanceWallet, MdLocalOffer, MdStar, MdCancel, MdGroups,
  MdCalendarToday, MdRefresh, MdLocalShipping, MdInventory2, MdHistory,
  MdAllInclusive, MdCheckCircle, MdAccessTime,
} from 'react-icons/md'
import api from '../../api/axios.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import PersianDatePicker from '../../components/common/PersianDatePicker/PersianDatePicker.jsx'
import { formatPrice } from '../../utils/helpers.js'
import { getTodayJalali, toPersianNum, formatJalali } from '../../utils/jalali.js'
import './AdminOrdersPage.css'
import './AdminDashboardPage.css'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RANGE_PRESETS = [
  { label: 'امروز', from: () => todayIso(), to: () => todayIso() },
  { label: '۷ روز اخیر', from: () => daysAgoIso(6), to: () => todayIso() },
  { label: '۳۰ روز اخیر', from: () => daysAgoIso(29), to: () => todayIso() },
]

const STATUS_MAP = {
  waiting_payment: { label: 'در انتظار پرداخت', cls: 'status-pending' },
  pending_confirmation: { label: 'در انتظار تأیید', cls: 'status-pending' },
  paid:      { label: 'تأیید شده',       cls: 'status-confirmed' },
  preparing: { label: 'آماده‌سازی',      cls: 'status-preparing' },
  ready:     { label: 'آماده تحویل',     cls: 'status-ready'     },
  delivered: { label: 'تحویل شد',        cls: 'status-delivered' },
  rejected:  { label: 'رد شده',          cls: 'status-cancelled' },
  cancelled: { label: 'لغو شده',         cls: 'status-cancelled' },
}

const DELIVERY_MAP = {
  delivery:  { label: 'ارسال', icon: <MdDeliveryDining size={13} /> },
  takeaway:  { label: 'بیرون‌بر', icon: <MdStorefront size={13} /> },
  dine_in:   { label: 'سالن', icon: <MdTableRestaurant size={13} /> },
}

// اندیس این آرایه باید با Date.getDay() جاوااسکریپت یکی باشد (۰=یکشنبه ... ۶=شنبه)
const WEEKDAY_LABELS = ['یک', 'دو', 'سه', 'چه', 'پنج', 'جم', 'شن']

function dayLabelOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]
}

function WeeklyChart({ data }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.revenue), 1)

  return (
    <div className="dash-chart">
      <div className="dash-chart__bars">
        {data.map((d, i) => {
          const pct = (d.revenue / max) * 100
          const isToday = i === data.length - 1
          return (
            <div key={d.date} className="dash-chart__col">
              <span className="dash-chart__val">
                {d.revenue > 0 ? toPersianNum(Math.round(d.revenue / 1000)) + 'K' : ''}
              </span>
              <div className="dash-chart__bar-wrap">
                <div
                  className={`dash-chart__bar ${isToday ? 'dash-chart__bar--today' : ''}`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
              </div>
              <span className={`dash-chart__day ${isToday ? 'dash-chart__day--today' : ''}`}>
                {dayLabelOf(d.date)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeltaBadge({ pct }) {
  if (pct === null || pct === undefined) return null
  const positive = pct >= 0
  return (
    <span className={`dash-delta ${positive ? 'dash-delta--up' : 'dash-delta--down'}`}>
      {positive ? '▲' : '▼'} {toPersianNum(Math.abs(pct))}٪
    </span>
  )
}

function KpiCard({ label, value, icon: Icon, color, to, sub, deltaPct }) {
  const navigate = useNavigate()
  return (
    <div
      className={`dash-kpi neu-card ${to ? 'dash-kpi--clickable' : ''}`}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? 'button' : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={to ? (e) => { if (e.key === 'Enter' || e.key === ' ') navigate(to) } : undefined}
    >
      <div className="dash-kpi__icon" style={{ background: `${color}18`, color }}>
        <Icon size={22} />
      </div>
      <div className="dash-kpi__body">
        <p className="dash-kpi__label">{label}</p>
        <p className="dash-kpi__value" style={{ color }}>{value}</p>
        {(sub !== undefined || deltaPct !== undefined) && (
          <p className="dash-kpi__sub">{sub} <DeltaBadge pct={deltaPct} /></p>
        )}
      </div>
      {to && <MdArrowBack size={15} className="dash-kpi__arrow" />}
    </div>
  )
}

function TotalCard({ label, value, icon: Icon, color, to }) {
  const navigate = useNavigate()
  return (
    <div
      className={`dash-total neu-card-sm ${to ? 'dash-total--clickable' : ''}`}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? 'button' : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={to ? (e) => { if (e.key === 'Enter' || e.key === ' ') navigate(to) } : undefined}
    >
      <Icon size={20} style={{ color, flexShrink: 0 }} />
      <div>
        <p className="dash-total__label">{label}</p>
        <p className="dash-total__value" style={{ color }}>{value}</p>
      </div>
    </div>
  )
}

function BreakdownCard({ title, icon: Icon, rows, valueKey }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="dash-card neu-card dash-breakdown">
        <div className="dash-card__head">
          <span className="dash-card__title"><Icon size={16} style={{ marginLeft: 4 }} />{title}</span>
        </div>
        <p className="dash-empty">داده‌ای برای امروز نیست</p>
      </div>
    )
  }
  const max = Math.max(...rows.map((r) => r[valueKey]), 1)
  return (
    <div className="dash-card neu-card dash-breakdown">
      <div className="dash-card__head">
        <span className="dash-card__title"><Icon size={16} style={{ marginLeft: 4 }} />{title}</span>
      </div>
      <div className="dash-breakdown__rows">
        {rows.map((r) => (
          <div key={r.label} className="dash-breakdown__row">
            <div className="dash-breakdown__row-head">
              <span>{r.label}</span>
              <span className="dash-breakdown__row-val">{formatPrice(r[valueKey])} · {toPersianNum(r.count)} سفارش</span>
            </div>
            <div className="dash-breakdown__bar-wrap">
              <div className="dash-breakdown__bar" style={{ width: `${(r[valueKey] / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ZoneLabel({ children, badge }) {
  return (
    <p className="dash-section-label dash-zone-label">
      {children}
      {badge && <span className={`dash-zone-badge dash-zone-badge--${badge.tone}`}>{badge.text}</span>}
    </p>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const [dateFrom, setDateFrom] = useState(daysAgoIso(6))
  const [dateTo, setDateTo] = useState(todayIso())
  const [pickerModal, setPickerModal] = useState(null) // 'from' | 'to' | null
  const navigate = useNavigate()

  const fetchStats = useCallback(() => {
    setRefetching(true)
    api.get('/dashboard/', { params: { from: dateFrom, to: dateTo } })
      .then(setStats)
      .finally(() => { setLoading(false); setRefetching(false) })
  }, [dateFrom, dateTo])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) return <Loading />

  const attention = stats?.attention || {}
  const today = stats?.today || {}
  const menuInsights = stats?.menu_insights || {}
  const total = stats?.total || {}
  const recentOrders = stats?.recent_orders || []
  const upcomingRes = stats?.upcoming_reservations || []
  const weekly = stats?.weekly_revenue || []
  const expiringBanners = attention.expiring_banners || []
  const range = stats?.range || null
  const financial = range?.financial || {}
  const quality = range?.quality || {}
  const sales = range?.sales || {}
  const staffRows = range?.staff?.rows || []
  const courier = range?.courier || {}
  const comparison = range?.comparison || null

  const hasAttention = (attention.cash_pending_count > 0) || (attention.pending_reviews > 0) ||
    (attention.items_without_image > 0) || (expiringBanners.length > 0)

  const todayJalali = (() => {
    try { const { jy, jm, jd } = getTodayJalali(); return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}` }
    catch { return '' }
  })()

  return (
    <div className="dash">
      {/* هدر */}
      <div className="dash-header">
        <div>
          <h1 className="dash-header__title">داشبورد مدیریت</h1>
          <p className="dash-header__date">{toPersianNum(todayJalali)}</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          منطقه‌ی ۱: امروز — همیشه ثابت، به فیلتر پایین واکنش نشان نمی‌دهد
      ═══════════════════════════════════════════════ */}
      <ZoneLabel badge={{ tone: 'fixed', text: 'ثابت — امروز' }}>وضعیت امروز</ZoneLabel>

      {hasAttention && (
        <div className="dash-attention neu-card">
          <div className="dash-card__head">
            <span className="dash-card__title">
              <MdWarningAmber size={16} style={{ color: 'var(--warning)', marginLeft: 4 }} />
              نیازمند توجه
            </span>
          </div>
          <div className="dash-attention__grid">
            {attention.cash_pending_count > 0 && (
              <div className="dash-attention__item" onClick={() => navigate('/admin/orders')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/orders')}>
                <MdReceiptLong size={20} style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="dash-attention__label">نقدی وصول‌نشده</p>
                  <p className="dash-attention__value">{formatPrice(attention.cash_pending_amount)}</p>
                  <p className="dash-attention__sub">{toPersianNum(attention.cash_pending_count)} سفارش</p>
                </div>
              </div>
            )}
            {attention.pending_reviews > 0 && (
              <div className="dash-attention__item" onClick={() => navigate('/admin/reviews')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/reviews')}>
                <MdRateReview size={20} style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="dash-attention__label">نظرات در انتظار تأیید</p>
                  <p className="dash-attention__value">{toPersianNum(attention.pending_reviews)}</p>
                </div>
              </div>
            )}
            {attention.items_without_image > 0 && (
              <div className="dash-attention__item" onClick={() => navigate('/admin/menu')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/menu')}>
                <MdImageNotSupported size={20} style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="dash-attention__label">آیتم‌های بدون عکس</p>
                  <p className="dash-attention__value">{toPersianNum(attention.items_without_image)}</p>
                </div>
              </div>
            )}
            {expiringBanners.map((b) => (
              <div key={b.id} className="dash-attention__item" onClick={() => navigate('/admin/banners')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/banners')}>
                <MdCampaign size={20} style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="dash-attention__label">بنر «{b.title}» رو به انقضا</p>
                  <p className="dash-attention__sub">تا {formatJalali(b.end_date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dash-kpi-grid">
        <KpiCard
          label="سفارشات امروز"
          value={toPersianNum(today.orders_count || 0)}
          icon={MdShoppingBag}
          color="var(--primary)"
          to="/admin/orders"
          sub={`${toPersianNum(today.paid_orders || 0)} پرداخت‌شده`}
        />
        <KpiCard label="درآمد امروز" value={formatPrice(today.revenue || 0)} icon={MdPayments} color="var(--success)" />
        <KpiCard label="میانگین سفارش" value={formatPrice(today.aov || 0)} icon={MdTrendingUp} color="var(--accent)" />
        <KpiCard label="در انتظار پرداخت" value={toPersianNum(today.waiting_payment_orders || 0)} icon={MdPending} color="var(--warning)" to="/admin/orders" />
        <KpiCard label="در حال آماده‌سازی" value={toPersianNum(today.preparing_orders || 0)} icon={MdOutdoorGrill} color="var(--info)" to="/admin/orders" />
        <KpiCard label="رزروهای امروز" value={toPersianNum(today.reservations || 0)} icon={MdTableBar} color="var(--accent)" to="/admin/reservations" />
      </div>

      <div className="dash-breakdown-grid">
        <BreakdownCard title="درآمد به تفکیک نوع تحویل" icon={MdDeliveryDining} rows={today.by_delivery_type} valueKey="revenue" />
        <BreakdownCard title="درآمد به تفکیک روش پرداخت" icon={MdPayments} rows={today.by_payment_method} valueKey="revenue" />
      </div>

      <div className="dash-mid">
        <div className="dash-card neu-card">
          <div className="dash-card__head">
            <span className="dash-card__title">آخرین سفارشات</span>
            <button className="dash-card__more" onClick={() => navigate('/admin/orders')}>
              مشاهده همه <MdArrowBack size={14} />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <p className="dash-empty">سفارشی ثبت نشده</p>
          ) : (
            <div className="dash-orders">
              {recentOrders.map((o) => {
                const st = STATUS_MAP[o.status] || { label: o.status, cls: '' }
                const dt = DELIVERY_MAP[o.delivery_type] || {}
                return (
                  <div key={o.id} className="dash-order-row" onClick={() => navigate('/admin/orders')}>
                    <span className="dash-order-row__id">#{toPersianNum(o.order_number || o.id)}</span>
                    <span className="dash-order-row__phone" dir="ltr">{o.user_phone}</span>
                    <span className="dash-order-row__type">{dt.icon} {dt.label}</span>
                    <span className={`status-badge ${st.cls}`}>{st.label}</span>
                    <span className="dash-order-row__price">{formatPrice(o.final_price)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="dash-side">
          <div className="dash-card neu-card">
            <div className="dash-card__head">
              <span className="dash-card__title">
                <MdTrendingUp size={16} style={{ color: 'var(--success)', marginLeft: 4 }} />
                درآمد ۷ روز گذشته
              </span>
            </div>
            <WeeklyChart data={weekly} />
          </div>

          <div className="dash-card neu-card">
            <div className="dash-card__head">
              <span className="dash-card__title">اقدامات سریع</span>
            </div>
            <div className="dash-actions">
              {[
                { label: 'مدیریت سفارشات', icon: MdShoppingBag, to: '/admin/orders', color: 'var(--primary)' },
                { label: 'رزروها', icon: MdTableBar, to: '/admin/reservations', color: 'var(--accent)' },
                { label: 'تایید نظرات', icon: MdRateReview, to: '/admin/reviews', color: 'var(--warning)', badge: total.pending_reviews },
                { label: 'منوی کافه', icon: MdStorefront, to: '/admin/menu', color: 'var(--info)' },
              ].map(({ label, icon: Icon, to, color, badge }) => (
                <button key={to} className="dash-action-btn" onClick={() => navigate(to)}>
                  <span className="dash-action-btn__icon" style={{ background: `${color}18`, color }}>
                    <Icon size={18} />
                  </span>
                  <span className="dash-action-btn__label">{label}</span>
                  {badge > 0 && <span className="dash-action-btn__badge">{toPersianNum(badge)}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="dash-total-grid dash-total-grid--2" style={{ marginBottom: 0 }}>
            <TotalCard
              label="آیتم‌های ناموجود"
              value={toPersianNum(menuInsights.unavailable_items || 0)}
              icon={MdBlock}
              color={menuInsights.unavailable_items > 0 ? 'var(--warning)' : 'var(--text-muted)'}
              to="/admin/menu"
            />
            <TotalCard
              label="دسته‌بندی غیرفعال"
              value={toPersianNum(menuInsights.inactive_categories || 0)}
              icon={MdCategory}
              color={menuInsights.inactive_categories > 0 ? 'var(--warning)' : 'var(--text-muted)'}
              to="/admin/menu"
            />
          </div>
        </div>
      </div>

      {upcomingRes.length > 0 && (
        <div className="dash-card neu-card">
          <div className="dash-card__head">
            <span className="dash-card__title">
              <MdTableBar size={16} style={{ color: 'var(--accent)', marginLeft: 4 }} />
              رزروهای پیش رو
            </span>
            <button className="dash-card__more" onClick={() => navigate('/admin/reservations')}>
              مشاهده همه <MdArrowBack size={14} />
            </button>
          </div>
          <div className="dash-reservations">
            {upcomingRes.map((r) => (
              <div key={r.id} className="dash-res-row" onClick={() => navigate('/admin/reservations')}>
                <span className="dash-res-row__date">{formatJalali(r.date)}</span>
                <span className="dash-res-row__time" dir="ltr">{r.start_time} – {r.end_time}</span>
                <span className="dash-res-row__phone" dir="ltr">{r.user_phone}</span>
                <span className="dash-res-row__table">میز {toPersianNum(r.table_number)}</span>
                <span className="dash-res-row__guests">{toPersianNum(r.guests_count)} نفر</span>
                <span className={`status-badge ${r.status === 'confirmed' ? 'status-confirmed' : 'status-pending'}`}>
                  {r.status === 'confirmed' ? 'تایید شده' : 'در انتظار'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          منطقه‌ی ۲: گزارش بازه‌ای — همه‌ی بخش‌های زیر به همین یک فیلتر واکنش نشان می‌دهند
      ═══════════════════════════════════════════════ */}
      <div className="dash-range-zone">
        <div className="dash-range-zone__filter-bar">
          <ZoneLabel badge={{ tone: 'range', text: 'فیلترپذیر' }}>گزارش بازه‌ای</ZoneLabel>
          <div className="admin-orders__filters" style={{ marginBottom: 0 }}>
            {RANGE_PRESETS.map((p) => (
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
            <button className="admin-orders__refresh" onClick={fetchStats}>
              <MdRefresh size={18} className={refetching ? 'spin' : ''} /> بروزرسانی
            </button>
          </div>
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

        <div className={`dash-range-zone__body ${refetching ? 'dash-range-zone__body--loading' : ''}`}>
          {/* مالی/حسابداری */}
          <p className="dash-subsection-label"><MdPayments size={15} />مالی و حسابداری <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— نسبت به بازه‌ی درست‌قبلی با همین طول</span></p>
          <div className="dash-kpi-grid">
            <KpiCard
              label="درآمد بازه" value={formatPrice(financial.revenue || 0)} icon={MdPayments} color="var(--success)"
              sub={`${toPersianNum(financial.orders_count || 0)} سفارش`} deltaPct={comparison?.revenue_change_pct}
            />
            <KpiCard label="تخفیف داده‌شده" value={formatPrice(financial.discount_given || 0)} icon={MdLocalOffer} color="var(--warning)" to="/admin/discounts" sub={`${toPersianNum(financial.discount_orders_count || 0)} سفارش`} />
            <KpiCard label="شارژ کیف‌پول" value={formatPrice(financial.wallet_topups || 0)} icon={MdAccountBalanceWallet} color="var(--primary)" />
            <KpiCard label="بازگشت وجه" value={formatPrice(financial.wallet_cashback_paid || 0)} icon={MdAccountBalanceWallet} color="var(--accent)" to="/admin/settings" />
            <KpiCard label="هزینه ارسال" value={formatPrice(financial.delivery_cost_total || 0)} icon={MdLocalShipping} color="var(--info)" />
            <KpiCard label="هزینه بسته‌بندی" value={formatPrice(financial.packaging_cost_total || 0)} icon={MdInventory2} color="var(--info)" />
          </div>
          <TotalCard
            label="موجودی کل کیف‌پول‌های مشتریان (لحظه‌ای، مستقل از بازه)"
            value={formatPrice(financial.wallet_total_balance || 0)}
            icon={MdAllInclusive}
            color="var(--primary)"
          />

          {/* کیفیت و رضایت مشتری */}
          <p className="dash-subsection-label"><MdStar size={15} />کیفیت و رضایت مشتری</p>
          <div className="dash-mid">
            <div className="dash-card neu-card">
              <div className="dash-card__head">
                <span className="dash-card__title"><MdStar size={16} style={{ color: 'var(--warning)', marginLeft: 4 }} />امتیاز مشتریان</span>
                <button className="dash-card__more" onClick={() => navigate('/admin/reviews')}>مشاهده نظرات <MdArrowBack size={14} /></button>
              </div>
              {quality.avg_rating ? (
                <div className="dash-rating">
                  <span className="dash-rating__value">{toPersianNum(quality.avg_rating)}</span>
                  <span className="dash-rating__stars">★</span>
                  <span className="dash-rating__count">از {toPersianNum(quality.ratings_count)} نظر تأییدشده</span>
                </div>
              ) : (
                <p className="dash-empty">نظر تأییدشده‌ای در این بازه نیست</p>
              )}
            </div>

            <div className="dash-side">
              <div className="dash-card neu-card">
                <div className="dash-card__head">
                  <span className="dash-card__title"><MdCancel size={16} style={{ color: 'var(--error)', marginLeft: 4 }} />نرخ رد/لغو سفارش</span>
                </div>
                <div className="dash-rating">
                  <span className="dash-rating__value" style={{ color: quality.rejection_rate > 15 ? 'var(--error)' : 'var(--text-primary)' }}>
                    {toPersianNum(quality.rejection_rate || 0)}٪
                  </span>
                  <span className="dash-rating__count">
                    {toPersianNum((quality.rejected_count || 0) + (quality.cancelled_count || 0))} از {toPersianNum(quality.total_orders || 0)}
                  </span>
                </div>
                {quality.top_rejection_reasons?.length > 0 && (
                  <div className="dash-reasons">
                    {quality.top_rejection_reasons.map((r) => (
                      <div key={r.reason} className="dash-reasons__row">
                        <span>{r.reason}</span>
                        <span className="dash-reasons__count">{toPersianNum(r.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dash-card neu-card">
                <div className="dash-card__head">
                  <span className="dash-card__title"><MdEventBusy size={16} style={{ color: 'var(--accent)', marginLeft: 4 }} />نرخ عدم‌حضور رزرو</span>
                </div>
                <div className="dash-rating">
                  <span className="dash-rating__value" style={{ color: quality.no_show_rate > 15 ? 'var(--error)' : 'var(--text-primary)' }}>
                    {toPersianNum(quality.no_show_rate || 0)}٪
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* فروش و منو */}
          <p className="dash-subsection-label"><MdWhatshot size={15} />فروش و منو</p>
          <div className="dash-mid">
            <div className="dash-card neu-card">
              <div className="dash-card__head">
                <span className="dash-card__title"><MdWhatshot size={16} style={{ color: 'var(--warning)', marginLeft: 4 }} />پرفروش‌ترین آیتم‌ها</span>
                <button className="dash-card__more" onClick={() => navigate('/admin/category-sales')}>گزارش کامل <MdArrowBack size={14} /></button>
              </div>
              {(sales.top_items || []).length === 0 ? (
                <p className="dash-empty">فروشی در این بازه ثبت نشده</p>
              ) : (
                <div className="dash-bestsellers">
                  {sales.top_items.map((b, i) => (
                    <div key={b.id} className="dash-bestseller-row">
                      <span className="dash-bestseller-row__rank">{toPersianNum(i + 1)}</span>
                      <span className="dash-bestseller-row__name">{b.name}</span>
                      <span className="dash-bestseller-row__qty">{toPersianNum(b.quantity)} فروش</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dash-side">
              <div className="dash-card neu-card">
                <div className="dash-card__head">
                  <span className="dash-card__title"><MdCategory size={16} style={{ color: 'var(--primary)', marginLeft: 4 }} />پرفروش‌ترین دسته‌بندی‌ها</span>
                  <button className="dash-card__more" onClick={() => navigate('/admin/category-sales')}>گزارش کامل <MdArrowBack size={14} /></button>
                </div>
                {(sales.top_categories || []).length === 0 ? <p className="dash-empty">داده‌ای نیست</p> : (
                  <div className="dash-bestsellers">
                    {sales.top_categories.map((c, i) => (
                      <div key={c.category_id} className="dash-bestseller-row">
                        <span className="dash-bestseller-row__rank">{toPersianNum(i + 1)}</span>
                        <span className="dash-bestseller-row__name">{c.category_name}</span>
                        <span className="dash-bestseller-row__qty">{toPersianNum(c.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="dash-card neu-card">
                <div className="dash-card__head"><span className="dash-card__title">پرفروش‌ترین تنوع/افزودنی</span></div>
                {(sales.top_variants || []).length === 0 && (sales.top_addons || []).length === 0 ? (
                  <p className="dash-empty">داده‌ای نیست</p>
                ) : (
                  <div className="dash-bestsellers">
                    {sales.top_variants.map((v) => (
                      <div key={`v-${v.variant_name}`} className="dash-bestseller-row dash-bestseller-row--no-rank">
                        <span className="dash-bestseller-row__name">{v.variant_name}</span>
                        <span className="dash-bestseller-row__qty">{toPersianNum(v.quantity)}</span>
                      </div>
                    ))}
                    {sales.top_addons.map((a) => (
                      <div key={`a-${a.name}`} className="dash-bestseller-row dash-bestseller-row--no-rank">
                        <span className="dash-bestseller-row__name">+ {a.name}</span>
                        <span className="dash-bestseller-row__qty">{toPersianNum(a.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* مشتریان پرسفارش */}
          <div className="dash-card neu-card">
            <div className="dash-card__head">
              <span className="dash-card__title"><MdGroups size={16} style={{ color: 'var(--primary)', marginLeft: 4 }} />۵ مشتری پرسفارش این بازه</span>
              <button className="dash-card__more" onClick={() => navigate('/admin/users')}>همه‌ی کاربران <MdArrowBack size={14} /></button>
            </div>
            {(sales.top_customers || []).length === 0 ? (
              <p className="dash-empty">سفارشی در این بازه ثبت نشده</p>
            ) : (
              <div className="dash-bestsellers">
                {sales.top_customers.map((c, i) => (
                  <div
                    key={c.user_id}
                    className="dash-bestseller-row dash-bestseller-row--clickable"
                    onClick={() => navigate(`/admin/users/${c.user_id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/users/${c.user_id}`)}
                  >
                    <span className="dash-bestseller-row__rank">{toPersianNum(i + 1)}</span>
                    <span className="dash-bestseller-row__name">{c.name}</span>
                    <span className="dash-bestseller-row__qty">
                      {toPersianNum(c.orders_count)} سفارش · {formatPrice(c.total_spent)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dash-total-grid dash-total-grid--2" style={{ marginBottom: 0 }}>
            <TotalCard label="نرخ مشتری تکراری در این بازه" value={`${toPersianNum(sales.repeat_customer_rate || 0)}٪`} icon={MdGroups} color="var(--success)" />
            <TotalCard label="کاربران جدید در این بازه" value={toPersianNum(sales.new_users || 0)} icon={MdPersonAddAlt} color="var(--success)" to="/admin/users" />
          </div>

          {/* عملکرد کارکنان */}
          <p className="dash-subsection-label"><MdHistory size={15} />عملکرد سرپرست‌های سالن</p>
          <div className="dash-card neu-card">
            <div className="dash-card__head">
              <span className="dash-card__title">خلاصه‌ی عملکرد</span>
              <button className="dash-card__more" onClick={() => navigate('/admin/activity')}>گزارش کامل <MdArrowBack size={14} /></button>
            </div>
            {staffRows.length === 0 ? (
              <p className="dash-empty">سرپرست سالنی در این بازه فعالیتی نداشته</p>
            ) : (
              <div className="admin-orders__table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>سرپرست سالن</th>
                      <th>تأیید شده</th>
                      <th>رد شده</th>
                      <th>نقدی وصول‌شده</th>
                      <th>آنلاین وصول‌شده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffRows.map((row) => (
                      <tr key={row.waiter_id}>
                        <td data-label="سرپرست سالن">{row.waiter_name}</td>
                        <td data-label="تأیید شده">{toPersianNum(row.approved_count)}</td>
                        <td data-label="رد شده">{toPersianNum(row.rejected_count)}</td>
                        <td data-label="نقدی وصول‌شده">{formatPrice(row.cash_collected)}</td>
                        <td data-label="آنلاین وصول‌شده">{formatPrice(row.online_collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* عملکرد پیک اسنپ‌باکس */}
          <p className="dash-subsection-label"><MdDeliveryDining size={15} />عملکرد پیک اسنپ‌باکس</p>
          {courier.total_dispatched === 0 ? (
            <p className="dash-empty">در این بازه سفارشی به پیک ارسال نشده</p>
          ) : (
            <div className="dash-kpi-grid">
              <KpiCard label="ارسال‌شده به پیک" value={toPersianNum(courier.total_dispatched)} icon={MdDeliveryDining} color="var(--primary)" to="/admin/orders" />
              <KpiCard label="تحویل موفق" value={toPersianNum(courier.delivered_count)} icon={MdCheckCircle} color="var(--success)" />
              <KpiCard
                label="نرخ لغو/ناموفق" value={`${toPersianNum(courier.cancellation_rate ?? 0)}٪`} icon={MdCancel}
                color={courier.cancellation_rate > 20 ? 'var(--error)' : 'var(--text-secondary)'}
                sub={`${toPersianNum(courier.cancelled_count)} مورد`}
              />
              <KpiCard
                label="میانگین زمان تحویل"
                value={courier.avg_delivery_minutes != null ? `${toPersianNum(courier.avg_delivery_minutes)} دقیقه` : '—'}
                icon={MdAccessTime} color="var(--info)"
              />
              <KpiCard label="هزینه‌ی کل پیک" value={formatPrice(courier.total_delivery_fare || 0)} icon={MdPayments} color="var(--warning)" />
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          منطقه‌ی ۳: آمار کلی — از ابتدای راه‌اندازی، مستقل از فیلتر بالا
      ═══════════════════════════════════════════════ */}
      <ZoneLabel badge={{ tone: 'total', text: 'از ابتدا — بدون فیلتر' }}>آمار کلی</ZoneLabel>
      <div className="dash-total-grid">
        <TotalCard label="کل کاربران" value={toPersianNum(total.users || 0)} icon={MdPeople} color="var(--primary)" to="/admin/users" />
        <TotalCard label="کل سفارشات" value={toPersianNum(total.orders || 0)} icon={MdShoppingBag} color="var(--text-secondary)" to="/admin/orders" />
        <TotalCard label="کل درآمد" value={formatPrice(total.revenue || 0)} icon={MdPayments} color="var(--success)" />
        <TotalCard
          label="نظرات در انتظار"
          value={toPersianNum(total.pending_reviews || 0)}
          icon={MdRateReview}
          color={total.pending_reviews > 0 ? 'var(--warning)' : 'var(--text-muted)'}
          to="/admin/reviews"
        />
      </div>
    </div>
  )
}
