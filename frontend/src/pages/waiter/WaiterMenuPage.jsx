import { useState, useEffect, useMemo, Fragment } from 'react'
import { MdSearch, MdImage } from 'react-icons/md'
import toast from 'react-hot-toast'
import { waiterAPI } from '../../api/waiter.js'
import { Input } from '../../components/common/Input/Input.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import { formatPrice, getMediaUrl } from '../../utils/helpers.js'
import './WaiterMenuPage.css'

export default function WaiterMenuPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(null)

  function load() {
    setLoading(true)
    waiterAPI.getMenuItems()
      .then((data) => setItems(Array.isArray(data) ? data : (data?.results || [])))
      .catch(() => toast.error('خطا در بارگذاری منو'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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

  async function toggleItem(item) {
    const key = `item-${item.id}`
    const newStatus = item.status === 'available' ? 'unavailable' : 'available'
    setPending(key)
    try {
      const updated = await waiterAPI.updateItemAvailability(item.id, newStatus)
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: updated.status } : i))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تغییر وضعیت')
    } finally {
      setPending(null)
    }
  }

  async function toggleVariant(item, variant) {
    const key = `variant-${variant.id}`
    setPending(key)
    try {
      const updated = await waiterAPI.updateVariantAvailability(variant.id, !variant.is_available)
      setItems((prev) => prev.map((i) => i.id !== item.id ? i : {
        ...i,
        variants: i.variants.map((v) => v.id === variant.id ? { ...v, is_available: updated.is_available } : v),
      }))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تغییر وضعیت')
    } finally {
      setPending(null)
    }
  }

  async function toggleAddon(item, addon) {
    const key = `addon-${addon.id}`
    setPending(key)
    try {
      const updated = await waiterAPI.updateAddonAvailability(addon.id, !addon.is_available)
      setItems((prev) => prev.map((i) => i.id !== item.id ? i : {
        ...i,
        addons: i.addons.map((a) => a.id === addon.id ? { ...a, is_available: updated.is_available } : a),
      }))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در تغییر وضعیت')
    } finally {
      setPending(null)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="waiter-menu">
      <div className="waiter-page-header">
        <h1>موجودی منو</h1>
      </div>

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
        <div className="waiter-menu__table-wrap">
          <table className="waiter-table">
            <thead>
              <tr>
                <th className="col-img">تصویر</th>
                <th className="col-name">نام آیتم</th>
                <th className="col-price">قیمت</th>
                <th className="col-status">وضعیت</th>
                <th className="col-sub">تنوع‌ها / افزودنی‌ها</th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map((group) => (
                <Fragment key={group.categoryId ?? 'none'}>
                  <tr className="waiter-table__group-header">
                    <td colSpan={5}>{group.categoryName || 'بدون دسته‌بندی'}</td>
                  </tr>
                  {group.items.map((item) => {
                    const available = item.status === 'available'
                    return (
                      <tr key={item.id}>
                        <td className="col-img" data-label="تصویر">
                          {item.image_thumbnail ? (
                            <img className="waiter-menu__thumb" src={getMediaUrl(item.image_thumbnail)} alt={item.name} />
                          ) : (
                            <div className="waiter-menu__thumb-placeholder"><MdImage size={16} /></div>
                          )}
                        </td>
                        <td className="col-name" data-label="نام آیتم"><span>{item.name}</span></td>
                        <td className="col-price" data-label="قیمت">{formatPrice(item.price)}</td>
                        <td className="col-status" data-label="وضعیت">
                          <button
                            className={`waiter-menu__toggle ${available ? 'waiter-menu__toggle--on' : 'waiter-menu__toggle--off'}`}
                            disabled={pending === `item-${item.id}`}
                            onClick={() => toggleItem(item)}
                          >
                            {available ? 'موجود' : 'ناموجود'}
                          </button>
                        </td>
                        <td className="col-sub" data-label="تنوع‌ها / افزودنی‌ها">
                          {(item.variants?.length > 0 || item.addons?.length > 0) ? (
                            <div className="waiter-menu__chips">
                              {item.variants?.map((v) => (
                                <button
                                  key={`v-${v.id}`}
                                  className={`waiter-menu__chip ${v.is_available ? 'waiter-menu__chip--on' : 'waiter-menu__chip--off'}`}
                                  disabled={pending === `variant-${v.id}`}
                                  onClick={() => toggleVariant(item, v)}
                                >
                                  {v.name}
                                </button>
                              ))}
                              {item.addons?.map((a) => (
                                <button
                                  key={`a-${a.id}`}
                                  className={`waiter-menu__chip ${a.is_available ? 'waiter-menu__chip--on' : 'waiter-menu__chip--off'}`}
                                  disabled={pending === `addon-${a.id}`}
                                  onClick={() => toggleAddon(item, a)}
                                >
                                  + {a.name}
                                </button>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
