import api from './axios.js'

export const ordersAPI = {
  getOrders: () => api.get('/orders/'),
  getOrder: (id) => api.get(`/orders/${id}/`),
  createOrder: (data) => api.post('/orders/', data),
  cancelOrder: (id) => api.post(`/orders/${id}/cancel/`),
  confirmCashPayment: (id) => api.post(`/orders/${id}/confirm-cash/`),

  // Admin
  adminGetOrders: (params) => api.get('/orders/admin/', { params }),
  adminGetOrder: (id) => api.get(`/orders/admin/${id}/`),
  adminUpdateStatus: (id, status) => api.patch(`/orders/admin/${id}/status/`, { status }),
  adminNearestOrderDate: (date, direction) =>
    api.get('/orders/admin/nearest-date/', { params: { date, direction } }),

  // Waiter
  waiterGetOrders: (params) => api.get('/orders/waiter/', { params }),
  waiterUpdateStatus: (id, status) => api.patch(`/orders/waiter/${id}/status/`, { status }),
}
