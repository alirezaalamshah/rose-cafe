import api from './axios.js'

export const reservationsAPI = {
  // User
  getTableSchedule: (date) => api.get('/reservations/schedule/', { params: { date } }),
  getAvailableTables: (data) => api.post('/reservations/available-tables/', data),
  getActiveTables: () => api.get('/reservations/active-tables/'),
  getReservations: () => api.get('/reservations/'),
  createReservation: (data) => api.post('/reservations/', data),
  getReservation: (id) => api.get(`/reservations/${id}/`),
  cancelReservation: (id) => api.delete(`/reservations/${id}/`),

  // Admin
  adminGetTables: () => api.get('/reservations/admin/tables/'),
  adminCreateTable: (data) => api.post('/reservations/admin/tables/', data),
  adminUpdateTable: (id, data) => api.put(`/reservations/admin/tables/${id}/`, data),
  adminPatchTable: (id, data) => api.patch(`/reservations/admin/tables/${id}/`, data),
  adminDeleteTable: (id) => api.delete(`/reservations/admin/tables/${id}/`),
  adminBulkToggleTables: (data) => api.post('/reservations/admin/tables/bulk-toggle/', data),
  adminGetReservations: (params) => api.get('/reservations/admin/reservations/', { params }),
  adminUpdateReservation: (id, data) => api.patch(`/reservations/admin/reservations/${id}/`, data),
}
