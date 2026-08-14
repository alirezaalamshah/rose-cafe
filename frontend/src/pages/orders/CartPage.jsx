import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MdDelete, MdShoppingCart, MdLocalOffer,
  MdHome, MdStorefront, MdTableRestaurant, MdPeople,
  MdCheckCircle, MdLocationOn, MdAdd,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import useCartStore from '../../store/cartStore.js'
import useAuthStore from '../../store/authStore.js'
import { ordersAPI } from '../../api/orders.js'
import { reservationsAPI } from '../../api/reservations.js'
import { authAPI } from '../../api/auth.js'
import { businessAPI } from '../../api/business.js'
import { discountsAPI } from '../../api/discounts.js'
import { paymentsAPI } from '../../api/payments.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import { formatPrice, getMediaUrl, itemUnitPrice } from '../../utils/helpers.js'
import './CartPage.css'

const LOCATION_LABEL = { indoor: 'داخل', outdoor: 'فضای باز', vip: 'VIP' }
const LOCATION_COLOR = { indoor: 'var(--text-muted)', outdoor: 'var(--success)', vip: 'var(--primary)' }
const EMPTY_ADDR = { title: '', province: '', city: '', street: '', detail: '', postal_code: '', is_default: false }

export default function CartPage() {
  const {
    items, updateQuantity, removeItem, clearCart,
    deliveryType, setDeliveryType, tableId, setTable,
  } = useCartStore()
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false) // false | 'online' | 'cash'

  // Quick name completion (required for delivery orders)
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Tables for dine_in
  const [tables, setTables] = useState([])
  const [loadingTables, setLoadingTables] = useState(false)

  // Addresses for delivery
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [loadingAddresses, setLoadingAddresses] = useState(false)

  // Quick address modal
  const [quickAddrModal, setQuickAddrModal] = useState(false)
  const [quickAddrForm, setQuickAddrForm] = useState(EMPTY_ADDR)
  const [savingAddr, setSavingAddr] = useState(false)

  // Delivery cost from settings
  const [deliverySettings, setDeliverySettings] = useState(null)

  // Discount
  const [discountCode, setDiscountCode] = useState('')
  const [discountInfo, setDiscountInfo] = useState(null) // { amount, message }
  const [applyingDiscount, setApplyingDiscount] = useState(false)

  const subtotal = items.reduce((s, i) => s + itemUnitPrice(i) * i.quantity, 0)

  const deliveryCost = useMemo(() => {
    if (deliveryType !== 'delivery') return 0
    if (!deliverySettings) return 15000
    const { delivery_cost, free_delivery_threshold } = deliverySettings
    if (free_delivery_threshold && subtotal >= free_delivery_threshold) return 0
    return delivery_cost
  }, [deliveryType, deliverySettings, subtotal])

  // بسته‌بندی به‌ازای هر واحد از هر آیتم محاسبه می‌شود (هم‌راستا با بک‌اند) — نه یک‌بار برای کل سفارش
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0)
  const packagingCost = useMemo(() => {
    if (!deliverySettings) return 0
    if (deliveryType === 'takeaway') return (deliverySettings.takeaway_packaging_cost || 0) * totalQuantity
    if (deliveryType === 'delivery') return (deliverySettings.delivery_packaging_cost || 0) * totalQuantity
    return 0
  }, [deliveryType, deliverySettings, totalQuantity])

  const discountAmount = discountInfo?.amount || 0
  const total = subtotal + deliveryCost + packagingCost - discountAmount

  // Fetch delivery settings once
  useEffect(() => {
    businessAPI.getDeliverySettings()
      .then((data) => setDeliverySettings(data))
      .catch(() => {})
  }, [])

  // Fetch tables when dine_in selected
  useEffect(() => {
    if (deliveryType === 'dine_in') {
      setLoadingTables(true)
      reservationsAPI.getActiveTables()
        .then((data) => setTables(Array.isArray(data) ? data : (data.results || [])))
        .catch(() => toast.error('خطا در دریافت لیست میزها'))
        .finally(() => setLoadingTables(false))
    }
  }, [deliveryType])

  // Fetch addresses when delivery selected
  useEffect(() => {
    if (deliveryType === 'delivery') {
      setLoadingAddresses(true)
      authAPI.getAddresses()
        .then((data) => {
          const list = Array.isArray(data) ? data : (data.results || [])
          setAddresses(list)
          const def = list.find((a) => a.is_default)
          setSelectedAddressId(def ? def.id : (list.length > 0 ? list[0].id : null))
        })
        .catch(() => toast.error('خطا در دریافت آدرس‌ها'))
        .finally(() => setLoadingAddresses(false))
    }
  }, [deliveryType])

  // Reset discount when subtotal changes
  useEffect(() => {
    if (discountInfo) {
      setDiscountInfo(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])

  async function handleApplyDiscount() {
    if (!discountCode.trim()) return
    setApplyingDiscount(true)
    try {
      const result = await discountsAPI.checkCode(discountCode.trim(), subtotal)
      if (result.valid) {
        setDiscountInfo({ amount: result.discount_amount, message: result.message })
        toast.success(result.message || 'کد تخفیف اعمال شد')
      } else {
        setDiscountInfo(null)
        toast.error(result.message || 'کد تخفیف معتبر نیست')
      }
    } catch (err) {
      setDiscountInfo(null)
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'خطا در بررسی کد تخفیف')
    } finally {
      setApplyingDiscount(false)
    }
  }

  function removeDiscount() {
    setDiscountInfo(null)
    setDiscountCode('')
  }

  function openQuickAddrModal() {
    setQuickAddrForm(EMPTY_ADDR)
    setQuickAddrModal(true)
  }

  async function handleQuickAddrSave() {
    if (!quickAddrForm.title || !quickAddrForm.city || !quickAddrForm.street) {
      toast.error('لطفاً عنوان، شهر و آدرس را وارد کنید')
      return
    }
    setSavingAddr(true)
    try {
      const newAddr = await authAPI.createAddress(quickAddrForm)
      setAddresses((prev) => {
        const list = quickAddrForm.is_default
          ? prev.map((a) => ({ ...a, is_default: false }))
          : prev
        return [...list, newAddr]
      })
      setSelectedAddressId(newAddr.id)
      setQuickAddrModal(false)
      toast.success('آدرس با موفقیت اضافه شد')
    } catch {
      toast.error('خطا در ثبت آدرس')
    } finally {
      setSavingAddr(false)
    }
  }

  async function handleQuickNameSave() {
    if (!quickName.trim()) {
      toast.error('لطفاً نام خود را وارد کنید')
      return
    }
    setSavingName(true)
    try {
      const updated = await authAPI.updateMe({ full_name: quickName.trim() })
      updateUser(updated)
      setNameModalOpen(false)
      toast.success('نام شما ثبت شد، اکنون می‌توانید سفارش را ثبت کنید')
    } catch {
      toast.error('خطا در ثبت نام')
    } finally {
      setSavingName(false)
    }
  }

  async function handleSubmitOrder(paymentMethod = 'online') {
    if (items.length === 0) return
    if (deliveryType === 'dine_in' && !tableId) {
      toast.error('لطفاً میز خود را انتخاب کنید')
      return
    }
    if (deliveryType === 'delivery' && !selectedAddressId) {
      toast.error('لطفاً آدرس تحویل را انتخاب کنید')
      return
    }
    if (deliveryType === 'delivery' && !user?.full_name?.trim()) {
      setQuickName('')
      setNameModalOpen(true)
      return
    }
    setSubmitting(paymentMethod)

    // مرحله ۱: ثبت سفارش
    let order
    try {
      const orderData = {
        items: items.map((i) => ({
          menu_item: i.id,
          quantity: i.quantity,
          ...(i.variantId ? { variant_id: i.variantId } : {}),
          ...(i.addons?.length ? { addon_ids: i.addons.map((a) => a.id) } : {}),
        })),
        delivery_type: deliveryType,
        payment_method: paymentMethod,
        note,
        discount_code: discountInfo ? discountCode : '',
        ...(deliveryType === 'dine_in' ? { table: tableId } : {}),
        ...(deliveryType === 'delivery' ? { address: selectedAddressId } : {}),
      }
      order = await ordersAPI.createOrder(orderData)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در ثبت سفارش')
      setSubmitting(false)
      return
    }

    // مرحله ۲: پردازش بر اساس روش پرداخت
    try {
      if (paymentMethod === 'cash') {
        clearCart()
        toast.success('سفارش شما ثبت شد! پرداخت هنگام دریافت سفارش انجام می‌شود.')
        navigate('/orders')
        return
      }

      if (order.final_price === 0) {
        await paymentsAPI.confirmFreeOrder(order.id)
        clearCart()
        toast.success('سفارش رایگان با موفقیت ثبت و تایید شد!')
        navigate('/orders')
        return
      }

      // مرحله ۳: درخواست لینک درگاه و هدایت مستقیم — بدون صفحه میانی
      const payRes = await paymentsAPI.requestPayment(order.id)
      clearCart()
      if (payRes.payment_url) {
        window.location.href = payRes.payment_url
      } else {
        toast.success('پرداخت شبیه‌سازی شده — سفارش تایید شد!')
        navigate('/orders')
      }
    } catch (err) {
      // سفارش ثبت شده اما درگاه در دسترس نیست — از /orders امکان تلاش مجدد وجود دارد
      toast.error('سفارش ثبت شد اما اتصال به درگاه ناموفق بود. از صفحه سفارشات می‌توانید پرداخت را تکمیل کنید.')
      navigate('/orders')
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <div className="page-header"><h1>سبد خرید</h1></div>
        <div className="empty-state">
          <div className="icon">🛒</div>
          <h3>سبد خرید شما خالی است</h3>
          <p>از منو آیتم‌های مورد علاقه‌تان را اضافه کنید</p>
          <Button onClick={() => navigate('/')} style={{ marginTop: 16 }}>رفتن به منو</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="page-header">
        <h1>سبد خرید</h1>
        <p>{items.length} آیتم در سبد شما</p>
      </div>

      <div className="cart-layout">
        <div className="cart-items-section">
          {/* Items */}
          <div className="neu-card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>آیتم‌های سفارش</h2>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={clearCart}
              >
                <MdDelete size={16} /> خالی کردن سبد
              </button>
            </div>
            {items.map((item) => {
              const key = item.cartKey || String(item.id)
              return (
                <div key={key} className="cart-page__item">
                  <div className="cart-page__item-image">
                    {item.image ? <img src={getMediaUrl(item.image_thumbnail || item.image)} alt={item.name} /> : <span>☕</span>}
                  </div>
                  <div className="cart-page__item-info">
                    <p className="cart-page__item-name">
                      {item.name}
                      {item.variantName && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--primary)', marginRight: 6, fontWeight: 400 }}>
                          ({item.variantName})
                        </span>
                      )}
                    </p>
                    {item.addons?.length > 0 && (
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        + {item.addons.map((a) => a.name).join('، ')}
                      </p>
                    )}
                    {item.slug && (
                      <button
                        className="cart-page__customize-link"
                        onClick={() => navigate(`/menu/${item.slug}`)}
                      >
                        افزودن با گزینه‌های متفاوت
                      </button>
                    )}
                    <p className="cart-page__item-unit">
                      {formatPrice(itemUnitPrice(item))} × {item.quantity}
                    </p>
                  </div>
                  <div className="cart-page__item-controls">
                    <div className="cart-page__qty">
                      <button onClick={() => updateQuantity(key, item.quantity + 1)}>+</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(key, item.quantity - 1)}>−</button>
                    </div>
                    <p className="cart-page__item-total">
                      {formatPrice(itemUnitPrice(item) * item.quantity)}
                    </p>
                    <button className="cart-page__remove" onClick={() => removeItem(key)}>
                      <MdDelete size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Delivery Type */}
          <div className="neu-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>نحوه دریافت سفارش</h2>
            <div className="cart-page__delivery-types">
              <button
                className={`cart-page__delivery-btn ${deliveryType === 'dine_in' ? 'active' : ''}`}
                onClick={() => setDeliveryType('dine_in')}
              >
                <MdTableRestaurant size={24} />
                <span>سرو در کافه</span>
                <small>انتخاب میز</small>
              </button>
              <button
                className={`cart-page__delivery-btn ${deliveryType === 'takeaway' ? 'active' : ''}`}
                onClick={() => setDeliveryType('takeaway')}
              >
                <MdStorefront size={24} />
                <span>بیرون‌بر</span>
                <small>
                  {deliverySettings
                    ? (deliverySettings.takeaway_packaging_cost > 0
                      ? `+ ${formatPrice(deliverySettings.takeaway_packaging_cost)} بسته‌بندی`
                      : 'رایگان')
                    : '...'}
                </small>
              </button>
              <button
                className={`cart-page__delivery-btn ${deliveryType === 'delivery' ? 'active' : ''}`}
                onClick={() => setDeliveryType('delivery')}
              >
                <MdHome size={24} />
                <span>ارسال با پیک</span>
                <small>
                  {deliverySettings
                    ? (deliverySettings.free_delivery_threshold && subtotal >= deliverySettings.free_delivery_threshold
                      ? 'رایگان'
                      : formatPrice(deliverySettings.delivery_cost))
                    : '...'}
                </small>
              </button>
            </div>

            {/* Table selector for dine_in */}
            {deliveryType === 'dine_in' && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                  میز خود را انتخاب کنید:
                </p>
                {loadingTables ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>در حال بارگذاری میزها...</div>
                ) : tables.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>میز فعالی یافت نشد</div>
                ) : (
                  <div className="cart-table-grid">
                    {tables.map((t) => (
                      <button
                        key={t.id}
                        className={`cart-table-card ${tableId === t.id ? 'cart-table-card--selected' : ''}`}
                        onClick={() => setTable(t.id)}
                      >
                        <div className="cart-table-card__num">{t.number}</div>
                        <div className="cart-table-card__cap">
                          <MdPeople size={12} /> {t.capacity} نفره
                        </div>
                        <div
                          className="cart-table-card__loc"
                          style={{ color: LOCATION_COLOR[t.location] || 'var(--text-muted)' }}
                        >
                          {LOCATION_LABEL[t.location] || t.location}
                        </div>
                        {t.description && (
                          <div className="cart-table-card__desc">{t.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Address selector for delivery */}
            {deliveryType === 'delivery' && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                {!user?.full_name?.trim() && (
                  <div style={{ marginBottom: 'var(--space-md)', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    برای ارسال سفارش با پیک، نام شما هنگام ثبت سفارش از شما پرسیده می‌شود.
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdLocationOn size={16} color="var(--primary)" />
                  آدرس تحویل:
                </p>
                {loadingAddresses ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>در حال بارگذاری آدرس‌ها...</div>
                ) : addresses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-lg)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: '0.85rem' }}>هیچ آدرسی ثبت نشده</p>
                    <Button size="sm" onClick={openQuickAddrModal}>
                      <MdAdd size={16} /> افزودن آدرس
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {addresses.map((addr) => (
                      <button
                        key={addr.id}
                        className={`cart-address-card ${selectedAddressId === addr.id ? 'cart-address-card--selected' : ''}`}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div className="cart-address-card__check">
                          {selectedAddressId === addr.id
                            ? <MdCheckCircle size={18} color="var(--primary)" />
                            : <span className="cart-address-card__circle" />}
                        </div>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 2 }}>
                            {addr.title}
                            {addr.is_default && (
                              <span style={{ marginRight: 6, fontSize: '0.7rem', background: 'var(--primary-bg)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                                پیش‌فرض
                              </span>
                            )}
                          </p>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {addr.province && `${addr.province}، `}{addr.city} — {addr.street}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={openQuickAddrModal}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: '0.85rem', transition: 'var(--transition-fast)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                      <MdAdd size={16} /> افزودن آدرس جدید
                    </button>
                  </div>
                )}

                {/* Free delivery notice */}
                {deliverySettings?.free_delivery_threshold && (
                  <div style={{ marginTop: 'var(--space-sm)', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: subtotal >= deliverySettings.free_delivery_threshold ? 'var(--success-bg)' : 'var(--bg-secondary)', border: `1px solid ${subtotal >= deliverySettings.free_delivery_threshold ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`, fontSize: '0.82rem', color: subtotal >= deliverySettings.free_delivery_threshold ? 'var(--success)' : 'var(--text-muted)' }}>
                    {subtotal >= deliverySettings.free_delivery_threshold
                      ? '🎉 ارسال این سفارش رایگان است!'
                      : `برای ارسال رایگان ${formatPrice(deliverySettings.free_delivery_threshold - subtotal)} دیگر خرید کنید`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="neu-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
            <Textarea
              label="توضیحات سفارش (اختیاری)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: بدون پیاز، قهوه اضافه..."
              rows={3}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="cart-summary">
          <div className="neu-card" style={{ padding: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>خلاصه سفارش</h2>

            {deliveryType === 'dine_in' && tableId && (
              <div style={{ marginBottom: 'var(--space-md)', padding: '8px 12px', background: 'var(--primary-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(240,214,132,0.3)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <MdTableRestaurant size={16} color="var(--primary)" />
                <span>
                  میز {tables.find((t) => t.id === tableId)?.number ?? tableId}
                  {tables.find((t) => t.id === tableId)?.capacity ? ` — ${tables.find((t) => t.id === tableId).capacity} نفره` : ''}
                </span>
              </div>
            )}

            <div className="cart-summary__rows">
              <div className="cart-summary__row">
                <span>جمع کالاها</span>
                <span className="price">{formatPrice(subtotal)}</span>
              </div>
              {deliveryCost > 0 && (
                <div className="cart-summary__row">
                  <span>هزینه ارسال</span>
                  <span className="price">{formatPrice(deliveryCost)}</span>
                </div>
              )}
              {deliveryType === 'delivery' && deliveryCost === 0 && (
                <div className="cart-summary__row" style={{ color: 'var(--success)' }}>
                  <span>هزینه ارسال</span>
                  <span>رایگان</span>
                </div>
              )}
              {packagingCost > 0 && (
                <div className="cart-summary__row">
                  <span>هزینه بسته‌بندی</span>
                  <span className="price">{formatPrice(packagingCost)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="cart-summary__row" style={{ color: 'var(--success)' }}>
                  <span>تخفیف</span>
                  <span>−{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="cart-summary__row cart-summary__row--total">
                <span>مبلغ نهایی</span>
                <span className="price">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Discount input */}
            <div className="cart-summary__discount">
              {discountInfo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(74,222,128,0.3)' }}>
                  <MdCheckCircle size={16} color="var(--success)" />
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--success)' }}>
                    {discountInfo.message || `تخفیف ${formatPrice(discountInfo.amount)} اعمال شد`}
                  </span>
                  <button
                    onClick={removeDiscount}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px' }}
                  >
                    حذف
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  <Input
                    label="کد تخفیف"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                    placeholder="کد تخفیف را وارد کنید"
                    iconLeft={<MdLocalOffer size={18} />}
                  />
                  <Button
                    fullWidth
                    size="sm"
                    variant="secondary"
                    loading={applyingDiscount}
                    disabled={!discountCode.trim()}
                    onClick={handleApplyDiscount}
                  >
                    اعمال کد تخفیف
                  </Button>
                </div>
              )}
            </div>

            {deliveryType === 'delivery' ? (
              <Button
                fullWidth
                size="lg"
                onClick={() => handleSubmitOrder('online')}
                loading={!!submitting}
                style={{ marginTop: 'var(--space-lg)' }}
                disabled={!selectedAddressId}
              >
                <MdShoppingCart size={18} />
                ثبت سفارش و پرداخت آنلاین
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => handleSubmitOrder('online')}
                  loading={submitting === 'online'}
                  disabled={
                    !!submitting ||
                    (deliveryType === 'dine_in' && !tableId)
                  }
                >
                  💳 پرداخت آنلاین
                </Button>
                <Button
                  fullWidth
                  size="lg"
                  variant="secondary"
                  onClick={() => handleSubmitOrder('cash')}
                  loading={submitting === 'cash'}
                  disabled={
                    !!submitting ||
                    (deliveryType === 'dine_in' && !tableId)
                  }
                >
                  💵 پرداخت نقدی (هنگام دریافت)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick name completion for delivery orders */}
      <Modal
        isOpen={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        title="تکمیل نام برای ارسال با پیک"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNameModalOpen(false)}>انصراف</Button>
            <Button onClick={handleQuickNameSave} loading={savingName}>ثبت نام و ادامه</Button>
          </>
        }
      >
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', lineHeight: 1.7 }}>
          برای ارسال سفارش با پیک، نام شما باید در پروفایل ثبت شده باشد.
        </p>
        <Input
          label="نام و نام خانوادگی *"
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuickNameSave()}
          placeholder="نام کامل خود را وارد کنید"
        />
      </Modal>

      {/* Quick address creation modal */}
      <Modal
        isOpen={quickAddrModal}
        onClose={() => setQuickAddrModal(false)}
        title="افزودن آدرس جدید"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuickAddrModal(false)}>انصراف</Button>
            <Button onClick={handleQuickAddrSave} loading={savingAddr}>ذخیره آدرس</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Input
            label="عنوان آدرس *"
            value={quickAddrForm.title}
            onChange={(e) => setQuickAddrForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="مثلاً: خانه، محل کار"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input
              label="استان (اختیاری)"
              value={quickAddrForm.province}
              onChange={(e) => setQuickAddrForm((p) => ({ ...p, province: e.target.value }))}
              placeholder="استان"
            />
            <Input
              label="شهر *"
              value={quickAddrForm.city}
              onChange={(e) => setQuickAddrForm((p) => ({ ...p, city: e.target.value }))}
              placeholder="شهر"
            />
          </div>
          <Input
            label="خیابان / کوچه / پلاک *"
            value={quickAddrForm.street}
            onChange={(e) => setQuickAddrForm((p) => ({ ...p, street: e.target.value }))}
            placeholder="خیابان، کوچه، پلاک"
          />
          <Textarea
            label="جزئیات بیشتر (اختیاری)"
            value={quickAddrForm.detail}
            onChange={(e) => setQuickAddrForm((p) => ({ ...p, detail: e.target.value }))}
            placeholder="طبقه، واحد و ..."
            rows={2}
          />
          <Input
            label="کد پستی (اختیاری)"
            value={quickAddrForm.postal_code}
            onChange={(e) => setQuickAddrForm((p) => ({ ...p, postal_code: e.target.value }))}
            placeholder="1234567890"
            dir="ltr"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={quickAddrForm.is_default}
              onChange={(e) => setQuickAddrForm((p) => ({ ...p, is_default: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>آدرس پیش‌فرض</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>برای سفارشات بعدی به‌صورت خودکار انتخاب می‌شود</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
