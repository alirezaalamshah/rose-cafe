import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MdShoppingBag, MdPeople, MdPayments, MdTableBar, MdPending,
  MdOutdoorGrill, MdRateReview, MdTrendingUp,
  MdArrowBack, MdDeliveryDining, MdStorefront, MdTableRestaurant,
  MdWarningAmber, MdImageNotSupported, MdCampaign, MdReceiptLong,
  MdEventBusy, MdPersonAddAlt, MdBlock, MdCategory, MdWhatshot,
} from 'react-icons/md'
import api from '../../api/axios.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice } from '../../utils/helpers.js'
import { getTodayJalali, toPersianNum, formatJalali } from '../../utils/jalali.js'
import './AdminDashboardPage.css'

const STATUS_MAP = {
  waiting_payment: { label: 'در انتظار پرداخت', cls: 'status-pending' },
  paid:      { label: 'پرداخت شده',      cls: 'status-confirmed' },
  preparing: { label: 'آماده‌سازی',      cls: 'status-preparing' },
  ready:     { label: 'آماده تحویل',     cls: 'status-ready'     },
  delivered: { label: 'تحویل شد',        cls: 'status-delivered' },
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

function KpiCard({ label, value, icon: Icon, color, to, sub }) {
  const navigate = useNavigate()
  return (
    <div
      className={`dash-kpi neu-card ${to ? 'dash-kpi--clickable' : ''}`}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? 'button' : undefined}
    >
      <div className="dash-kpi__icon" style={{ background: `${color}18`, color }}>
        <Icon size={22} />
      </div>
      <div className="dash-kpi__body">
        <p className="dash-kpi__label">{label}</p>
        <p className="dash-kpi__value" style={{ color }}>{value}</p>
        {sub !== undefined && <p className="dash-kpi__sub">{sub}</p>}
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

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/dashboard/')
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const attention = stats?.attention || {}
  const today = stats?.today || {}
  const menuInsights = stats?.menu_insights || {}
  const resInsight = stats?.reservations_insight || {}
  const total = stats?.total || {}
  const recentOrders = stats?.recent_orders || []
  const upcomingRes = stats?.upcoming_reservations || []
  const weekly = stats?.weekly_revenue || []
  const expiringBanners = attention.expiring_banners || []
  const bestSellers = menuInsights.best_sellers || []

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

      {/* ── نیازمند توجه ── */}
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
              <div className="dash-attention__item" onClick={() => navigate('/admin/orders')} role="button">
                <MdReceiptLong size={20} style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="dash-attention__label">نقدی وصول‌نشده</p>
                  <p className="dash-attention__value">{formatPrice(attention.cash_pending_amount)}</p>
                  <p className="dash-attention__sub">{toPersianNum(attention.cash_pending_count)} سفارش</p>
                </div>
              </div>
            )}
            {attention.pending_reviews > 0 && (
              <div className="dash-attention__item" onClick={() => navigate('/admin/reviews')} role="button">
                <MdRateReview size={20} style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="dash-attention__label">نظرات در انتظار تأیید</p>
                  <p className="dash-attention__value">{toPersianNum(attention.pending_reviews)}</p>
                </div>
              </div>
            )}
            {attention.items_without_image > 0 && (
              <div className="dash-attention__item" onClick={() => navigate('/admin/menu')} role="button">
                <MdImageNotSupported size={20} style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="dash-attention__label">آیتم‌های بدون عکس</p>
                  <p className="dash-attention__value">{toPersianNum(attention.items_without_image)}</p>
                </div>
              </div>
            )}
            {expiringBanners.map((b) => (
              <div key={b.id} className="dash-attention__item" onClick={() => navigate('/admin/banners')} role="button">
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

      {/* ── KPI امروز ── */}
      <p className="dash-section-label">امروز</p>
      <div className="dash-kpi-grid">
        <KpiCard
          label="سفارشات امروز"
          value={toPersianNum(today.orders_count || 0)}
          icon={MdShoppingBag}
          color="var(--primary)"
          to="/admin/orders"
          sub={`${toPersianNum(today.paid_orders || 0)} پرداخت‌شده`}
        />
        <KpiCard
          label="درآمد امروز"
          value={formatPrice(today.revenue || 0)}
          icon={MdPayments}
          color="var(--success)"
        />
        <KpiCard
          label="میانگین سفارش"
          value={formatPrice(today.aov || 0)}
          icon={MdTrendingUp}
          color="var(--accent)"
        />
        <KpiCard
          label="در انتظار پرداخت"
          value={toPersianNum(today.waiting_payment_orders || 0)}
          icon={MdPending}
          color="var(--warning)"
          to="/admin/orders"
        />
        <KpiCard
          label="در حال آماده‌سازی"
          value={toPersianNum(today.preparing_orders || 0)}
          icon={MdOutdoorGrill}
          color="var(--info)"
          to="/admin/orders"
        />
        <KpiCard
          label="رزروهای امروز"
          value={toPersianNum(today.reservations || 0)}
          icon={MdTableBar}
          color="var(--accent)"
          to="/admin/reservations"
        />
      </div>

      {/* تفکیک سفارشات امروز */}
      <div className="dash-breakdown-grid">
        <BreakdownCard title="درآمد به تفکیک نوع تحویل" icon={MdDeliveryDining} rows={today.by_delivery_type} valueKey="revenue" />
        <BreakdownCard title="درآمد به تفکیک روش پرداخت" icon={MdPayments} rows={today.by_payment_method} valueKey="revenue" />
      </div>

      {/* ── ردیف میانی ── */}
      <div className="dash-mid">

        {/* آخرین سفارشات */}
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
                  <div
                    key={o.id}
                    className="dash-order-row"
                    onClick={() => navigate('/admin/orders')}
                  >
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

        {/* ستون راست: نمودار + اقدامات سریع */}
        <div className="dash-side">

          {/* نمودار هفتگی */}
          <div className="dash-card neu-card">
            <div className="dash-card__head">
              <span className="dash-card__title">
                <MdTrendingUp size={16} style={{ color: 'var(--success)', marginLeft: 4 }} />
                درآمد ۷ روز گذشته
              </span>
            </div>
            <WeeklyChart data={weekly} />
          </div>

          {/* اقدامات سریع */}
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
        </div>
      </div>

      {/* ── بینش‌های منو ── */}
      <p className="dash-section-label">بینش‌های منو</p>
      <div className="dash-mid">
        <div className="dash-card neu-card">
          <div className="dash-card__head">
            <span className="dash-card__title">
              <MdWhatshot size={16} style={{ color: 'var(--warning)', marginLeft: 4 }} />
              پرفروش‌ترین آیتم‌های ۷ روز گذشته
            </span>
            <button className="dash-card__more" onClick={() => navigate('/admin/menu')}>
              مدیریت منو <MdArrowBack size={14} />
            </button>
          </div>
          {bestSellers.length === 0 ? (
            <p className="dash-empty">در ۷ روز گذشته فروشی ثبت نشده</p>
          ) : (
            <div className="dash-bestsellers">
              {bestSellers.map((b, i) => (
                <div key={b.id} className="dash-bestseller-row">
                  <span className="dash-bestseller-row__rank">{toPersianNum(i + 1)}</span>
                  <span className="dash-bestseller-row__name">{b.name}</span>
                  <span className="dash-bestseller-row__qty">{toPersianNum(b.quantity_sold)} فروش</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-side">
          <TotalCard
            label="آیتم‌های ناموجود"
            value={toPersianNum(menuInsights.unavailable_items || 0)}
            icon={MdBlock}
            color={menuInsights.unavailable_items > 0 ? 'var(--warning)' : 'var(--text-muted)'}
            to="/admin/menu"
          />
          <TotalCard
            label="دسته‌بندی‌های غیرفعال"
            value={toPersianNum(menuInsights.inactive_categories || 0)}
            icon={MdCategory}
            color={menuInsights.inactive_categories > 0 ? 'var(--warning)' : 'var(--text-muted)'}
            to="/admin/menu"
          />
        </div>
      </div>

      {/* ── رزرو و مشتریان ── */}
      <p className="dash-section-label">رزرو و مشتریان</p>
      <div className="dash-total-grid dash-total-grid--2">
        <TotalCard
          label="نرخ عدم‌حضور (۳۰ روز اخیر)"
          value={`${toPersianNum(resInsight.no_show_rate || 0)}٪`}
          icon={MdEventBusy}
          color={resInsight.no_show_rate > 15 ? 'var(--error)' : 'var(--text-muted)'}
          to="/admin/reservations"
        />
        <TotalCard
          label="کاربران جدید این هفته"
          value={toPersianNum(total.new_users_this_week || 0)}
          icon={MdPersonAddAlt}
          color="var(--success)"
          to="/admin/users"
        />
      </div>

      {upcomingRes.length > 0 && (
        <div className="dash-card neu-card" style={{ marginBottom: 'var(--space-xl)' }}>
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

      {/* ── آمار کلی ── */}
      <p className="dash-section-label">آمار کلی</p>
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
