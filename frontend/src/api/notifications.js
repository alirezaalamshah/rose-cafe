import api from './axios.js'

export const notificationsAPI = {
  getVapidPublicKey: () => api.get('/notifications/push/vapid-public-key/'),
  subscribe: (subscription) => api.post('/notifications/push/subscribe/', subscription),
  unsubscribe: (endpoint) => api.post('/notifications/push/unsubscribe/', { endpoint }),
}
