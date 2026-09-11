import { useState, useEffect, useMemo } from 'react'
import { MdSearch, MdImage, MdAdd, MdRemove, MdDelete, MdReceiptLong } from 'react-icons/md'
import toast from 'react-hot-toast'
import { posAPI } from '../../api/pos.js'
import { Input, Textarea } from '../../components/common/Input/Input.jsx'
import Button from '../../components/common/Button/Button.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, getMediaUrl } from '../../utils/helpers.js'
import './WaiterWalkInOrderPage.css'

function cartKeyOf(itemId, variantId, addonIds) {
  const sorted = [...addonIds].sort((a, b) => a - b)
  return `${itemId}_v${variantId || 0}_a${sorted.join('-')}`
}

export default function WaiterWalkInOrderPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [pickerItem, setPickerItem] = useState(null)

  const [deliveryType, setDeliveryType] = useState('takeaway')
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([posAPI.getWalkInOrderMenu(), posAPI.getWalkInOrderTables()])
      .then(([menuData, tableData]) => {
        setItems(Array.isArray(menuData) ? menuData : (menuData?.results || []))
        setTables(Array.isArray(tableData) ? tableData : (tableData?.results || []))
      })
      .catch(() => toast.error('خطا در بارگذاری منو یا میزها'))
      .finally(() => setLoading(false))
  }, [])

  const groupedItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = items.filter((i) => !q || i.name?.toLowerCase().includes(q) || i.category_name?.toLowerCase().includes(q))
    const groups = []
    const indexByCat = new Map()
    for (const item of filtered) {
      let idx = indexByCat.get(item.category)
      if (idx === undefined) {
        idx = groups.length
        indexByCat.set(item.category, idx)
        groups.push({ categoryId: item.category, categoryName: item.category_name, items: [] })
      }
      groups[idx].items.push(item)
    }
    return groups
  }, [items, search])

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0)

  function openPicker(item) {
    const hasVariants = item.variants?.length > 0
    const hasAddons = (item.addons || []).some((a) => a.is_available)
    if (!hasVariants && !hasAddons) {
      addToCart(item, null, [])
      return
    }
    setPickerItem(item)
  }

  function addToCart(item, variant, addons) {
    const unitPrice = variant ? (variant.discounted_price || variant.price) : (item.discounted_price || item.price)
    const key = cartKeyOf(item.id, variant?.id, addons.map((a) => a.id))
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => l.key === key ? { ...l, quantity: l.quantity + 1 } : l)
      }
      return [...prev, {
        key,
        menuItemId: item.id,
        name: item.name,
        variantId: variant?.id || null,
        variantName: variant?.name || '',
        addonIds: addons.map((a) => a.id),
        addonNames: addons.map((a) => a.name),
        unitPrice,
        quantity: 1,
      }]
    })
    toast.success(`${item.name}${variant ? ` (${variant.name})` : ''} اضافه شد`)
    setPickerItem(null)
  }

  function changeQuantity(key, delta) {
    setCart((prev) => prev
      .map((l) => l.key === key ? { ...l, quantity: l.quantity + delta } : l)
      .filter((l) => l.quantity > 0))
  }

  function removeLine(key) {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }

  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error('سبد سفارش خالی است')
      return
    }
    if (deliveryType === 'dine_in' && !tableId) {
      toast.error('برای سرو در کافه، انتخاب میز الزامی است')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        items: cart.map((l) => ({
          menu_item: l.menuItemId,
          quantity: l.quantity,
          ...(l.variantId ? { variant_id: l.variantId } : {}),
          ...(l.addonIds.length ? { addon_ids: l.addonIds } : {}),
        })),
        delivery_type: deliveryType,
        ...(deliveryType === 'dine_in' ? { table: Number(tableId) } : {}),
        ...(customerName.trim() ? { customer_name: customerName.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }
      const order = await posAPI.createWalkInOrder(payload)
      toast.success(`سفارش #${order.order_number} ثبت شد و به صف چاپ اضافه شد`)
      setCart([])
      setCustomerName('')
      setNote('')
      setTableId('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در ثبت سفارش')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="walk-in-order">
      <div className="waiter-page-header">
        <h1>ثبت سفارش حضوری</h1>
      </div>

      <div className="walk-in-order__layout">
        {/* منو */}
        <div className="walk-in-order__menu">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام آیتم یا دسته‌بندی..."
            iconLeft={<MdSearch size={18} />}
            style={{ marginBottom: 'var(--space-md)' }}
          />

          {groupedItems.length === 0 ? (
            <div className="empty-state"><div className="icon">🍽️</div><h3>آیتمی یافت نشد</h3></div>
          ) : (
            groupedItems.map((group) => (
              <div key={group.categoryId} className="walk-in-order__group">
                <h3 className="walk-in-order__group-title">{group.categoryName}</h3>
                <div className="walk-in-order__grid">
                  {group.items.map((item) => (
                    <button key={item.id} className="walk-in-order__card" onClick={() => openPicker(item)}>
                      {item.image_thumbnail ? (
                        <img src={getMediaUrl(item.image_thumbnail)} alt={item.name} className="walk-in-order__thumb" />
                      ) : (
                        <div className="walk-in-order__thumb walk-in-order__thumb--placeholder"><MdImage size={22} /></div>
                      )}
                      <div className="walk-in-order__card-body">
                        <span className="walk-in-order__card-name">{item.name}</span>
                        <span className="walk-in-order__card-price">
                          {formatPrice(item.variants?.length > 0 ? item.variants[0].price : item.price)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* سبد سفارش */}
        <div className="walk-in-order__cart">
          <h3 className="walk-in-order__cart-title"><MdReceiptLong size={20} /> سبد سفارش ({totalQuantity})</h3>

          {cart.length === 0 ? (
            <p className="walk-in-order__cart-empty">آیتمی انتخاب نشده</p>
          ) : (
            <div className="walk-in-order__cart-lines">
              {cart.map((line) => (
                <div key={line.key} className="walk-in-order__cart-line">
                  <div className="walk-in-order__cart-line-info">
                    <span className="walk-in-order__cart-line-name">
                      {line.name}{line.variantName ? ` (${line.variantName})` : ''}
                    </span>
                    {line.addonNames.length > 0 && (
                      <span className="walk-in-order__cart-line-addons">+ {line.addonNames.join('، ')}</span>
                    )}
                    <span className="walk-in-order__cart-line-price">{formatPrice(line.unitPrice * line.quantity)}</span>
                  </div>
                  <div className="walk-in-order__cart-line-actions">
                    <button onClick={() => changeQuantity(line.key, -1)} aria-label="کم کردن"><MdRemove size={16} /></button>
                    <span>{line.quantity}</span>
                    <button onClick={() => changeQuantity(line.key, 1)} aria-label="زیاد کردن"><MdAdd size={16} /></button>
                    <button onClick={() => removeLine(line.key)} className="walk-in-order__cart-line-remove" aria-label="حذف">
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="walk-in-order__form">
            <div className="walk-in-order__delivery-toggle">
              <button
                className={deliveryType === 'takeaway' ? 'active' : ''}
                onClick={() => setDeliveryType('takeaway')}
              >
                بیرون‌بر
              </button>
              <button
                className={deliveryType === 'dine_in' ? 'active' : ''}
                onClick={() => setDeliveryType('dine_in')}
              >
                سرو در کافه
              </button>
            </div>

            {deliveryType === 'dine_in' && (
              <select
                className="input-field select-field"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
              >
                <option value="">انتخاب میز...</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>میز {t.number} (ظرفیت {t.capacity})</option>
                ))}
              </select>
            )}

            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="نام مشتری (اختیاری)"
            />
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="توضیحات سفارش (اختیاری)"
              rows={2}
            />
          </div>

          <div className="walk-in-order__cart-total">
            <span>مبلغ کل</span>
            <span>{formatPrice(total)}</span>
          </div>

          <Button fullWidth loading={submitting} disabled={cart.length === 0} onClick={handleSubmit}>
            ثبت سفارش و ارسال به چاپ
          </Button>
        </div>
      </div>

      {pickerItem && (
        <ItemPickerModal
          item={pickerItem}
          onClose={() => setPickerItem(null)}
          onConfirm={(variant, addons) => addToCart(pickerItem, variant, addons)}
        />
      )}
    </div>
  )
}

function ItemPickerModal({ item, onClose, onConfirm }) {
  const hasVariants = item.variants?.length > 0
  const availableAddons = (item.addons || []).filter((a) => a.is_available)
  const [variant, setVariant] = useState(
    hasVariants ? (item.variants.find((v) => v.is_available) || item.variants[0]) : null
  )
  const [addonIds, setAddonIds] = useState([])

  function toggleAddon(id) {
    setAddonIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <Modal isOpen title={item.name} onClose={onClose} size="sm">
      <div className="walk-in-order__picker">
        {hasVariants && (
          <div className="walk-in-order__picker-section">
            <h4>انتخاب نوع</h4>
            <div className="walk-in-order__picker-options">
              {item.variants.filter((v) => v.is_available).map((v) => (
                <button
                  key={v.id}
                  className={`walk-in-order__picker-chip ${variant?.id === v.id ? 'active' : ''}`}
                  onClick={() => setVariant(v)}
                >
                  {v.name} — {formatPrice(v.discounted_price || v.price)}
                </button>
              ))}
            </div>
          </div>
        )}

        {availableAddons.length > 0 && (
          <div className="walk-in-order__picker-section">
            <h4>افزودنی‌ها</h4>
            <div className="walk-in-order__picker-options">
              {availableAddons.map((a) => (
                <button
                  key={a.id}
                  className={`walk-in-order__picker-chip ${addonIds.includes(a.id) ? 'active' : ''}`}
                  onClick={() => toggleAddon(a.id)}
                >
                  {a.name} (+{formatPrice(a.price)})
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          fullWidth
          onClick={() => onConfirm(variant, availableAddons.filter((a) => addonIds.includes(a.id)))}
        >
          افزودن به سبد
        </Button>
      </div>
    </Modal>
  )
}
