import api from './axios.js'

export const waiterAPI = {
  getMe: () => api.get('/auth/waiter/me/'),
  getOrders: (params) => api.get('/orders/waiter/', { params }),
  updateOrderStatus: (id, status) => api.patch(`/orders/waiter/${id}/status/`, { status }),
  getReservations: (params) => api.get('/reservations/waiter/', { params }),
  updateReservation: (id, data) => api.patch(`/reservations/waiter/${id}/`, data),
  getTables: () => api.get('/reservations/waiter/tables/'),
  updateTable: (id, data) => api.patch(`/reservations/waiter/tables/${id}/`, data),

  // موجودی منو
  getMenuItems: () => api.get('/menu/waiter/items/'),
  updateItemAvailability: (id, status) => api.patch(`/menu/waiter/items/${id}/availability/`, { status }),
  updateVariantAvailability: (id, isAvailable) =>
    api.patch(`/menu/waiter/variants/${id}/availability/`, { is_available: isAvailable }),
  updateAddonAvailability: (id, isAvailable) =>
    api.patch(`/menu/waiter/addons/${id}/availability/`, { is_available: isAvailable }),

  // بستن فوری کافه (اندپوینت مشترک با ادمین — پرمیشن سمت سرور چک می‌شود)
  forceCloseCafe: () => api.post('/business/admin/force-close-today/'),
  reopenCafe: () => api.delete('/business/admin/force-close-today/'),

  // عملکرد شخصی
  getMyPerformance: (params) => api.get('/staff-activity/my-performance/', { params }),
}
