import api from './axios.js'

export const authAPI = {
  // ── Auth جدید ──
  register: (phone) => api.post('/auth/register/', { phone }),
  registerVerify: (phone, otp, password, password_confirm) =>
    api.post('/auth/register/verify/', { phone, otp, password, password_confirm }),
  login: (phone, password) => api.post('/auth/login/', { phone, password }),
  forgotPassword: (phone) => api.post('/auth/forgot-password/', { phone }),
  resetPassword: (phone, otp, password, password_confirm) =>
    api.post('/auth/reset-password/', { phone, otp, password, password_confirm }),

  // ── عمومی ──
  refreshToken: (refresh) => api.post('/auth/refresh/', { refresh }),
  getMe: () => api.get('/auth/me/'),
  updateMe: (data) => api.patch('/auth/me/', data),
  changePassword: (current_password, password, password_confirm) =>
    api.post('/auth/change-password/', { current_password, password, password_confirm }),
  getAddresses: () => api.get('/auth/addresses/'),
  createAddress: (data) => api.post('/auth/addresses/', data),
  updateAddress: (id, data) => api.patch(`/auth/addresses/${id}/`, data),
  setDefaultAddress: (id) => api.patch(`/auth/addresses/${id}/`, { is_default: true }),
  deleteAddress: (id) => api.delete(`/auth/addresses/${id}/`),
}
