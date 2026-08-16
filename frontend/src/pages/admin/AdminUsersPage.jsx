import { useState, useEffect, useCallback } from 'react'
import {
  MdSearch, MdAdminPanelSettings, MdBlock, MdCheckCircle,
  MdPerson, MdRestaurantMenu, MdTune, MdCake,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { usersAPI } from '../../api/users.js'
import Loading from '../../components/common/Loading/Loading.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { Select } from '../../components/common/Input/Input.jsx'
import BirthdayPicker from '../../components/common/BirthdayPicker/BirthdayPicker.jsx'
import { formatDate } from '../../utils/helpers.js'
import { formatJalali } from '../../utils/jalali.js'
import './AdminOrdersPage.css'
import './AdminUsersPage.css'

const ROLES = [
  { value: 'customer', label: 'مشتری', icon: <MdPerson size={12} />, cls: '' },
  { value: 'waiter', label: 'سرپرست سالن', icon: <MdRestaurantMenu size={12} />, cls: 'status-pending' },
  { value: 'admin', label: 'مدیر', icon: <MdAdminPanelSettings size={12} />, cls: 'status-confirmed' },
]

const ROLE_FILTER = [
  { value: '', label: 'همه نقش‌ها' },
  { value: 'customer', label: 'مشتری' },
  { value: 'waiter', label: 'سرپرست سالن' },
  { value: 'admin', label: 'مدیر' },
]

function RoleBadge({ role, isStaff }) {
  const effective = isStaff ? 'admin' : (role || 'customer')
  const def = ROLES.find((r) => r.value === effective) || ROLES[0]
  return (
    <span className={`status-badge ${def.cls}`} style={!def.cls ? { background: 'var(--bg-secondary)', color: 'var(--text-muted)' } : {}}>
      {def.icon} {def.label}
    </span>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [saving, setSaving] = useState(false)

  // Waiter permission modal
  const [permUser, setPermUser] = useState(null)
  const [perms, setPerms] = useState({ can_manage_orders: true, can_manage_reservations: false, can_manage_tables: false })
  const [savingPerms, setSavingPerms] = useState(false)

  const fetchUsers = useCallback((q = '', role = '') => {
    setLoading(true)
    const params = {}
    if (q) params.search = q
    if (role) params.role = role
    usersAPI.adminGetUsers(params)
      .then((data) => setUsers(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function handleSearch(e) {
    const q = e.target.value
    setSearch(q)
    const timer = setTimeout(() => fetchUsers(q, roleFilter), 500)
    return () => clearTimeout(timer)
  }

  function handleRoleFilter(e) {
    const role = e.target.value
    setRoleFilter(role)
    fetchUsers(search, role)
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
      const payload = {
        full_name: editUser.full_name,
        role: editUser.role,
        is_active: editUser.is_active,
      }
      if (editUser._birthday !== undefined) payload.birthday = editUser._birthday || null
      const updated = await usersAPI.adminUpdateUser(editUser.id, payload)
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...updated } : u))
      toast.success('کاربر بروزرسانی شد')
      setEditUser(null)
    } catch {
      toast.error('خطا در ذخیره')
    } finally {
      setSaving(null)
    }
  }

  async function openPermissions(user) {
    setPermUser(user)
    try {
      const data = await usersAPI.adminGetWaiterPermissions(user.id)
      setPerms(data)
    } catch {
      setPerms({ can_manage_orders: true, can_manage_reservations: false, can_manage_tables: false })
    }
  }

  async function handleSavePerms() {
    if (!permUser) return
    setSavingPerms(true)
    try {
      const updated = await usersAPI.adminUpdateWaiterPermissions(permUser.id, perms)
      setPerms(updated)
      // Update user in list
      setUsers((prev) => prev.map((u) => u.id === permUser.id ? { ...u, waiter_permissions: updated } : u))
      toast.success('دسترسی‌های سرپرست سالن ذخیره شد')
      setPermUser(null)
    } catch {
      toast.error('خطا در ذخیره دسترسی‌ها')
    } finally {
      setSavingPerms(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>مدیریت کاربران</h1>
        <p>{users.length} کاربر ثبت‌نام شده</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <div className="admin-users__search" style={{ flex: 1, minWidth: 200 }}>
          <MdSearch size={18} className="admin-users__search-icon" />
          <input
            placeholder="جستجو بر اساس نام یا شماره موبایل..."
            value={search}
            onChange={handleSearch}
          />
        </div>
        <Select value={roleFilter} onChange={handleRoleFilter} style={{ width: 160 }}>
          {ROLE_FILTER.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
      </div>

      {loading ? <Loading /> : (
        <div className="admin-orders__table-wrap">
          {users.length === 0 ? (
            <div className="empty-state"><div className="icon">👤</div><h3>کاربری یافت نشد</h3></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>شماره موبایل</th>
                  <th>نام</th>
                  <th>تاریخ عضویت</th>
                  <th>نقش</th>
                  <th>رمز عبور</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="شناسه">#{user.id}</td>
                    <td data-label="شماره موبایل"><span dir="ltr">{user.phone}</span></td>
                    <td data-label="نام" style={{ color: 'var(--text-primary)' }}>{user.full_name || '—'}</td>
                    <td data-label="تاریخ عضویت">{formatDate(user.date_joined)}</td>
                    <td data-label="نقش"><RoleBadge role={user.role} isStaff={user.is_staff} /></td>
                    <td data-label="رمز عبور">
                      {user.has_password
                        ? <span className="status-badge status-confirmed">دارد</span>
                        : <span className="status-badge status-cancelled">ندارد</span>
                      }
                    </td>
                    <td data-label="وضعیت">
                      {user.is_active
                        ? <span className="status-badge status-confirmed">فعال</span>
                        : <span className="status-badge status-cancelled">مسدود</span>
                      }
                    </td>
                    <td className="td-actions">
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button className="admin-action-btn" onClick={() => setEditUser({ ...user })}>
                          ویرایش
                        </button>
                        {(user.role === 'waiter') && (
                          <button
                            className="admin-action-btn"
                            style={{ background: 'var(--primary-bg)', borderColor: 'rgba(240,214,132,.25)', color: 'var(--primary)' }}
                            title="تنظیم دسترسی‌های سرپرست سالن"
                            onClick={() => openPermissions(user)}
                          >
                            <MdTune size={14} /> دسترسی
                          </button>
                        )}
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

      {/* Edit User Modal */}
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
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>نام کامل</label>
              <input
                value={editUser.full_name || ''}
                onChange={(e) => setEditUser((p) => ({ ...p, full_name: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)', fontSize: '0.9rem' }}
                placeholder="نام و نام خانوادگی"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>نقش کاربر</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setEditUser((p) => ({ ...p, role: r.value }))}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${editUser.role === r.value ? 'var(--primary)' : 'var(--border)'}`,
                      background: editUser.role === r.value ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                      color: editUser.role === r.value ? 'var(--primary)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-family)',
                      fontSize: '0.82rem',
                      fontWeight: editUser.role === r.value ? 700 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    {r.icon} {r.label}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={editUser.is_active}
                onChange={(e) => setEditUser((p) => ({ ...p, is_active: e.target.checked }))}
              />
              حساب فعال
            </label>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MdCake size={14} color="var(--primary)" /> تاریخ تولد (ادمین می‌تواند ویرایش کند)
              </label>
              {editUser.birthday && editUser._birthday === undefined ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flex: 1 }}>
                    {formatJalali(editUser.birthday)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditUser((p) => ({ ...p, _birthday: '' }))}
                    style={{ fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    ویرایش
                  </button>
                </div>
              ) : (
                <BirthdayPicker
                  value={editUser._birthday ?? editUser.birthday ?? ''}
                  onChange={(v) => setEditUser((p) => ({ ...p, _birthday: v }))}
                />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Waiter Permissions Modal */}
      <Modal
        isOpen={!!permUser}
        onClose={() => setPermUser(null)}
        title={`دسترسی‌های سرپرست سالن — ${permUser?.full_name || permUser?.phone}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPermUser(null)}>انصراف</Button>
            <Button onClick={handleSavePerms} loading={savingPerms}>ذخیره دسترسی‌ها</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            مشخص کنید این سرپرست سالن به کدام بخش‌ها دسترسی داشته باشد:
          </p>
          {[
            { key: 'can_manage_orders', label: 'مدیریت سفارشات', desc: 'مشاهده و بروزرسانی وضعیت سفارشات' },
            { key: 'can_manage_reservations', label: 'مدیریت رزروها', desc: 'مشاهده و تأیید رزروهای میز' },
            { key: 'can_manage_tables', label: 'مدیریت میزها', desc: 'فعال/غیرفعال کردن میزها' },
            { key: 'can_manage_menu_availability', label: 'مدیریت موجودی منو', desc: 'موجود/ناموجود کردن آیتم‌ها، تنوع‌ها و افزودنی‌ها' },
            { key: 'can_force_close_cafe', label: 'بستن فوری کافه', desc: 'بستن/بازکردن اضطراری کافه برای امروز' },
            { key: 'can_view_own_performance', label: 'مشاهده عملکرد خود', desc: 'گزارش شخصی از سفارش‌های تأیید/رد‌شده و وجوه وصول‌شده' },
          ].map(({ key, label, desc }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={perms[key]}
                onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  )
}
