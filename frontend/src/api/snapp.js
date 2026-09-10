import api from './axios.js'

export const snappAPI = {
  getDeliveryZone: () => api.get('/snapp/delivery-zone/'),
  adminGetSettings: () => api.get('/snapp/admin/settings/'),
  adminUpdateSettings: (data) => api.patch('/snapp/admin/settings/', data),
  adminGetDeliveryCategories: () => api.get('/snapp/admin/settings/delivery-categories/'),
  adminResetCircuitBreaker: () => api.post('/snapp/admin/settings/reset-circuit-breaker/'),
  dispatchOrder: (orderId) => api.post(`/snapp/admin/orders/${orderId}/dispatch/`),
  retryDispatch: (orderId) => api.post(`/snapp/admin/orders/${orderId}/retry/`),
  cancelCourier: (orderId) => api.post(`/snapp/admin/orders/${orderId}/cancel/`),
  getCourierLocation: (orderId) => api.get(`/snapp/orders/${orderId}/location/`),
}
