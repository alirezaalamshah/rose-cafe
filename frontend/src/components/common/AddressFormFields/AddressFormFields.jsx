import { useState, useRef } from 'react'
import { MdSearch } from 'react-icons/md'
import toast from 'react-hot-toast'
import { Input, Textarea } from '../Input/Input.jsx'
import MapLocationPicker from '../MapLocationPicker/MapLocationPicker.jsx'
import { authAPI } from '../../../api/auth.js'

export const EMPTY_ADDRESS = {
  title: '', province: '', city: '', street: '', detail: '',
  postal_code: '', latitude: '', longitude: '', is_default: false,
}

// نتیجه‌ی Nominatim از مشخص‌ترین بخش شروع می‌شود (مثلاً «میدان فرهنگ، دزفول،
// خوزستان، ایران») — فقط دو بخش اول برای خوانایی بهتر در لیست نتایج کافی است
function shortenDisplayName(displayName) {
  return displayName.split('،').slice(0, 2).join('،').trim()
}

/**
 * فرم مشترک ثبت/ویرایش آدرس — بین ProfilePage و CartPage استفاده می‌شود تا فیلدها
 * (و از جمله انتخاب موقعیت روی نقشه) فقط یک‌جا تعریف شده باشند.
 * form: شیء آدرس؛ onChange(field, value): تغییر یک فیلد.
 *
 * دو مسیر تکمیل خودکار (هر دو با Nominatim، بدون کلید API):
 * ۱. جست‌وجوی متنی (دکمه‌ی صریح، نه زنده — به‌خاطر سقف نرخ Nominatim)، محدود به
 *    شعاع مجاز ثبت آدرس (سمت سرور فیلتر می‌شود) → پین روی نقشه
 * ۲. جابه‌جایی پین → پر شدن خودکار فیلدهای «شهر/استان/خیابان» — فقط فیلدهایی که
 *    خودِ همین مکانیابی خودکار پر کرده به‌روز می‌شوند؛ چیزی که کاربر دستی تایپ
 *    کرده حتی با جابه‌جایی دوباره‌ی پین دست‌نخورده می‌ماند (ردیابی با autoFilledRef)
 */
