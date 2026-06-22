import api from './axios.js'

export const authAPI = {
  sendOTP: (phone) => api.post('/auth/send-otp/', { phone }),
  verifyOTP: (phone, code) => api.post('/auth/verify-otp/', { phone, code }),
  refreshToken: (refresh) => api.post('/auth/refresh/', { refresh }),
  getMe: () => api.get('/auth/me/'),
  updateMe: (data) => api.patch('/auth/me/', data),
  getAddresses: () => api.get('/auth/addresses/'),
  createAddress: (data) => api.post('/auth/addresses/', data),
  updateAddress: (id, data) => api.put(`/auth/addresses/${id}/`, data),
  deleteAddress: (id) => api.delete(`/auth/addresses/${id}/`),
}
