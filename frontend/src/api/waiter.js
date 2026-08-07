import api from './axios.js'

export const waiterAPI = {
  getMe: () => api.get('/auth/waiter/me/'),
  getOrders: (params) => api.get('/orders/waiter/', { params }),
  updateOrderStatus: (id, status) => api.patch(`/orders/waiter/${id}/status/`, { status }),
  getReservations: (params) => api.get('/reservations/waiter/', { params }),
  updateReservation: (id, data) => api.patch(`/reservations/waiter/${id}/`, data),
  getTables: () => api.get('/reservations/waiter/tables/'),
  updateTable: (id, data) => api.patch(`/reservations/waiter/tables/${id}/`, data),
}
