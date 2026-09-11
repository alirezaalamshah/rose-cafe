import api from './axios.js'

export const posAPI = {
  createWalkInOrder: (data) => api.post('/pos/walk-in-orders/', data),
  getWalkInOrderMenu: () => api.get('/pos/walk-in-orders/menu/'),
  getWalkInOrderTables: () => api.get('/pos/walk-in-orders/tables/'),

  // Admin
  adminGetReceiptSettings: () => api.get('/pos/admin/receipt-settings/'),
  adminUpdateReceiptSettings: (data) => api.patch('/pos/admin/receipt-settings/', data),
}
