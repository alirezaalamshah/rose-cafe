import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdVisibility, MdSms, MdSettings, MdLocalOffer } from 'react-icons/md'
import toast from 'react-hot-toast'
import { usersAPI } from '../../api/users.js'
import { discountsAPI } from '../../api/discounts.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { Select, Input } from '../../components/common/Input/Input.jsx'
import { confirm } from '../../store/confirmStore.js'
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

const DISCOUNT_TYPE_LABEL = { percentage: 'درصدی', fixed: 'مبلغ ثابت' }

const STATUS_META = {
  active: { label: 'فعال', cls: 'status-badge status-confirmed' },
  used: { label: 'استفاده شده', cls: 'status-badge status-delivered' },
  expired: { label: 'منقضی', cls: 'status-badge status-cancelled' },
}

export default function AdminChurnedCustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState(null)
  const [sending, setSending] = useState(null)
  const [settingsModal, setSettingsModal] = useState(false)
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [codesModal, setCodesModal] = useState(null) // customer object یا null
  const [codes, setCodes] = useState(null)

  useEffect(() => {
    usersAPI.adminGetChurnedCustomers()
      .then((data) => setCustomers(Array.isArray(data) ? data : (data.results || [])))
  }, [])

  function openSettingsModal() {
    setSettingsModal(true)
    if (!settings) {
      discountsAPI.adminGetWinBackSettings().then(setSettings).catch(() => toast.error('خطا در دریافت تنظیمات'))
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      const updated = await discountsAPI.adminUpdateWinBackSettings(settings)
      setSettings(updated)
      toast.success('تنظیمات ذخیره شد')
      setSettingsModal(false)
    } catch (err) {
      toast.error(err.response?.data?.value?.[0] || err.response?.data?.detail || 'خطا در ذخیره تنظیمات')
    } finally {
      setSavingSettings(false)
    }
  }

  function openCodesModal(customer) {
    setCodesModal(customer)
    setCodes(null)
    discountsAPI.adminGetUserAssignedDiscounts(customer.id)
      .then((data) => setCodes(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => toast.error('خطا در دریافت کدهای تخفیف'))
  }

  async function handleSendWinBack(customer) {
    const label = settings
      ? `${settings.discount_type === 'percentage' ? `${settings.value}٪` : `${formatPrice(settings.value)}`} تخفیف`
      : 'کد تخفیف اختصاصی'
    if (!(await confirm(
      `یک پیامک دلتنگی همراه با ${label} برای ${customer.full_name || customer.phone} ارسال شود؟`,
      { confirmLabel: 'ارسال پیامک', danger: false },
    ))) return

    setSending(customer.id)
    try {
      const res = await discountsAPI.adminSendWinBackSMS(customer.id)
      if (res.sent) {
        toast.success(`پیامک ارسال شد — کد: ${res.code}`)
      } else {
        toast.error(`کد ${res.code} ساخته شد ولی ارسال پیامک ناموفق بود`)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در ارسال پیامک')
    } finally {
      setSending(null)
    }
  }

  if (customers === null) return <Loading />

  return (
    <div>
      <div className="page-header">
        <h1>مشتریان در معرض ریزش</h1>
        <p>مشتریانی که قبلاً چند سفارش واقعی داشته‌اند ولی بیش از ۲۱ روز است سفارشی نداده‌اند — فرصت خوبی برای یادآوری یا کد تخفیف اختصاصی</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
        <Button variant="ghost" onClick={openSettingsModal}>
          <MdSettings size={16} /> تنظیمات تخفیف دلتنگی
        </Button>
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
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button
                          className="admin-action-btn admin-action-btn--info"
                          onClick={() => navigate(`/admin/users/${c.id}`)}
                        >
                          <MdVisibility size={14} /> جزئیات
                        </button>
                        <button
                          className="admin-action-btn"
                          disabled={sending === c.id}
                          onClick={() => handleSendWinBack(c)}
                          title="ارسال پیامک دلتنگی همراه با کد تخفیف اختصاصی"
                        >
                          <MdSms size={14} /> {sending === c.id ? '...' : 'پیام دلتنگی'}
                        </button>
                        <button
                          className="admin-action-btn"
                          onClick={() => openCodesModal(c)}
                          title="مشاهده‌ی کدهای تخفیفی که قبلاً برای این مشتری ارسال شده"
                        >
                          <MdLocalOffer size={14} /> کدهای تخفیف
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={settingsModal}
        onClose={() => setSettingsModal(false)}
        title="تنظیمات پیامک/تخفیف دلتنگی"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettingsModal(false)}>انصراف</Button>
            <Button onClick={handleSaveSettings} loading={savingSettings} disabled={!settings}>ذخیره</Button>
          </>
        }
      >
        {!settings ? (
          <Loading />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Select
              label="نوع تخفیف"
              value={settings.discount_type}
              onChange={(e) => setSettings((s) => ({ ...s, discount_type: e.target.value }))}
            >
              {Object.entries(DISCOUNT_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input
              label={settings.discount_type === 'percentage' ? 'مقدار تخفیف (٪)' : 'مقدار تخفیف (تومان)'}
              type="number"
              min={1}
              value={settings.value}
              onChange={(e) => setSettings((s) => ({ ...s, value: e.target.value }))}
            />
            <Input
              label="مدت اعتبار کد (روز)"
              type="number"
              min={1}
              value={settings.valid_days}
              onChange={(e) => setSettings((s) => ({ ...s, valid_days: e.target.value }))}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              هر بار که برای یک مشتری «پیام دلتنگی» ارسال شود، یک کد تخفیف تازه با همین مقادیر و
              فقط برای همان مشتری ساخته می‌شود — هر کد فقط یک‌بار قابل استفاده است.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!codesModal}
        onClose={() => setCodesModal(null)}
        title={`کدهای تخفیف — ${codesModal?.full_name || codesModal?.phone || ''}`}
      >
        {codes === null ? (
          <Loading />
        ) : codes.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-md) 0' }}>
            هنوز هیچ کد تخفیفی برای این مشتری ارسال نشده است
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>کد</th>
                  <th>تخفیف</th>
                  <th>وضعیت</th>
                  <th>روز باقی‌مانده</th>
                  <th>تاریخ ساخت</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((d) => {
                  const meta = STATUS_META[d.status] || STATUS_META.expired
                  return (
                    <tr key={d.id}>
                      <td data-label="کد"><span dir="ltr" style={{ fontFamily: 'monospace' }}>{d.code}</span></td>
                      <td data-label="تخفیف">
                        {d.discount_type === 'percentage' ? `${toPersianNum(d.value)}٪` : formatPrice(d.value)}
                      </td>
                      <td data-label="وضعیت"><span className={meta.cls}>{meta.label}</span></td>
                      <td data-label="روز باقی‌مانده">
                        {d.status === 'active' ? `${toPersianNum(d.days_remaining)} روز` : '—'}
                      </td>
                      <td data-label="تاریخ ساخت">{formatJalali(d.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
