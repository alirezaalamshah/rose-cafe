import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdSearch, MdPerson } from 'react-icons/md'
import { usersAPI } from '../../../api/users.js'

/** جست‌وجوی سریع مشتری از هرجای پنل ادمین — بدون رفتن به صفحه‌ی کاربران،
 * مستقیم به جزئیات همان کاربر می‌رود. */
export default function AdminGlobalSearch({ collapsed }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    const timer = setTimeout(() => {
      usersAPI.adminGetUsers({ search: query.trim(), page_size: 6 })
        .then((data) => {
          setResults(Array.isArray(data) ? data : (data.results || []))
          setOpen(true)
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function goTo(user) {
    setQuery('')
    setResults([])
    setOpen(false)
    navigate(`/admin/users/${user.id}`)
  }

  if (collapsed) return null

  return (
    <div className="admin-global-search" ref={boxRef}>
      <div className="admin-global-search__input-wrap">
        <MdSearch size={16} className="admin-global-search__icon" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="جستجو مشتری (نام/تلفن)..."
        />
      </div>
      {open && (
        <div className="admin-global-search__dropdown">
          {loading ? (
            <div className="admin-global-search__empty">در حال جستجو...</div>
          ) : results.length === 0 ? (
            <div className="admin-global-search__empty">نتیجه‌ای یافت نشد</div>
          ) : (
            results.map((u) => (
              <button key={u.id} className="admin-global-search__item" onClick={() => goTo(u)}>
                <MdPerson size={15} />
                <span className="admin-global-search__item-name">{u.full_name || 'بدون نام'}</span>
                <span className="admin-global-search__item-phone" dir="ltr">{u.phone}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
