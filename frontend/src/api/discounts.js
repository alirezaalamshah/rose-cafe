import api from './axios.js'

export const discountsAPI = {
  checkCode: (code, orderTotal) => api.post('/discounts/check/', { code, order_total: orderTotal }),
  getBirthdayOffer: () => api.get('/discounts/birthday-offer/'),
  adminGetDiscounts: (params) => api.get('/discounts/admin/', { params }),
  adminCreateDiscount: (data) => api.post('/discounts/admin/', data),
  adminUpdateDiscount: (id, data) => api.put(`/discounts/admin/${id}/`, data),
  adminDeleteDiscount: (id) => api.delete(`/discounts/admin/${id}/`),
  adminGetWinBackSettings: () => api.get('/discounts/admin/win-back-settings/'),
  adminUpdateWinBackSettings: (data) => api.patch('/discounts/admin/win-back-settings/', data),
  adminSendWinBackSMS: (userId) => api.post(`/discounts/admin/win-back/${userId}/send/`),
  adminGetUserAssignedDiscounts: (userId) => api.get(`/discounts/admin/user/${userId}/assigned/`),
}
