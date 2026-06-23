import { useState, useEffect, useCallback } from 'react'
import { MdSearch, MdAdminPanelSettings, MdBlock, MdCheckCircle, MdPerson } from 'react-icons/md'
import toast from 'react-hot-toast'
import { usersAPI } from '../../api/users.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { formatDate } from '../../utils/helpers.js'
import './AdminOrdersPage.css'
import './AdminUsersPage.css'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback((q = '') => {
    setLoading(true)
    usersAPI.adminGetUsers(q ? { search: q } : {})
      .then((data) => setUsers(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function handleSearch(e) {
    const q = e.target.value
    setSearch(q)
    const timer = setTimeout(() => fetchUsers(q), 500)
    return () => clearTimeout(timer)
  }

  async function handleToggleStaff(user) {
    setSaving(user.id)
    try {
      const updated = await usersAPI.adminUpdateUser(user.id, { is_staff: !user.is_staff })
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...updated } : u))
      toast.success(updated.is_staff ? 'دسترسی ادمین داده شد' : 'دسترسی ادمین گرفته شد')
    } catch {
      toast.error('خطا در بروزرسانی')
    } finally {
      setSaving(null)
    }
  }

  async function handleToggleActive(user) {
    setSaving(user.id)
    try {
      const updated = await usersAPI.adminUpdateUser(user.id, { is_active: !user.is_active })
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...updated } : u))
      toast.success(updated.is_active ? 'کاربر فعال شد' : 'کاربر مسدود شد')
    } catch {
      toast.error('خطا در بروزرسانی')
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveEdit() {
    if (!editUser) return
    setSaving('edit')
    try {
      const updated = await usersAPI.adminUpdateUser(editUser.id, {
        full_name: editUser.full_name,
        is_staff: editUser.is_staff,
        is_active: editUser.is_active,
      })
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...updated } : u))
      toast.success('کاربر بروزرسانی شد')
      setEditUser(null)
    } catch {
      toast.error('خطا در ذخیره')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت کاربران</h1>
        <p>{users.length} کاربر ثبت‌نام شده</p>
      </div>

      <div className="admin-users__search">
        <MdSearch size={18} className="admin-users__search-icon" />
        <input
          placeholder="جستجو بر اساس نام یا شماره موبایل..."
          value={search}
          onChange={handleSearch}
        />
      </div>

      {loading ? <Loading /> : (
        <div className="admin-orders__table-wrap">
          {users.length === 0 ? (
            <div className="empty-state">
              <div className="icon">👤</div>
              <h3>کاربری یافت نشد</h3>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>شماره موبایل</th>
                  <th>نام</th>
                  <th>تاریخ عضویت</th>
                  <th>نقش</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>#{user.id}</td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>{user.phone}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{user.full_name || '—'}</td>
                    <td>{formatDate(user.date_joined)}</td>
                    <td>
                      {user.is_staff ? (
                        <span className="status-badge status-confirmed">
                          <MdAdminPanelSettings size={12} /> ادمین
                        </span>
                      ) : (
                        <span className="status-badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                          <MdPerson size={12} /> کاربر
                        </span>
                      )}
                    </td>
                    <td>
                      {user.is_active ? (
                        <span className="status-badge status-confirmed">فعال</span>
                      ) : (
                        <span className="status-badge status-cancelled">مسدود</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="admin-action-btn"
                          onClick={() => setEditUser({ ...user })}
                        >
                          ویرایش
                        </button>
                        <button
                          className="admin-action-btn"
                          style={user.is_staff
                            ? { background: 'var(--warning-bg)', borderColor: 'rgba(251,191,36,.25)', color: 'var(--warning)' }
                            : {}}
                          disabled={saving === user.id}
                          onClick={() => handleToggleStaff(user)}
                          title={user.is_staff ? 'گرفتن دسترسی ادمین' : 'دادن دسترسی ادمین'}
                        >
                          <MdAdminPanelSettings size={14} />
                        </button>
                        <button
                          className="admin-action-btn"
                          style={user.is_active
                            ? { background: 'var(--error-bg)', borderColor: 'rgba(248,113,113,.2)', color: 'var(--error)' }
                            : { background: 'var(--success-bg)', borderColor: 'rgba(74,222,128,.2)', color: 'var(--success)' }}
                          disabled={saving === user.id}
                          onClick={() => handleToggleActive(user)}
                          title={user.is_active ? 'مسدود کردن' : 'فعال کردن'}
                        >
                          {user.is_active ? <MdBlock size={14} /> : <MdCheckCircle size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title="ویرایش کاربر"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditUser(null)}>انصراف</Button>
            <Button onClick={handleSaveEdit} loading={saving === 'edit'}>ذخیره</Button>
          </>
        }
      >
        {editUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                شماره موبایل (قابل تغییر نیست)
              </label>
              <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>
                {editUser.phone}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                نام کامل
              </label>
              <input
                value={editUser.full_name || ''}
                onChange={(e) => setEditUser((p) => ({ ...p, full_name: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)', fontSize: '0.9rem' }}
                placeholder="نام و نام خانوادگی"
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-xl)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={editUser.is_staff}
                  onChange={(e) => setEditUser((p) => ({ ...p, is_staff: e.target.checked }))}
                />
                دسترسی ادمین
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={editUser.is_active}
                  onChange={(e) => setEditUser((p) => ({ ...p, is_active: e.target.checked }))}
                />
                حساب فعال
              </label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
