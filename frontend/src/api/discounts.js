import api from './axios.js'

export const discountsAPI = {
  checkCode: (code, orderTotal) => api.post('/discounts/check/', { code, order_total: orderTotal }),
  adminGetDiscounts: (params) => api.get('/discounts/admin/', { params }),
  adminCreateDiscount: (data) => api.post('/discounts/admin/', data),
  adminUpdateDiscount: (id, data) => api.put(`/discounts/admin/${id}/`, data),
  adminDeleteDiscount: (id) => api.delete(`/discounts/admin/${id}/`),
}
