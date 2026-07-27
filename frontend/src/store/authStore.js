import { create } from 'zustand'
import { authAPI } from '../api/auth.js'
import useCartStore from './cartStore.js'

function _saveSession(set, { access, refresh, user }) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
  localStorage.setItem('user', JSON.stringify(user))
  set({ accessToken: access, refreshToken: refresh, user, isAuthenticated: true, isLoading: false })
}

function _extractError(err) {
  const data = err.response?.data
  return data?.detail || data?.non_field_errors?.[0] || Object.values(data || {})?.[0]?.[0] || 'خطایی رخ داد'
}

// خواندن session به صورت sync موقع ساخت store — تا ProtectedRoute در اولین render
// وضعیت درست را ببیند و روی refresh کاربر لاگین‌شده به login/home پرت نشود
function _loadSession() {
  try {
    const access = localStorage.getItem('access_token')
    const refresh = localStorage.getItem('refresh_token')
    const user = JSON.parse(localStorage.getItem('user'))
    if (access && user) {
      return { accessToken: access, refreshToken: refresh, user, isAuthenticated: true }
    }
  } catch { /* داده خراب — session نادیده گرفته می‌شود */ }
  return { accessToken: null, refreshToken: null, user: null, isAuthenticated: false }
}

const useAuthStore = create((set, get) => ({
  ..._loadSession(),
  isLoading: false,

  initAuth: () => {
    set(_loadSession())
  },

  // ── ثبت‌نام: ارسال OTP ──
  register: async (phone) => {
    set({ isLoading: true })
    try {
      await authAPI.register(phone)
      set({ isLoading: false })
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      return { success: false, error: _extractError(err) }
    }
  },

  // ── ثبت‌نام: تأیید OTP + رمز عبور ──
  registerVerify: async (phone, otp, password, passwordConfirm) => {
    set({ isLoading: true })
    try {
      const data = await authAPI.registerVerify(phone, otp, password, passwordConfirm)
      _saveSession(set, data)
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      return { success: false, error: _extractError(err) }
    }
  },

  // ── ورود با رمز عبور ──
  login: async (phone, password) => {
    set({ isLoading: true })
    try {
      const data = await authAPI.login(phone, password)
      _saveSession(set, data)
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      const code = err.response?.data?.code
      return { success: false, error: _extractError(err), code }
    }
  },

  // ── فراموشی رمز: ارسال OTP ──
  forgotPassword: async (phone) => {
    set({ isLoading: true })
    try {
      await authAPI.forgotPassword(phone)
      set({ isLoading: false })
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      return { success: false, error: _extractError(err) }
    }
  },

  // ── بازنشانی رمز: OTP + رمز جدید ──
  resetPassword: async (phone, otp, password, passwordConfirm) => {
    set({ isLoading: true })
    try {
      const data = await authAPI.resetPassword(phone, otp, password, passwordConfirm)
      _saveSession(set, data)
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      return { success: false, error: _extractError(err) }
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
    useCartStore.getState().clearCart()
  },

  updateUser: (userData) => {
    const updated = { ...get().user, ...userData }
    localStorage.setItem('user', JSON.stringify(updated))
    set({ user: updated })
  },

  setTokens: (access, refresh) => {
    localStorage.setItem('access_token', access)
    if (refresh) localStorage.setItem('refresh_token', refresh)
    set({ accessToken: access, refreshToken: refresh || get().refreshToken })
  },
}))

export default useAuthStore
