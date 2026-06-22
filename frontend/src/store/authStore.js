import { create } from 'zustand'
import { authAPI } from '../api/auth.js'

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,

  initAuth: () => {
    const access = localStorage.getItem('access_token')
    const refresh = localStorage.getItem('refresh_token')
    const user = localStorage.getItem('user')
    if (access && user) {
      set({
        accessToken: access,
        refreshToken: refresh,
        user: JSON.parse(user),
        isAuthenticated: true,
      })
    }
  },

  sendOTP: async (phone) => {
    set({ isLoading: true })
    try {
      await authAPI.sendOTP(phone)
      set({ isLoading: false })
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      return { success: false, error: err.response?.data?.detail || 'خطا در ارسال کد' }
    }
  },

  verifyOTP: async (phone, code) => {
    set({ isLoading: true })
    try {
      const data = await authAPI.verifyOTP(phone, code)
      const { access, refresh, user } = data
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      localStorage.setItem('user', JSON.stringify(user))
      set({
        accessToken: access,
        refreshToken: refresh,
        user,
        isAuthenticated: true,
        isLoading: false,
      })
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      return { success: false, error: err.response?.data?.detail || 'کد نامعتبر است' }
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
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
