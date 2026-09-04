import api from './axios.js'

export const usersAPI = {
  adminGetUsers: (params) => api.get('/auth/admin/users/', { params }),
  adminUpdateUser: (id, data) => api.patch(`/auth/admin/users/${id}/`, data),
  adminGetWaiterPermissions: (id) => api.get(`/auth/admin/users/${id}/waiter-permissions/`),
  adminUpdateWaiterPermissions: (id, data) => api.patch(`/auth/admin/users/${id}/waiter-permissions/`, data),

  // گزارش کامل مشتری (Customer 360)
  adminGetUserSummary: (id) => api.get(`/auth/admin/users/${id}/summary/`),
  adminGetUserOrders: (id, params) => api.get(`/auth/admin/users/${id}/orders/`, { params }),
  adminGetUserWalletTransactions: (id, params) => api.get(`/auth/admin/users/${id}/wallet-transactions/`, { params }),
  adminGetUserDiscountUsage: (id, params) => api.get(`/auth/admin/users/${id}/discount-usage/`, { params }),
  adminGetUserReservations: (id, params) => api.get(`/auth/admin/users/${id}/reservations/`, { params }),
  adminGetUserReviews: (id) => api.get(`/auth/admin/users/${id}/reviews/`),
  adminAdjustUserWallet: (id, data) => api.post(`/auth/admin/users/${id}/wallet-adjustment/`, data),
  adminGetChurnedCustomers: (params) => api.get('/auth/admin/customers/churned/', { params }),
}