export default function AddressFormFields({ form, onChange }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [searchNotice, setSearchNotice] = useState('')
  const [recenterSignal, setRecenterSignal] = useState(0)
  // کدام فیلدها را خودِ reverse-geocode پر کرده (نه خود کاربر) — برای تشخیص
  // «خالی بود» از «قبلاً خودکار پر شده و باید با پین جدید آپدیت شود»
  const autoFilledRef = useRef(new Set())

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults(null)
    setSearchNotice('')
    try {
      const res = await authAPI.searchAddress(searchQuery.trim())
      if (!res.results?.length) {
        setSearchNotice(res.detail || 'آدرسی با این متن پیدا نشد — می‌توانید موقعیت را مستقیم روی نقشه انتخاب کنید')
      } else {
        setSearchResults(res.results)
      }
    } catch {
      toast.error('خطا در جست‌وجوی آدرس')
    } finally {
      setSearching(false)
    }
  }

  function pickSearchResult(result) {
    onChange('latitude', Number(result.latitude).toFixed(6))
    onChange('longitude', Number(result.longitude).toFixed(6))
    setSearchResults(null)
    setSearchQuery('')
    setSearchNotice('')
    setRecenterSignal((s) => s + 1)
  }

  async function handlePinChange(lat, lng) {
    onChange('latitude', lat)
    onChange('longitude', lng)
    try {
      const res = await authAPI.reverseGeocode(lat, lng)
      // یک فیلد آپدیت می‌شود اگر: هنوز خالی است، یا قبلاً خودِ همین مکانیابی
      // پرش کرده بود (نه خود کاربر) — با جابه‌جایی دوباره‌ی پین باید تازه شود
      const fieldsToFill = [['city', res.city], ['province', res.province], ['street', res.street]]
      for (const [field, value] of fieldsToFill) {
        if (!value) continue
        const isEmpty = !form[field]
        const wasAutoFilled = autoFilledRef.current.has(field)
        if (isEmpty || wasAutoFilled) {
          onChange(field, value)
          autoFilledRef.current.add(field)
        }
      }
    } catch {
      // reverse geocoding صرفاً یک کمک است — اگر ناموفق بود کاربر همچنان می‌تواند دستی تکمیل کند
    }
  }

  // اگر کاربر خودش فیلدی را دستی ویرایش کند، دیگر آن فیلد «خودکارپرشده» حساب نمی‌شود
  function handleManualFieldChange(field, value) {
    autoFilledRef.current.delete(field)
    onChange(field, value)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <Input
        label="عنوان آدرس *"
        value={form.title}
        onChange={(e) => onChange('title', e.target.value)}
        placeholder="مثلاً: خانه، محل کار"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <Input
          label="استان (اختیاری)"
          value={form.province}
          onChange={(e) => handleManualFieldChange('province', e.target.value)}
          placeholder="خوزستان"
        />
        <Input
          label="شهر *"
          value={form.city}
          onChange={(e) => handleManualFieldChange('city', e.target.value)}
          placeholder="دزفول"
        />
      </div>
      <Input
        label="خیابان / کوچه / پلاک *"
        value={form.street}
        onChange={(e) => handleManualFieldChange('street', e.target.value)}
        placeholder="خیابان، کوچه، پلاک"
      />
      <Textarea
        label="جزئیات بیشتر (اختیاری)"
        value={form.detail}
        onChange={(e) => onChange('detail', e.target.value)}
        placeholder="طبقه، واحد و ..."
        rows={2}
      />
      <Input
        label="کد پستی (اختیاری)"
        value={form.postal_code}
        onChange={(e) => onChange('postal_code', e.target.value)}
        placeholder="1234567890"
        dir="ltr"
      />

      <div>
        <label style={{
          fontSize: '0.85rem', display: 'block', marginBottom: 6,
          color: (form.latitude && form.longitude) ? 'var(--text-secondary)' : 'var(--error)',
        }}>
          موقعیت روی نقشه * {(!form.latitude || !form.longitude) && '— برای ارسال سفارش با پیک الزامی است'}
        </label>

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
              placeholder="جست‌وجوی آدرس، مثلاً: دزفول، میدان فرهنگ"
              style={{
                flex: 1, padding: '9px 12px', background: 'var(--bg-primary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-family)', fontSize: '0.85rem',
              }}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                background: 'var(--primary-bg)', border: '1px solid rgba(240,214,132,.3)',
                borderRadius: 'var(--radius-md)', color: 'var(--primary)',
                fontFamily: 'var(--font-family)', fontSize: '0.85rem', cursor: 'pointer',
                opacity: (searching || !searchQuery.trim()) ? 0.6 : 1,
              }}
            >
              <MdSearch size={16} /> {searching ? '...' : 'جست‌وجو'}
            </button>
          </div>

          {searchNotice && (
            <p style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {searchNotice}
            </p>
          )}

          {searchResults && (
            <div style={{
              marginTop: 6, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              overflow: 'hidden', background: 'var(--bg-secondary)',
            }}>
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickSearchResult(r)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'right', padding: '9px 12px',
                    background: 'none', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                    color: 'var(--text-secondary)', fontFamily: 'var(--font-family)', fontSize: '0.8rem', cursor: 'pointer',
                  }}
                >
                  {shortenDisplayName(r.display_name)}
                </button>
              ))}
            </div>
          )}
        </div>

        <MapLocationPicker
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={handlePinChange}
          recenterSignal={recenterSignal}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => onChange('is_default', e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
        />
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          آدرس پیش‌فرض
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
          برای سفارشات پیک به‌صورت خودکار انتخاب می‌شود
        </span>
      </label>
    </div>
  )
}
