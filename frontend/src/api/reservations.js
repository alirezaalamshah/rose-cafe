import api from './axios'

export const getAvailableTables = (data) => api.post('/reservations/available-tables/', data)
export const getReservations = () => api.get('/reservations/')
export const createReservation = (data) => api.post('/reservations/', data)
export const cancelReservation = (id) => api.delete(`/reservations/${id}/`)