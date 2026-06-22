import api from './axios.js'

export const reservationsAPI = {
  getAvailableTables: (params) => api.get('/reservations/available-tables/', { params }),
  getReservations: () => api.get('/reservations/'),
  createReservation: (data) => api.post('/reservations/', data),
  getReservation: (id) => api.get(`/reservations/${id}/`),

  // Admin
  adminGetTables: () => api.get('/reservations/admin/tables/'),
  adminCreateTable: (data) => api.post('/reservations/admin/tables/', data),
  adminUpdateTable: (id, data) => api.put(`/reservations/admin/tables/${id}/`, data),
  adminGetReservations: (params) => api.get('/reservations/admin/reservations/', { params }),
  adminUpdateReservation: (id, data) => api.patch(`/reservations/admin/reservations/${id}/`, data),
}
