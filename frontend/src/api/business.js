import api from './axios.js'

export const businessAPI = {
  getCafeStatus: () => api.get('/business/status/'),
  getHours: () => api.get('/business/hours/'),
  getCafeInfo: () => api.get('/business/info/'),
  getDeliverySettings: () => api.get('/business/delivery-settings/'),

  // Admin
  adminGetHours: () => api.get('/business/admin/hours/'),
  adminUpdateDay: (dayOfWeek, data) => api.patch(`/business/admin/hours/${dayOfWeek}/`, data),
  adminGetSpecialDays: () => api.get('/business/admin/special-days/'),
  adminCreateSpecialDay: (data) => api.post('/business/admin/special-days/', data),
  adminDeleteSpecialDay: (id) => api.delete(`/business/admin/special-days/${id}/`),
  adminForceCloseToday: () => api.post('/business/admin/force-close-today/'),
  adminReopenToday: () => api.delete('/business/admin/force-close-today/'),
  adminGetDeliverySettings: () => api.get('/business/admin/delivery-settings/'),
  adminUpdateDeliverySettings: (data) => api.patch('/business/admin/delivery-settings/', data),
  adminGetCafeInfo: () => api.get('/business/admin/info/'),
  adminUpdateCafeInfo: (data) => api.patch('/business/admin/info/', data),
  getReservationSettings: () => api.get('/business/reservation-settings/'),
  adminGetReservationSettings: () => api.get('/business/admin/reservation-settings/'),
  adminUpdateReservationSettings: (data) => api.patch('/business/admin/reservation-settings/', data),

  // Banners
  getBanners: () => api.get('/business/banners/'),
  adminGetBanners: () => api.get('/business/admin/banners/'),
  adminCreateBanner: (data) => api.post('/business/admin/banners/', data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  }),
  adminUpdateBanner: (id, data) => api.patch(`/business/admin/banners/${id}/`, data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  }),
  adminDeleteBanner: (id) => api.delete(`/business/admin/banners/${id}/`),

  // Social links
  getSocialLinks: () => api.get('/business/social-links/'),
  adminGetSocialLinks: () => api.get('/business/admin/social-links/'),
  adminCreateSocialLink: (data) => api.post('/business/admin/social-links/', data),
  adminUpdateSocialLink: (id, data) => api.patch(`/business/admin/social-links/${id}/`, data),
  adminDeleteSocialLink: (id) => api.delete(`/business/admin/social-links/${id}/`),
}
